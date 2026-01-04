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
    // Update to fetching state
    updateVideo(video.id, { status: "fetching", progress: 10 });

    try {
      // Call edge function to fetch video info
      updateVideo(video.id, { progress: 30 });
      
      const { data, error } = await supabase.functions.invoke('process-sora-video', {
        body: { url: video.originalUrl }
      });

      if (error) {
        throw new Error(error.message || 'Failed to process video');
      }

      updateVideo(video.id, { status: "processing", progress: 50 });
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to extract video');
      }

      updateVideo(video.id, { progress: 70 });

      // Small delay for UX
      await new Promise((resolve) => setTimeout(resolve, 500));
      updateVideo(video.id, { progress: 90 });

      // Complete with actual download URL from edge function
      updateVideo(video.id, {
        status: "completed",
        progress: 100,
        fileName: data.fileName || `sora_${data.videoId}_no_watermark.mp4`,
        resolution: data.resolution || "1080p",
        downloadUrl: data.downloadUrl,
        thumbnailUrl: data.thumbnail,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process video';
      updateVideo(video.id, {
        status: "error",
        error: errorMessage,
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
    toast.info(`Processing ${pendingVideos.length} video${pendingVideos.length !== 1 ? "s" : ""}...`);

    // Process videos sequentially to avoid overwhelming the system
    for (const video of pendingVideos) {
      await processVideo(video);
    }

    setIsProcessing(false);
    toast.success("All videos processed!");
  }, [videos, updateVideo]);

  const retryVideo = useCallback(async (id: string) => {
    const video = videos.find((v) => v.id === id);
    if (!video) return;

    updateVideo(id, { status: "pending", progress: 0, error: undefined });
    setIsProcessing(true);
    await processVideo({ ...video, status: "pending", progress: 0 });
    setIsProcessing(false);
  }, [videos, updateVideo]);

  const downloadAll = useCallback(() => {
    const completedVideos = videos.filter((v) => v.status === "completed" && v.downloadUrl);
    
    if (completedVideos.length === 0) {
      toast.info("No completed videos to download");
      return;
    }

    // Trigger downloads
    completedVideos.forEach((video, index) => {
      setTimeout(() => {
        const link = document.createElement("a");
        link.href = video.downloadUrl!;
        link.download = video.fileName || `sora_video_${index + 1}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 500);
    });

    toast.success(`Downloading ${completedVideos.length} video${completedVideos.length !== 1 ? "s" : ""}...`);
  }, [videos]);

  return {
    videos,
    isProcessing,
    addVideos,
    removeVideo,
    clearAll,
    processAll,
    retryVideo,
    downloadAll,
  };
}
