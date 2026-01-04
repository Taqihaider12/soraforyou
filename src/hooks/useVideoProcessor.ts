import { useState, useCallback } from "react";
import { VideoItem, VideoStatus } from "@/types/video";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { removeWatermark, downloadProcessedVideo, ProcessingProgress } from "@/lib/videoProcessor";

export function useVideoProcessor() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const generateId = () => Math.random().toString(36).substring(2, 15);

  const addVideos = useCallback((links: string[]) => {
    const newVideos: VideoItem[] = links.map((url) => ({
      id: generateId(),
      originalUrl: url,
      status: "pending" as VideoStatus,
      progress: 0,
    }));

    setVideos((prev) => [...prev, ...newVideos]);
    toast.success(`Added ${links.length} video${links.length !== 1 ? "s" : ""} to queue`);
  }, []);

  const removeVideo = useCallback((id: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setVideos([]);
    toast.info("Queue cleared");
  }, []);

  const updateVideo = useCallback((id: string, updates: Partial<VideoItem>) => {
    setVideos((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...updates } : v))
    );
  }, []);

  const processVideo = async (video: VideoItem) => {
    // Step 1: Fetch video info from edge function
    updateVideo(video.id, { 
      status: "fetching", 
      progress: 5,
      progressMessage: "Fetching video info..." 
    });

    try {
      const { data, error } = await supabase.functions.invoke('process-sora-video', {
        body: { url: video.originalUrl }
      });

      if (error) {
        throw new Error(error.message || 'Failed to fetch video info');
      }
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to extract video URL');
      }

      updateVideo(video.id, { 
        status: "processing", 
        progress: 15,
        progressMessage: "Video URL extracted",
        thumbnailUrl: data.thumbnail,
        resolution: data.resolution,
      });

      // Step 2: Process with FFmpeg to remove watermark
      updateVideo(video.id, { 
        status: "removing-watermark", 
        progress: 20,
        progressMessage: "Loading video processor..." 
      });

      const fileName = data.fileName || `sora_${data.videoId}_no_watermark.mp4`;

      const processedBlob = await removeWatermark(
        data.downloadUrl,
        (progressInfo: ProcessingProgress) => {
          // Map FFmpeg progress to overall progress (20-95%)
          let overallProgress = 20;
          switch (progressInfo.stage) {
            case 'loading':
              overallProgress = 20 + (progressInfo.progress * 0.1);
              break;
            case 'downloading':
              overallProgress = 30 + (progressInfo.progress * 0.2);
              break;
            case 'processing':
            case 'encoding':
              overallProgress = 50 + (progressInfo.progress * 0.45);
              break;
            case 'complete':
              overallProgress = 95;
              break;
          }
          
          updateVideo(video.id, { 
            progress: Math.round(overallProgress),
            progressMessage: progressInfo.message 
          });
        }
      );

      // Step 3: Complete - create blob URL for download
      const blobUrl = URL.createObjectURL(processedBlob);
      
      updateVideo(video.id, {
        status: "completed",
        progress: 100,
        progressMessage: "Watermark removed!",
        fileName,
        downloadUrl: blobUrl,
        processedBlob,
      });

      toast.success(`Video processed: ${fileName}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process video';
      console.error('Video processing error:', error);
      updateVideo(video.id, {
        status: "error",
        error: errorMessage,
        progressMessage: undefined,
      });
    }
  };

  const processAll = useCallback(async () => {
    const pendingVideos = videos.filter((v) => v.status === "pending");
    
    if (pendingVideos.length === 0) {
      toast.info("No pending videos to process");
      return;
    }

    setIsProcessing(true);
    toast.info(`Processing ${pendingVideos.length} video${pendingVideos.length !== 1 ? "s" : ""}... This may take a few minutes.`);

    // Process videos sequentially to avoid memory issues
    for (const video of pendingVideos) {
      await processVideo(video);
    }

    setIsProcessing(false);
    toast.success("All videos processed!");
  }, [videos, updateVideo]);

  const retryVideo = useCallback(async (id: string) => {
    const video = videos.find((v) => v.id === id);
    if (!video) return;

    updateVideo(id, { status: "pending", progress: 0, error: undefined, progressMessage: undefined });
    setIsProcessing(true);
    await processVideo({ ...video, status: "pending", progress: 0 });
    setIsProcessing(false);
  }, [videos, updateVideo]);

  const downloadSingle = useCallback((video: VideoItem) => {
    if (video.processedBlob) {
      downloadProcessedVideo(video.processedBlob, video.fileName || 'sora_video.mp4');
    } else if (video.downloadUrl) {
      const link = document.createElement('a');
      link.href = video.downloadUrl;
      link.download = video.fileName || 'sora_video.mp4';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, []);

  const downloadAll = useCallback(() => {
    const completedVideos = videos.filter((v) => v.status === "completed" && (v.processedBlob || v.downloadUrl));
    
    if (completedVideos.length === 0) {
      toast.info("No completed videos to download");
      return;
    }

    // Download sequentially with delay
    completedVideos.forEach((video, index) => {
      setTimeout(() => {
        downloadSingle(video);
      }, index * 1000);
    });

    toast.success(`Downloading ${completedVideos.length} video${completedVideos.length !== 1 ? "s" : ""}...`);
  }, [videos, downloadSingle]);

  return {
    videos,
    isProcessing,
    addVideos,
    removeVideo,
    clearAll,
    processAll,
    retryVideo,
    downloadAll,
    downloadSingle,
  };
}
