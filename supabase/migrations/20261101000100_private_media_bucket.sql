-- Private Supabase Storage bucket for personal photos and voice messages.
--
-- public = false: objects are never served from the public object URL.
-- No storage.objects policies are created for anon/authenticated, so the API
-- roles cannot list, read or write objects. The server uses the service key
-- (which bypasses RLS) only to upload during import and to create short-lived
-- signed URLs for media that belongs to an already opened door.
--
-- On plain Postgres (local tests, demo) the storage schema does not exist and
-- this migration is a no-op.

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'advent-private',
      'advent-private',
      false,
      26214400, -- 25 MB
      array['image/webp', 'image/jpeg', 'image/png',
            'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/wav']
    )
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end;
$$;
