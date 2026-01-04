import { useState, useCallback } from "react";
import { VideoItem, VideoStatus } from "@/types/video";
import { toast } from "sonner";

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
      // Simulate fetching video info
      await new Promise((resolve) => setTimeout(resolve, 1000));
      updateVideo(video.id, { progress: 30 });

      // Simulate processing
      updateVideo(video.id, { status: "processing", progress: 50 });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      updateVideo(video.id, { progress: 70 });

      await new Promise((resolve) => setTimeout(resolve, 1000));
      updateVideo(video.id, { progress: 90 });

      // Extract video ID for filename
      const match = video.originalUrl.match(/s_([a-f0-9]+)/);
      const videoId = match ? match[1].slice(0, 12) : "video";

      // Complete - in real implementation, this would have the actual download URL
      updateVideo(video.id, {
        status: "completed",
        progress: 100,
        fileName: `sora_${videoId}_no_watermark.mp4`,
        resolution: "1080p",
        // In production, this would be the actual processed video URL
        downloadUrl: video.originalUrl,
      });
    } catch (error) {
      updateVideo(video.id, {
        status: "error",
        error: "Failed to process video. Please try again.",
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
