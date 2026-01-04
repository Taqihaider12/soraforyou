import { useState, useCallback } from "react";
import { VideoItem, VideoStatus } from "@/types/video";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
    updateVideo(video.id, { 
      status: "fetching", 
      progress: 10,
      progressMessage: "Sending to AI watermark remover..." 
    });

    try {
      // Simulate progress while waiting for API
      const progressInterval = setInterval(() => {
        setVideos(prev => prev.map(v => {
          if (v.id === video.id && v.status === "fetching" && v.progress < 80) {
            return { ...v, progress: Math.min(v.progress + 5, 80) };
          }
          if (v.id === video.id && v.status === "processing" && v.progress < 95) {
            return { ...v, progress: Math.min(v.progress + 2, 95) };
          }
          return v;
        }));
      }, 2000);

      updateVideo(video.id, { 
        status: "processing", 
        progress: 30,
        progressMessage: "AI is removing watermark..." 
      });

      const { data, error } = await supabase.functions.invoke('process-sora-video', {
        body: { url: video.originalUrl }
      });

      clearInterval(progressInterval);

      if (error) {
        throw new Error(error.message || 'Failed to process video');
      }
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to remove watermark');
      }

      updateVideo(video.id, {
        status: "completed",
        progress: 100,
        progressMessage: "Watermark removed!",
        fileName: data.fileName,
        resolution: data.resolution || "1080p",
        downloadUrl: data.downloadUrl,
      });

      toast.success(`Video processed: ${data.fileName}`);

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
    toast.info(`Processing ${pendingVideos.length} video${pendingVideos.length !== 1 ? "s" : ""}... This may take 1-2 minutes per video.`);

    // Process videos sequentially
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
    if (video.downloadUrl) {
      const link = document.createElement('a');
      link.href = video.downloadUrl;
      link.download = video.fileName || 'sora_video_no_watermark.mp4';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, []);

  const downloadAll = useCallback(() => {
    const completedVideos = videos.filter((v) => v.status === "completed" && v.downloadUrl);
    
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
