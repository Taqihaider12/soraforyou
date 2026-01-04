import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SoraVideoRequest {
  url: string;
}

// Extract the video ID from Sora URL
function extractVideoId(url: string): string | null {
  const match = url.match(/\/p\/s_([a-f0-9]+)/);
  return match ? match[1] : null;
}

// Use Kie AI to remove watermark
async function removeWatermarkWithKieAI(soraUrl: string): Promise<{
  success: boolean;
  videoUrl?: string;
  error?: string;
}> {
  const apiKey = Deno.env.get('KIE_AI_API_KEY');
  
  if (!apiKey) {
    console.error('KIE_AI_API_KEY not configured');
    return { success: false, error: 'Kie AI API key not configured' };
  }

  console.log(`Calling Kie AI to remove watermark from: ${soraUrl}`);

  try {
    // Create task with Kie AI
    const createResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sora-watermark-remover',
        input: {
          video_url: soraUrl,
        },
      }),
    });

    const createResult = await createResponse.json();
    console.log('Kie AI create task response:', JSON.stringify(createResult));

    if (!createResponse.ok) {
      console.error('Kie AI error:', createResult);
      return { 
        success: false, 
        error: createResult.message || createResult.error || `Kie AI error: ${createResponse.status}` 
      };
    }

    // Check if we have a task ID to poll
    const taskId = createResult.data?.taskId || createResult.taskId;
    
    if (!taskId) {
      // Some APIs return the result directly
      if (createResult.data?.output?.video_url || createResult.output?.video_url) {
        const videoUrl = createResult.data?.output?.video_url || createResult.output?.video_url;
        console.log('Got video URL directly:', videoUrl);
        return { success: true, videoUrl };
      }
      
      console.error('No task ID in response:', createResult);
      return { success: false, error: 'Failed to create processing task' };
    }

    console.log(`Task created with ID: ${taskId}, polling for result...`);

    // Poll for task completion (max 60 seconds)
    const maxAttempts = 30;
    const pollInterval = 2000; // 2 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const statusResponse = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      const statusResult = await statusResponse.json();
      console.log(`Poll attempt ${attempt + 1}:`, JSON.stringify(statusResult));

      if (!statusResponse.ok || statusResult.code !== 200) {
        console.error('Status check error:', statusResult);
        continue;
      }

      const state = statusResult.data?.state;
      
      if (state === 'success') {
        // Parse resultJson which contains the URLs
        let videoUrl = null;
        try {
          const resultData = JSON.parse(statusResult.data?.resultJson || '{}');
          videoUrl = resultData.resultUrls?.[0] || resultData.video_url;
        } catch (e) {
          console.log('Could not parse resultJson, checking other fields');
        }
        
        // Fallback to other possible locations
        if (!videoUrl) {
          videoUrl = statusResult.data?.output?.video_url || 
                    statusResult.data?.result?.video_url;
        }
        
        if (videoUrl) {
          console.log('Watermark removal completed:', videoUrl);
          return { success: true, videoUrl };
        }
      }
      
      if (state === 'failed' || state === 'error') {
        const errorMsg = statusResult.data?.failMsg || statusResult.data?.error || 'Processing failed';
        console.error('Task failed:', errorMsg);
        return { success: false, error: errorMsg };
      }
      
      // Continue polling if still processing (state = 'pending' or 'processing')
      console.log(`Task state: ${state}, continuing to poll...`);
    }

    return { success: false, error: 'Processing timeout - please try again' };

  } catch (error) {
    console.error('Kie AI error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Kie AI error: ${errorMessage}` };
  }
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

    // Use Kie AI to remove watermark
    const result = await removeWatermarkWithKieAI(url);

    if (!result.success || !result.videoUrl) {
      return new Response(
        JSON.stringify({ 
          error: result.error || 'Failed to remove watermark',
          suggestion: 'Please ensure the video URL is valid and try again.',
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
        downloadUrl: result.videoUrl,
        resolution: '1080p',
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
