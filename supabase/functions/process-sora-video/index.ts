import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SoraVideoRequest {
  url: string;
}

interface VideoInfo {
  videoUrl: string;
  title: string;
  thumbnail: string;
  resolution: string;
}

// Extract the video ID from Sora URL
function extractVideoId(url: string): string | null {
  const match = url.match(/\/p\/s_([a-f0-9]+)/);
  return match ? match[1] : null;
}

// Use Firecrawl to scrape the JavaScript-rendered page
async function scrapeWithFirecrawl(url: string): Promise<VideoInfo | null> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  
  if (!apiKey) {
    console.error('FIRECRAWL_API_KEY not configured');
    return null;
  }

  console.log(`Scraping with Firecrawl: ${url}`);

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        formats: ['html', 'links'],
        waitFor: 3000, // Wait for JavaScript to render
        onlyMainContent: false,
      }),
    });

    const result = await response.json();
    console.log('Firecrawl response status:', response.status);

    if (!response.ok || !result.success) {
      console.error('Firecrawl error:', result);
      return null;
    }

    const data = result.data || result;
    const html = data.html || '';
    const links = data.links || [];
    
    console.log(`Got HTML length: ${html.length}, links count: ${links.length}`);

    // Try to find video URL in the rendered HTML
    let videoUrl = extractVideoUrlFromHtml(html);
    
    // Also check links for video URLs
    if (!videoUrl) {
      videoUrl = findVideoUrlInLinks(links);
    }

    // Extract metadata
    const metadata = data.metadata || {};
    const title = metadata.title || metadata.ogTitle || 'Sora Video';
    const thumbnail = metadata.ogImage || '';

    if (videoUrl) {
      console.log(`Found video URL: ${videoUrl}`);
      return {
        videoUrl,
        title,
        thumbnail,
        resolution: '1080p',
      };
    }

    // If still no video URL, try to find it in the raw response
    console.log('Searching for video patterns in content...');
    const allContent = JSON.stringify(result);
    videoUrl = findVideoUrlInText(allContent);
    
    if (videoUrl) {
      console.log(`Found video URL in content: ${videoUrl}`);
      return {
        videoUrl,
        title,
        thumbnail,
        resolution: '1080p',
      };
    }

    console.log('Could not find video URL in Firecrawl response');
    return null;
  } catch (error) {
    console.error('Firecrawl scrape error:', error);
    return null;
  }
}

function extractVideoUrlFromHtml(html: string): string | null {
  // Pattern 1: Video source tags
  const videoSrcMatch = html.match(/<video[^>]*src=["']([^"']+)["']/i) ||
                        html.match(/<source[^>]+src=["']([^"']+)["'][^>]*type=["']video/i);
  if (videoSrcMatch) return cleanUrl(videoSrcMatch[1]);

  // Pattern 2: og:video meta tag
  const ogVideoMatch = html.match(/<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video["']/i);
  if (ogVideoMatch) return cleanUrl(ogVideoMatch[1]);

  // Pattern 3: JSON data with video URL
  const jsonVideoMatch = html.match(/"videoUrl"\s*:\s*"([^"]+)"/i) ||
                         html.match(/"video_url"\s*:\s*"([^"]+)"/i) ||
                         html.match(/"src"\s*:\s*"(https?:\/\/[^"]*\.mp4[^"]*)"/i) ||
                         html.match(/"url"\s*:\s*"(https?:\/\/[^"]*\.mp4[^"]*)"/i);
  if (jsonVideoMatch) return cleanUrl(jsonVideoMatch[1]);

  // Pattern 4: Direct MP4 URLs
  const mp4Match = html.match(/(https?:\/\/[^"'\s<>]+\.mp4[^"'\s<>]*)/i);
  if (mp4Match) return cleanUrl(mp4Match[1]);

  // Pattern 5: CDN/blob video URLs
  const cdnMatch = html.match(/(https?:\/\/[^"'\s<>]*(?:cdn|blob|video|media)[^"'\s<>]*\.mp4[^"'\s<>]*)/i);
  if (cdnMatch) return cleanUrl(cdnMatch[1]);

  // Pattern 6: OpenAI/Sora specific CDN patterns
  const openaiMatch = html.match(/(https?:\/\/[^"'\s<>]*openai[^"'\s<>]*\.mp4[^"'\s<>]*)/i) ||
                      html.match(/(https?:\/\/[^"'\s<>]*sora[^"'\s<>]*\.mp4[^"'\s<>]*)/i);
  if (openaiMatch) return cleanUrl(openaiMatch[1]);

  // Pattern 7: Any video-related URLs in data attributes
  const dataVideoMatch = html.match(/data-[^=]*=["'](https?:\/\/[^"']*\.mp4[^"']*)["']/i);
  if (dataVideoMatch) return cleanUrl(dataVideoMatch[1]);

  return null;
}

function findVideoUrlInLinks(links: string[]): string | null {
  for (const link of links) {
    if (link.includes('.mp4') || link.includes('video') || link.includes('media')) {
      console.log(`Found potential video link: ${link}`);
      return link;
    }
  }
  return null;
}

function findVideoUrlInText(text: string): string | null {
  // Look for MP4 URLs
  const mp4Match = text.match(/(https?:\/\/[^"'\s\\]+\.mp4[^"'\s\\]*)/i);
  if (mp4Match) return cleanUrl(mp4Match[1]);

  // Look for video CDN URLs
  const videoMatch = text.match(/(https?:\/\/[^"'\s\\]*(?:video|media|cdn|blob)[^"'\s\\]*)/i);
  if (videoMatch && isLikelyVideoUrl(videoMatch[1])) return cleanUrl(videoMatch[1]);

  return null;
}

function isLikelyVideoUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes('.mp4') || 
         lowerUrl.includes('.webm') || 
         lowerUrl.includes('.mov') ||
         (lowerUrl.includes('video') && !lowerUrl.includes('javascript'));
}

function cleanUrl(url: string): string {
  return url
    .replace(/\\u002F/g, '/')
    .replace(/\\/g, '')
    .replace(/&amp;/g, '&');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json() as SoraVideoRequest;
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing Sora URL: ${url}`);

    // Validate that it's a Sora URL
    if (!url.includes('sora.chatgpt.com')) {
      return new Response(
        JSON.stringify({ error: 'Invalid URL. Please provide a valid Sora video URL.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'Could not extract video ID from URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracted video ID: ${videoId}`);

    // Use Firecrawl to scrape the JavaScript-rendered page
    const videoInfo = await scrapeWithFirecrawl(url);

    if (!videoInfo) {
      return new Response(
        JSON.stringify({ 
          error: 'Could not extract video from URL. Sora uses advanced protection that prevents automated extraction.',
          suggestion: 'The video may require manual download from your browser, or the page structure has changed.',
          videoId,
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        originalUrl: url,
        downloadUrl: videoInfo.videoUrl,
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        resolution: videoInfo.resolution,
        fileName: `sora_${videoId.slice(0, 12)}_no_watermark.mp4`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing video:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to process video', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
