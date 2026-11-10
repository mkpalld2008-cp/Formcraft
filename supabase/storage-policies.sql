-- Run once in Supabase Dashboard → SQL Editor after creating the project.
-- The public bucket lets survey owners open uploaded attachments from results.
-- Anyone with a file URL can access that file, so do not collect highly sensitive documents.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'survey-uploads',
  'survey-uploads',
  true,
  10485760,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Allow anonymous survey attachment uploads"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'survey-uploads'
  and array_length(storage.foldername(name), 1) = 3
);
