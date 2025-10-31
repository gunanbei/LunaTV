/* eslint-disable @typescript-eslint/no-explicit-any,no-console */
import he from 'he';
import Hls from 'hls.js';

function getDoubanImageProxyConfig(): {
  proxyType:
  | 'direct'
  | 'server'
  | 'img3'
  | 'cmliussss-cdn-tencent'
  | 'cmliussss-cdn-ali'
  | 'custom';
  proxyUrl: string;
} {
  const doubanImageProxyType =
    localStorage.getItem('doubanImageProxyType') ||
    (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY_TYPE ||
    'cmliussss-cdn-tencent';
  const doubanImageProxy =
    localStorage.getItem('doubanImageProxyUrl') ||
    (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY ||
    '';
  return {
    proxyType: doubanImageProxyType,
    proxyUrl: doubanImageProxy,
  };
}

/**
 * 处理图片 URL，如果设置了图片代理则使用代理
 */
export function processImageUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;

  // 仅处理豆瓣图片代理
  if (!originalUrl.includes('doubanio.com')) {
    return originalUrl;
  }

  const { proxyType, proxyUrl } = getDoubanImageProxyConfig();
  switch (proxyType) {
    case 'server':
      return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
    case 'img3':
      return originalUrl.replace(/img\d+\.doubanio\.com/g, 'img3.doubanio.com');
    case 'cmliussss-cdn-tencent':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.net'
      );
    case 'cmliussss-cdn-ali':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.com'
      );
    case 'custom':
      return `${proxyUrl}${encodeURIComponent(originalUrl)}`;
    case 'direct':
    default:
      return originalUrl;
  }
}

/**
 * 从m3u8内容中解析视频分辨率
 * @param m3u8Content m3u8文件内容
 * @returns 视频宽度，如果无法解析则返回0
 */
function parseResolutionFromM3u8(m3u8Content: string): number {
  try {
    // 尝试从 #EXT-X-STREAM-INF 标签中提取 RESOLUTION
    const resolutionMatch = m3u8Content.match(/RESOLUTION=(\d+)x(\d+)/i);
    if (resolutionMatch) {
      const width = parseInt(resolutionMatch[1], 10);
      console.log(`[M3U8解析] 从清单文件解析到分辨率: ${width}x${resolutionMatch[2]}`);
      return width;
    }

    // 尝试从 #EXT-X-MEDIA 标签中提取分辨率信息
    const mediaMatch = m3u8Content.match(/RESOLUTION=(\d+)x(\d+)/);
    if (mediaMatch) {
      const width = parseInt(mediaMatch[1], 10);
      console.log(`[M3U8解析] 从媒体标签解析到分辨率: ${width}x${mediaMatch[2]}`);
      return width;
    }

    console.log('[M3U8解析] 清单文件中未找到分辨率信息');
    return 0;
  } catch (error) {
    console.error('[M3U8解析] 解析分辨率时出错:', error);
    return 0;
  }
}

/**
 * 从m3u8地址获取视频质量等级和网络信息
 * @param m3u8Url m3u8播放列表的URL
 * @returns Promise<{quality: string, loadSpeed: string, pingTime: number}> 视频质量等级和网络信息
 */
export async function getVideoResolutionFromM3u8(m3u8Url: string): Promise<{
  quality: string; // 如720p、1080p等
  loadSpeed: string; // 自动转换为KB/s或MB/s
  pingTime: number; // 网络延迟（毫秒）
}> {
  try {
    // 首先尝试获取m3u8内容以解析分辨率
    let m3u8Width = 0;
    try {
      const m3u8Response = await fetch(m3u8Url);
      if (m3u8Response.ok) {
        const m3u8Content = await m3u8Response.text();
        m3u8Width = parseResolutionFromM3u8(m3u8Content);
      }
    } catch (error) {
      console.log('[M3U8解析] 无法获取m3u8内容:', error);
    }

    // 直接使用m3u8 URL作为视频源，避免CORS问题
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.preload = 'metadata';

      // 测量网络延迟（ping时间） - 使用m3u8 URL而不是ts文件
      const pingStart = performance.now();
      let pingTime = 0;

      // 测量ping时间（使用m3u8 URL）
      fetch(m3u8Url, { method: 'HEAD', mode: 'no-cors' })
        .then(() => {
          pingTime = performance.now() - pingStart;
        })
        .catch(() => {
          pingTime = performance.now() - pingStart; // 记录到失败为止的时间
        });

      // 固定使用hls.js加载，针对4K优化配置
      const hls = new Hls({
        debug: false,
        enableWorker: true,
        maxBufferLength: 10, // 测速时只需要少量缓冲
        maxMaxBufferLength: 20,
        maxBufferSize: 50 * 1000 * 1000, // 50MB缓冲用于测速
        manifestLoadingMaxRetry: 3,
        levelLoadingMaxRetry: 3,
        fragLoadingMaxRetry: 3,
      });

      // 设置超时处理 - 4K视频元数据加载可能需要更长时间
      const timeout = setTimeout(() => {
        hls.destroy();
        video.remove();
        reject(new Error('Timeout loading video metadata'));
      }, 8000); // 增加到8秒以支持4K视频

      video.onerror = () => {
        clearTimeout(timeout);
        hls.destroy();
        video.remove();
        reject(new Error('Failed to load video metadata'));
      };

      let actualLoadSpeed = '未知';
      let hasSpeedCalculated = false;
      let hasMetadataLoaded = false;

      let fragmentStartTime = 0;

      // 根据宽度计算清晰度
      const getQualityFromWidth = (width: number): string => {
        if (!width || width <= 0) return '未知';
        
        // 根据视频宽度判断视频质量等级，使用经典分辨率的宽度作为分割点
        if (width >= 3840) return '4K'; // 4K: 3840x2160
        if (width >= 2560) return '2K'; // 2K: 2560x1440
        if (width >= 1920) return '1080p'; // 1080p: 1920x1080
        if (width >= 1280) return '720p'; // 720p: 1280x720
        if (width >= 854) return '480p'; // 480p: 854x480
        return 'SD';
      };

      // 检查是否可以返回结果
      const checkAndResolve = () => {
        if (
          hasMetadataLoaded &&
          (hasSpeedCalculated || actualLoadSpeed !== '未知')
        ) {
          clearTimeout(timeout);
          hls.destroy();
          video.remove();

          // 优先使用视频元数据中的宽度
          let finalWidth = video.videoWidth || 0;
          const height = video.videoHeight || 0;

          // 如果视频元数据无法获取宽度（WebKit），使用m3u8解析的宽度
          if (!finalWidth && m3u8Width > 0) {
            finalWidth = m3u8Width;
            console.log(`[清晰度检测] 使用M3U8解析的宽度: ${finalWidth}px`);
          }

          const quality = getQualityFromWidth(finalWidth);

          // 输出调试信息，方便排查检测问题
          console.log(`[清晰度检测] 宽度: ${finalWidth}px, 高度: ${height}px, 质量: ${quality}, 来源: ${finalWidth === m3u8Width ? 'M3U8解析' : '视频元数据'}`);

          resolve({
            quality,
            loadSpeed: actualLoadSpeed,
            pingTime: Math.round(pingTime),
          });
        }
      };

      // 监听片段加载开始
      hls.on(Hls.Events.FRAG_LOADING, () => {
        fragmentStartTime = performance.now();
      });

      // 监听片段加载完成，只需首个分片即可计算速度
      hls.on(Hls.Events.FRAG_LOADED, (event: any, data: any) => {
        if (
          fragmentStartTime > 0 &&
          data &&
          data.payload &&
          !hasSpeedCalculated
        ) {
          const loadTime = performance.now() - fragmentStartTime;
          const size = data.payload.byteLength || 0;

          if (loadTime > 0 && size > 0) {
            const speedKBps = size / 1024 / (loadTime / 1000);

            // 立即计算速度，无需等待更多分片
            const avgSpeedKBps = speedKBps;

            if (avgSpeedKBps >= 1024) {
              actualLoadSpeed = `${(avgSpeedKBps / 1024).toFixed(1)} MB/s`;
            } else {
              actualLoadSpeed = `${avgSpeedKBps.toFixed(1)} KB/s`;
            }
            hasSpeedCalculated = true;
            checkAndResolve(); // 尝试返回结果
          }
        }
      });

      hls.loadSource(m3u8Url);
      hls.attachMedia(video);

      // 监听hls.js错误
      hls.on(Hls.Events.ERROR, (event: any, data: any) => {
        console.error('HLS错误:', data);
        if (data.fatal) {
          clearTimeout(timeout);
          hls.destroy();
          video.remove();
          reject(new Error(`HLS播放失败: ${data.type}`));
        }
      });

      // 监听视频元数据加载完成
      video.onloadedmetadata = () => {
        hasMetadataLoaded = true;
        checkAndResolve(); // 尝试返回结果
      };
    });
  } catch (error) {
    throw new Error(
      `Error getting video resolution: ${error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function cleanHtmlTags(text: string): string {
  if (!text) return '';

  const cleanedText = text
    .replace(/<[^>]+>/g, '\n') // 将 HTML 标签替换为换行
    .replace(/\n+/g, '\n') // 将多个连续换行合并为一个
    .replace(/[ \t]+/g, ' ') // 将多个连续空格和制表符合并为一个空格，但保留换行符
    .replace(/^\n+|\n+$/g, '') // 去掉首尾换行
    .trim(); // 去掉首尾空格

  // 使用 he 库解码 HTML 实体
  return he.decode(cleanedText);
}
