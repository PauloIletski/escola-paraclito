-- Extend account roles without modifying existing identities or enrollments.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('student','teacher','admin','super_admin'));
create table public.course_teachers (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  active boolean not null default true,
  primary key (teacher_id, course_id)
);
create index course_teachers_course on public.course_teachers(course_id);
alter table public.course_teachers enable row level security;
grant select, insert, update, delete on public.course_teachers to authenticated;
grant all on public.course_teachers to service_role;

alter table public.scores add column course_id uuid references public.courses(id);
create index scores_course on public.scores(course_id);

create function private.can_teach(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles p join public.course_teachers t on t.teacher_id = p.id
    where p.id = auth.uid() and p.active and not p.must_change_password
      and p.role = 'teacher' and t.course_id = target and t.active
  );
$$;
revoke all on function private.can_teach(uuid) from public;
grant execute on function private.can_teach(uuid) to authenticated;

create function private.can_teach_file(object_path text) returns boolean
language sql stable security invoker set search_path = '' as $$
  select case
    when split_part(object_path,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and position('/' in object_path) > 0
    then private.can_teach(split_part(object_path,'/',1)::uuid)
    else false end;
$$;
revoke all on function private.can_teach_file(text) from public;
grant execute on function private.can_teach_file(text) to authenticated;

create policy teacher_assignment_read on public.course_teachers for select to authenticated
  using (teacher_id = (select auth.uid()) and (select private.has_role('teacher')));
create policy teacher_assignment_manage on public.course_teachers for all to authenticated
  using ((select private.has_role('admin')))
  with check ((select private.has_role('admin')) and exists (
    select 1 from public.profiles p where p.id = teacher_id and p.role = 'teacher'
  ));
create policy teacher_profiles_read on public.profiles for select to authenticated
  using (role = 'teacher' and (select private.has_role('admin')));
create policy teacher_courses_read on public.courses for select to authenticated
  using (private.can_teach(id));
create policy teacher_lessons_read on public.lessons for select to authenticated
  using (private.can_teach(course_id));
create policy teacher_lessons_insert on public.lessons for insert to authenticated
  with check (private.can_teach(course_id));
create policy teacher_lessons_update on public.lessons for update to authenticated
  using (private.can_teach(course_id)) with check (private.can_teach(course_id));

create policy teacher_scores_read on public.scores for select to authenticated
  using (private.can_teach(course_id));
create policy teacher_scores_insert on public.scores for insert to authenticated
  with check (private.can_teach(course_id) and path like course_id::text || '/%');
create policy teacher_scores_update on public.scores for update to authenticated
  using (private.can_teach(course_id))
  with check (private.can_teach(course_id) and path like course_id::text || '/%');
create policy teacher_files_read on storage.objects for select to authenticated
  using (bucket_id = 'scores' and private.can_teach_file(name));
create policy teacher_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'scores' and private.can_teach_file(name));

