import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let ffmpegLoaded = false;

export type ProcessingProgress = {
  stage: 'loading' | 'downloading' | 'processing' | 'encoding' | 'complete';
  progress: number;
  message: string;
};

export async function loadFFmpeg(onProgress?: (progress: ProcessingProgress) => void): Promise<FFmpeg> {
  if (ffmpeg && ffmpegLoaded) {
    return ffmpeg;
  }

  ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }) => {
    console.log('[FFmpeg]', message);
  });

  ffmpeg.on('progress', ({ progress }) => {
    onProgress?.({
      stage: 'encoding',
      progress: Math.round(progress * 100),
      message: `Encoding video: ${Math.round(progress * 100)}%`,
    });
  });

  onProgress?.({
    stage: 'loading',
    progress: 0,
    message: 'Loading video processor...',
  });

  // Load FFmpeg WASM from CDN
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegLoaded = true;
  
  onProgress?.({
    stage: 'loading',
    progress: 100,
    message: 'Video processor ready',
  });

  return ffmpeg;
}

export async function removeWatermark(
  videoUrl: string,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<Blob> {
  const ff = await loadFFmpeg(onProgress);

  // Download the video
  onProgress?.({
    stage: 'downloading',
    progress: 0,
    message: 'Downloading video...',
  });

  const videoData = await fetchFile(videoUrl);
  
  onProgress?.({
    stage: 'downloading',
    progress: 100,
    message: 'Video downloaded',
  });

  // Write input file
  await ff.writeFile('input.mp4', videoData);

  onProgress?.({
    stage: 'processing',
    progress: 0,
    message: 'Processing video to remove watermark...',
  });

  // The Sora watermark is in the bottom-right corner
  // We'll use a delogo filter to blur that region
  // Typical Sora watermark is approximately:
  // - Position: bottom-right corner
  // - Size: roughly 150x40 pixels for 1080p video
  // - We apply blur to that region
  
  // FFmpeg command to blur bottom-right corner (watermark area)
  // Using delogo filter: x, y, width, height positions from bottom-right
  // For 1080p (1920x1080): watermark roughly at x=1720, y=1020, w=180, h=50
  // We'll use percentage-based positioning for different resolutions
  
  await ff.exec([
    '-i', 'input.mp4',
    '-vf', 
    // Apply blur to bottom-right corner (watermark region)
    // Using overlay with a blurred version of that region
    'split[original][blur];' +
    '[blur]crop=iw*0.12:ih*0.06:iw*0.88:ih*0.94,boxblur=15:15[blurred];' +
    '[original][blurred]overlay=W*0.88:H*0.94',
    '-c:a', 'copy', // Keep original audio
    '-preset', 'ultrafast', // Fast encoding
    '-crf', '18', // High quality
    'output.mp4'
  ]);

  onProgress?.({
    stage: 'complete',
    progress: 100,
    message: 'Watermark removed successfully!',
  });

  // Read the output file
  const outputData = await ff.readFile('output.mp4');
  
  // Clean up
  await ff.deleteFile('input.mp4');
  await ff.deleteFile('output.mp4');

  // Convert to Blob
  if (outputData instanceof Uint8Array) {
    // Create a new array to ensure we have a proper ArrayBuffer
    const copy = new Uint8Array(outputData.length);
    copy.set(outputData);
    return new Blob([copy], { type: 'video/mp4' });
  } else {
    return new Blob([new TextEncoder().encode(outputData)], { type: 'video/mp4' });
  }
}

export async function downloadProcessedVideo(blob: Blob, fileName: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
