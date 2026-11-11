create or replace function private.on_account_created() returns trigger
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
drop trigger if exists school_profile_after_auth on auth.users;
create trigger school_profile_after_auth after insert or update of raw_app_meta_data on auth.users for each row execute function private.on_account_created();

