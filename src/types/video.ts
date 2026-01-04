export type VideoStatus = 'pending' | 'fetching' | 'processing' | 'completed' | 'error';

export interface VideoItem {
  id: string;
  originalUrl: string;
  status: VideoStatus;
  progress: number;
  thumbnailUrl?: string;
  downloadUrl?: string;
  fileName?: string;
  error?: string;
  resolution?: string;
  duration?: string;
}
