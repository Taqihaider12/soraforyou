import { VideoItem } from "@/types/video";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Download, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Trash2,
  Film,
  ExternalLink,
  Wand2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoCardProps {
  video: VideoItem;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onDownload: (video: VideoItem) => void;
}

const statusConfig = {
  pending: {
    icon: Clock,
    label: "Pending",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
  },
  fetching: {
    icon: Loader2,
    label: "Sending to AI...",
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
  processing: {
    icon: Wand2,
    label: "Removing watermark...",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  completed: {
    icon: CheckCircle2,
    label: "Ready to download",
    color: "text-success",
    bgColor: "bg-success/10",
  },
  error: {
    icon: XCircle,
    label: "Failed",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
};

export function VideoCard({ video, onRemove, onRetry, onDownload }: VideoCardProps) {
  const config = statusConfig[video.status];
  const StatusIcon = config.icon;
  const isLoading = video.status === "fetching" || video.status === "processing";

  const extractVideoId = (url: string) => {
    const match = url.match(/s_([a-f0-9]+)/);
    return match ? match[1].slice(0, 8) : "video";
  };

  return (
    <div className="glass-card rounded-xl p-4 animate-slide-up">
      <div className="flex items-start gap-4">
        {/* Thumbnail placeholder */}
        <div className="relative w-32 h-20 rounded-lg bg-secondary/50 flex items-center justify-center overflow-hidden shrink-0">
          {video.thumbnailUrl ? (
            <img 
              src={video.thumbnailUrl} 
              alt="Video thumbnail"
              className="w-full h-full object-cover"
            />
          ) : (
            <Film className="w-8 h-8 text-muted-foreground/50" />
          )}
          {video.resolution && (
            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-background/80 text-foreground">
              {video.resolution}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm text-foreground truncate">
              {video.fileName || `sora_${extractVideoId(video.originalUrl)}.mp4`}
            </span>
            <a 
              href={video.originalUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-1 rounded hover:bg-secondary transition-colors shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </a>
          </div>
          
          <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium mb-2", config.bgColor, config.color)}>
            <StatusIcon className={cn("w-3 h-3", isLoading && "animate-spin")} />
            <span>{video.progressMessage || config.label}</span>
          </div>

          {isLoading && (
            <div className="mt-2">
              <Progress value={video.progress} className="h-1.5" />
              <span className="text-xs text-muted-foreground mt-1 block">
                {video.progress}% - AI processing may take 1-2 minutes
              </span>
            </div>
          )}

          {video.error && (
            <p className="text-xs text-destructive mt-1">{video.error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {video.status === "completed" && (
            <Button 
              variant="success" 
              size="sm"
              onClick={() => onDownload(video)}
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
          )}
          
          {video.status === "error" && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onRetry(video.id)}
            >
              Retry
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(video.id)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
