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
  duration: string;
}

// Extract the video ID from Sora URL
function extractVideoId(url: string): string | null {
  const match = url.match(/\/p\/s_([a-f0-9]+)/);
  return match ? match[1] : null;
}

// Fetch the Sora page to extract video metadata
async function fetchSoraPageData(url: string): Promise<VideoInfo | null> {
  try {
    console.log(`Fetching Sora page: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch page: ${response.status}`);
      return null;
    }

    const html = await response.text();
    console.log(`Got HTML response, length: ${html.length}`);

    // Try to extract video URL from the page
    // Look for video sources in various patterns
    
    // Pattern 1: Direct video URL in meta tags
    const ogVideoMatch = html.match(/<meta[^>]+property="og:video"[^>]+content="([^"]+)"/i) ||
                         html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:video"/i);
    
    // Pattern 2: Video URL in script data
    const scriptDataMatch = html.match(/"videoUrl"\s*:\s*"([^"]+)"/i) ||
                           html.match(/"video_url"\s*:\s*"([^"]+)"/i) ||
                           html.match(/"url"\s*:\s*"(https?:\/\/[^"]*\.mp4[^"]*)"/i);
    
    // Pattern 3: Video source in video tag
    const videoSrcMatch = html.match(/<video[^>]*src="([^"]+)"/i) ||
                          html.match(/<source[^>]+src="([^"]+)"[^>]*type="video/i);
    
    // Pattern 4: CDN URLs
    const cdnMatch = html.match(/(https?:\/\/[^"'\s]+cdn[^"'\s]*\.mp4[^"'\s]*)/i) ||
                     html.match(/(https?:\/\/[^"'\s]+videos?[^"'\s]*\.mp4[^"'\s]*)/i);

    // Pattern 5: Look for any MP4 URL
    const mp4Match = html.match(/(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/i);

    // Pattern 6: Look for blob or stream URLs
    const streamMatch = html.match(/(https?:\/\/[^"'\s]+\/v1\/[^"'\s]+)/i) ||
                        html.match(/(https?:\/\/[^"'\s]+stream[^"'\s]*)/i);

    let videoUrl = ogVideoMatch?.[1] || 
                   scriptDataMatch?.[1] || 
                   videoSrcMatch?.[1] || 
                   cdnMatch?.[1] || 
                   mp4Match?.[1] ||
                   streamMatch?.[1];

    // Extract thumbnail
    const thumbnailMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ||
                          html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i) ||
                          html.match(/"thumbnail"\s*:\s*"([^"]+)"/i);

    // Extract title
    const titleMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) ||
                      html.match(/<title>([^<]+)<\/title>/i);

    if (videoUrl) {
      // Clean up the URL (unescape if needed)
      videoUrl = videoUrl.replace(/\\u002F/g, '/').replace(/\\/g, '');
      
      console.log(`Found video URL: ${videoUrl}`);
      
      return {
        videoUrl,
        title: titleMatch?.[1] || 'Sora Video',
        thumbnail: thumbnailMatch?.[1] || '',
        resolution: '1080p',
        duration: 'Unknown',
      };
    }

    // If no direct video URL found, try to get it from API endpoint
    console.log('No direct video URL found, attempting API extraction...');
    
    // Look for API data in Next.js/React hydration data
    const hydrationMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/i);
    if (hydrationMatch) {
      try {
        const data = JSON.parse(hydrationMatch[1]);
        console.log('Found Next.js data');
        // Navigate the data structure to find video URL
        const findVideoUrl = (obj: any): string | null => {
          if (!obj || typeof obj !== 'object') return null;
          if (obj.videoUrl) return obj.videoUrl;
          if (obj.video_url) return obj.video_url;
          if (obj.url && typeof obj.url === 'string' && obj.url.includes('mp4')) return obj.url;
          for (const key of Object.keys(obj)) {
            const result = findVideoUrl(obj[key]);
            if (result) return result;
          }
          return null;
        };
        const foundUrl = findVideoUrl(data);
        if (foundUrl) {
          return {
            videoUrl: foundUrl,
            title: titleMatch?.[1] || 'Sora Video',
            thumbnail: thumbnailMatch?.[1] || '',
            resolution: '1080p',
            duration: 'Unknown',
          };
        }
      } catch (e) {
        console.error('Failed to parse hydration data:', e);
      }
    }

    console.log('Could not find video URL in page');
    return null;
  } catch (error) {
    console.error(`Error fetching Sora page:`, error);
    return null;
  }
}

// Alternative approach: Use a video extraction API pattern
async function fetchVideoViaApi(url: string): Promise<VideoInfo | null> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    console.error('Could not extract video ID from URL');
    return null;
  }

  console.log(`Extracted video ID: ${videoId}`);

  // Try various API endpoints that might provide the video
  const apiPatterns = [
    `https://sora.chatgpt.com/api/v1/video/${videoId}`,
    `https://sora.chatgpt.com/api/video/${videoId}`,
    `https://sora.chatgpt.com/p/s_${videoId}/video`,
  ];

  for (const apiUrl of apiPatterns) {
    try {
      console.log(`Trying API: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, */*',
          'Referer': url,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.videoUrl || data.url || data.video_url) {
          return {
            videoUrl: data.videoUrl || data.url || data.video_url,
            title: data.title || 'Sora Video',
            thumbnail: data.thumbnail || '',
            resolution: data.resolution || '1080p',
            duration: data.duration || 'Unknown',
          };
        }
      }
    } catch (e) {
      console.log(`API ${apiUrl} failed:`, e);
    }
  }

  return null;
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

    // Try to fetch video info from the page
    let videoInfo = await fetchSoraPageData(url);
    
    // If that fails, try the API approach
    if (!videoInfo) {
      videoInfo = await fetchVideoViaApi(url);
    }

    if (!videoInfo) {
      return new Response(
        JSON.stringify({ 
          error: 'Could not extract video from URL. The video may be private or the URL format has changed.',
          suggestion: 'Please ensure the video is publicly accessible and try again.'
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const videoId = extractVideoId(url) || 'unknown';

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
