import { NextRequest, NextResponse } from 'next/server';

/**
 * 服务器端代理 API，用于解决 m3u8 文件的 CORS 跨域问题
 * GET /api/proxy/m3u8-content?url=<m3u8_url>
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const m3u8Url = searchParams.get('url');

    if (!m3u8Url) {
      return NextResponse.json(
        { error: 'Missing url parameter' },
        { status: 400 }
      );
    }

    // 验证 URL 格式
    let targetUrl: URL;
    try {
      targetUrl = new URL(m3u8Url);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // 只允许 http 和 https 协议
    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      return NextResponse.json(
        { error: 'Invalid URL protocol' },
        { status: 400 }
      );
    }

    console.log(`[M3U8代理] 请求: ${m3u8Url}`);

    // 通过服务器端请求 m3u8 文件
    const response = await fetch(m3u8Url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
      // 设置超时时间
      signal: AbortSignal.timeout(10000), // 10秒超时
    });

    if (!response.ok) {
      console.error(`[M3U8代理] 请求失败: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Failed to fetch m3u8: ${response.statusText}` },
        { status: response.status }
      );
    }

    const content = await response.text();
    console.log(`[M3U8代理] 成功获取内容，长度: ${content.length} 字节`);

    // 返回 m3u8 内容，设置正确的 Content-Type
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'public, max-age=60', // 缓存1分钟
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
      },
    });
  } catch (error) {
    console.error('[M3U8代理] 错误:', error);
    
    // 处理超时错误
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// 支持 OPTIONS 请求（CORS 预检）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}


