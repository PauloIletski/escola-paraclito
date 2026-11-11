-- Desired schema. Generate a migration with the CLI after local validation.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 160),
  email text not null unique,
  whatsapp text not null check (whatsapp ~ '^[1-9][0-9]{7,14}$'),
  role text not null check (role in ('student','teacher','admin','super_admin')),
  active boolean not null default true,
  choir boolean not null default false,
  must_change_password boolean not null default true,
  provisioning_key uuid unique,
  created_at timestamptz not null default now()
);
create table public.courses (
  id uuid primary key default gen_random_uuid(), title text not null,
  description text not null default '', published boolean not null default false
);
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null, description text not null default '',
  position integer not null check (position >= 0),
  provider text not null default 'youtube' check (provider = 'youtube'),
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  published boolean not null default false
);
create index lessons_course_position on public.lessons(course_id, position);
create table public.course_enrollments (
  student_id uuid references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  active boolean not null default true,
  granted_at timestamptz not null default now(),
  primary key (student_id, course_id)
);
create index enrollments_course on public.course_enrollments(course_id);
create table public.lesson_progress (
  student_id uuid references public.profiles(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  primary key(student_id, lesson_id)
);
create index progress_lesson on public.lesson_progress(lesson_id);
create table public.scores (
  id uuid primary key default gen_random_uuid(), title text not null,
  bucket text not null default 'scores' check (bucket = 'scores'),
  path text not null unique, published boolean not null default false
);
create table public.site_settings (
  id integer primary key check (id = 1), about text not null default '',
    whatsapp text not null default '' check (whatsapp = '' or whatsapp ~ '^[1-9][0-9]{7,14}$'),
    hero_image_path text,
    hero_image_alt text not null default '',
    constraint hero_image_requires_alt check (hero_image_path is null or (length(trim(hero_image_path)) > 0 and length(trim(hero_image_alt)) > 0))
);
create table public.institutional_images (
  id uuid primary key default gen_random_uuid(),
  bucket text not null default 'institutional' check (bucket = 'institutional'),
  path text not null unique, alt text not null check (length(alt) > 0),
  position integer not null default 0 check (position >= 0), published boolean not null default false
);

-- Only these narrowly scoped internal predicates bypass RLS to avoid recursion.
-- Authorization reads current database state, never user-editable JWT metadata.
create function private.has_role(wanted text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles p where p.id = auth.uid()
    and p.active and not p.must_change_password and p.role = wanted
  );
$$;
create function private.active_student() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles p where p.id = auth.uid()
    and p.active and not p.must_change_password and p.role = 'student'
  );
$$;
create function private.can_study(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.active_student() and exists (
    select 1 from public.course_enrollments e join public.courses c on c.id = e.course_id
    where e.student_id = auth.uid() and e.course_id = target and e.active and c.published
  );
$$;
create function private.can_sing() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.active_student() and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.choir
  );
$$;
revoke all on function private.has_role(text), private.active_student(), private.can_study(uuid), private.can_sing() from public;
grant execute on function private.has_role(text), private.active_student(), private.can_study(uuid), private.can_sing() to authenticated, anon;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.scores enable row level security;
alter table public.site_settings enable row level security;
alter table public.institutional_images enable row level security;

grant select on public.profiles to authenticated;
grant select on public.courses, public.site_settings, public.institutional_images to anon, authenticated;
grant select, insert, update, delete on public.courses, public.lessons, public.course_enrollments,
  public.lesson_progress, public.scores, public.site_settings, public.institutional_images to authenticated;
grant all on public.profiles, public.courses, public.lessons, public.course_enrollments,
  public.lesson_progress, public.scores, public.site_settings, public.institutional_images to service_role;

create policy profiles_read on public.profiles for select to authenticated using (
  id = (select auth.uid()) or (role = 'student' and (select private.has_role('admin')))
  or (role = 'admin' and (select private.has_role('super_admin')))
);
-- Public course descriptions contain no lesson links or protected information.
create policy courses_public on public.courses for select to anon, authenticated using (published);
create policy courses_manage on public.courses for all to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));
create policy lessons_read on public.lessons for select to authenticated
  using (published and private.can_study(course_id));
create policy lessons_manage on public.lessons for all to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));
create policy enrollment_read on public.course_enrollments for select to authenticated
  using (student_id = (select auth.uid()) and (select private.active_student()));
create policy enrollment_manage on public.course_enrollments for all to authenticated
  using ((select private.has_role('admin')))
  with check ((select private.has_role('admin')) and exists (select 1 from public.profiles p where p.id = student_id and p.role = 'student'));
create policy progress_read on public.lesson_progress for select to authenticated using (
  student_id = (select auth.uid()) and exists (select 1 from public.lessons l where l.id = lesson_id and l.published and private.can_study(l.course_id))
);
create policy progress_insert on public.lesson_progress for insert to authenticated with check (
  student_id = (select auth.uid()) and exists (select 1 from public.lessons l where l.id = lesson_id and l.published and private.can_study(l.course_id))
);
create policy progress_update on public.lesson_progress for update to authenticated using (
  student_id = (select auth.uid()) and exists (select 1 from public.lessons l where l.id = lesson_id and l.published and private.can_study(l.course_id))
) with check (
  student_id = (select auth.uid()) and exists (select 1 from public.lessons l where l.id = lesson_id and l.published and private.can_study(l.course_id))
);
create policy scores_read on public.scores for select to authenticated using (published and (select private.can_sing()));
create policy scores_manage on public.scores for all to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));
create policy settings_public on public.site_settings for select to anon, authenticated using (true);
create policy settings_manage on public.site_settings for all to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));
create policy images_public on public.institutional_images for select to anon, authenticated using (published);
create policy images_manage on public.institutional_images for all to authenticated
  using ((select private.has_role('admin'))) with check ((select private.has_role('admin')));

-- Bucket configuration is kept here with policies to make deployment reproducible.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
  ('scores','scores',false,10485760,array['application/pdf']),
  ('institutional','institutional',true,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy scores_file_read on storage.objects for select to authenticated using (
  bucket_id = 'scores' and ((select private.has_role('admin')) or
    ((select private.can_sing()) and exists (select 1 from public.scores s where s.path = name and s.published)))
);
create policy files_insert on storage.objects for insert to authenticated with check (
  bucket_id in ('scores','institutional') and (select private.has_role('admin'))
);
create policy files_update on storage.objects for update to authenticated using (
  bucket_id in ('scores','institutional') and (select private.has_role('admin'))
) with check (bucket_id in ('scores','institutional') and (select private.has_role('admin')));
create policy files_delete on storage.objects for delete to authenticated using (
  bucket_id in ('scores','institutional') and (select private.has_role('admin'))
);
create policy institutional_file_read on storage.objects for select to anon, authenticated using (bucket_id = 'institutional');

-- Auth and application profile are created in the same database transaction.
-- Only the server-side admin endpoint sets raw_app_meta_data.school_profile.
create function private.on_account_created() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p jsonb := new.raw_app_meta_data -> 'school_profile';
begin
  if p is null then return new; end if;
  insert into public.profiles(id,name,email,whatsapp,role,choir,active,must_change_password,provisioning_key)
  values(new.id,p->>'name',new.email,p->>'whatsapp',p->>'role',coalesce((p->>'choir')::boolean,false),false,true,(p->>'request_id')::uuid)
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.on_account_created() from public, anon, authenticated;
create trigger school_profile_after_auth after insert or update of raw_app_meta_data on auth.users for each row execute function private.on_account_created();
