-- Create the return-images storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'return-images', 
  'return-images', 
  true, 
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Create policies for the return-images bucket
CREATE POLICY "Allow authenticated users to upload return images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'return-images');

CREATE POLICY "Allow authenticated users to read return images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'return-images');

CREATE POLICY "Allow authenticated users to update their return images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'return-images');

CREATE POLICY "Allow authenticated users to delete their return images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'return-images');