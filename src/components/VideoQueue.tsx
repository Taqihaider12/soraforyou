import { VideoItem } from "@/types/video";
import { VideoCard } from "./VideoCard";
import { Button } from "@/components/ui/button";
import { Download, Play, Trash2, CheckCircle2 } from "lucide-react";

interface VideoQueueProps {
  videos: VideoItem[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onClearAll: () => void;
  onProcessAll: () => void;
  onDownloadAll: () => void;
  onDownloadSingle: (video: VideoItem) => void;
  isProcessing: boolean;
}

export function VideoQueue({
  videos,
  onRemove,
  onRetry,
  onClearAll,
  onProcessAll,
  onDownloadAll,
  onDownloadSingle,
  isProcessing,
}: VideoQueueProps) {
  const pendingCount = videos.filter((v) => v.status === "pending").length;
  const completedCount = videos.filter((v) => v.status === "completed").length;
  const processingCount = videos.filter(
    (v) => v.status === "fetching" || v.status === "processing" || v.status === "removing-watermark"
  ).length;

  if (videos.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center animate-fade-in">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-secondary/50 flex items-center justify-center">
          <Download className="w-10 h-10 text-muted-foreground/50" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          No videos in queue
        </h3>
        <p className="text-muted-foreground">
          Paste Sora video links above to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Queue header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-foreground">
            Video Queue
          </h2>
          <div className="flex items-center gap-3 text-sm">
            {pendingCount > 0 && (
              <span className="text-muted-foreground">
                {pendingCount} pending
              </span>
            )}
            {processingCount > 0 && (
              <span className="text-primary">
                {processingCount} processing
              </span>
            )}
            {completedCount > 0 && (
              <span className="text-success flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                {completedCount} ready
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>

          {pendingCount > 0 && (
            <Button
              variant="hero"
              size="default"
              onClick={onProcessAll}
              disabled={isProcessing}
            >
              <Play className="w-4 h-4" />
              Process {pendingCount} Video{pendingCount !== 1 ? "s" : ""}
            </Button>
          )}

          {completedCount > 0 && (
            <Button
              variant="success"
              size="default"
              onClick={onDownloadAll}
            >
              <Download className="w-4 h-4" />
              Download All ({completedCount})
            </Button>
          )}
        </div>
      </div>

      {/* Video cards */}
      <div className="space-y-3">
        {videos.map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            onRemove={onRemove}
            onRetry={onRetry}
            onDownload={onDownloadSingle}
          />
        ))}
      </div>
    </div>
  );
}
