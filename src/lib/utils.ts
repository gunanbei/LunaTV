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
/**
 * 获取 m3u8 内容，支持 CORS 跨域处理
 * @param m3u8Url m3u8 文件 URL
 * @returns m3u8 文件内容
 */
async function fetchM3u8Content(m3u8Url: string): Promise<string> {
  try {
    // 首先尝试直接请求
    const response = await fetch(m3u8Url);
    if (response.ok) {
      return await response.text();
    }
    throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    // 如果直接请求失败，尝试通过服务器端代理
    console.log('[M3U8获取] 直接请求失败，尝试使用服务器代理:', error);
    
    try {
      const proxyUrl = `/api/proxy/m3u8-content?url=${encodeURIComponent(m3u8Url)}`;
      const proxyResponse = await fetch(proxyUrl);
      
      if (proxyResponse.ok) {
        console.log('[M3U8获取] 服务器代理请求成功');
        return await proxyResponse.text();
      }
      
      throw new Error(`Proxy failed: HTTP ${proxyResponse.status}`);
    } catch (proxyError) {
      console.error('[M3U8获取] 服务器代理也失败:', proxyError);
      throw proxyError;
    }
  }
}

export async function getVideoResolutionFromM3u8(m3u8Url: string): Promise<{
  quality: string; // 如720p、1080p等
  loadSpeed: string; // 自动转换为KB/s或MB/s
  pingTime: number; // 网络延迟（毫秒）
}> {
  try {
    // 并行执行：同时启动 M3U8 解析和 HLS 测速
    let m3u8Width = 0;
    
    // 启动 M3U8 解析（异步，不等待）
    const m3u8ParsePromise = (async () => {
      try {
        const m3u8Content = await fetchM3u8Content(m3u8Url);
        const width = parseResolutionFromM3u8(m3u8Content);
        m3u8Width = width;
        return width;
      } catch (error) {
        console.log('[M3U8解析] 无法获取m3u8内容:', error);
        return 0;
      }
    })();

    // 同时启动 HLS 测速（不等待 M3U8 解析完成）
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
      const checkAndResolve = async () => {
        if (
          hasMetadataLoaded &&
          (hasSpeedCalculated || actualLoadSpeed !== '未知')
        ) {
          clearTimeout(timeout);
          hls.destroy();
          video.remove();

          // 等待 M3U8 解析完成（如果还没完成的话）
          // 使用 Promise.race 设置最大等待时间，避免无限等待
          try {
            await Promise.race([
              m3u8ParsePromise,
              new Promise(resolve => setTimeout(() => resolve(0), 1000)) // 最多等待1秒
            ]);
          } catch (error) {
            console.log('[M3U8解析] 等待M3U8解析时出错:', error);
          }

          let finalWidth = 0;
          let source = '';
          const height = video.videoHeight || 0;

          // 优先级1：优先使用 m3u8 解析的宽度
          if (m3u8Width > 0) {
            finalWidth = m3u8Width;
            source = 'M3U8解析';
          } 
          // 优先级2：如果 m3u8 没有，使用视频元数据
          else if (video.videoWidth > 0) {
            finalWidth = video.videoWidth;
            source = '视频元数据';
          }
          // 优先级3：都无法获取
          else {
            finalWidth = 0;
            source = '无法获取';
          }

          const quality = getQualityFromWidth(finalWidth);

          // 输出调试信息，方便排查检测问题
          console.log(`[清晰度检测] 宽度: ${finalWidth}px, 高度: ${height}px, 质量: ${quality}, 来源: ${source}`);

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
