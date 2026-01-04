-- Create storage bucket for processed videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('processed-videos', 'processed-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to processed videos
CREATE POLICY "Public read access for processed videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'processed-videos');

-- Allow service role to upload processed videos
CREATE POLICY "Service role can upload processed videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'processed-videos');

-- Allow service role to delete processed videos
CREATE POLICY "Service role can delete processed videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'processed-videos');