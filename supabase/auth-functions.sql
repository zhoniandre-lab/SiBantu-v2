-- Authentication/profile bootstrap for SiBantu V2.
-- Run after schema.sql.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, role, full_name, phone)
  values (
    new.id,
    'customer',
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), '')
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    phone = coalesce(excluded.phone, profiles.phone);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of raw_user_meta_data on auth.users
for each row execute function public.handle_new_user();

alter table public.seller_applications
  add column if not exists store_name text,
  add column if not exists whatsapp text,
  add column if not exists address_text text,
  add column if not exists category_slugs text[] not null default '{}';

create unique index if not exists one_open_seller_application
on public.seller_applications(applicant_id)
where status in ('pending','active');

-- A signed-in user may create/read their own seller application.
drop policy if exists "users submit seller applications" on public.seller_applications;
create policy "users submit seller applications"
on public.seller_applications for insert
to authenticated
with check (auth.uid() = applicant_id);

drop policy if exists "users read own seller applications" on public.seller_applications;
create policy "users read own seller applications"
on public.seller_applications for select
to authenticated
using (auth.uid() = applicant_id);

-- Admin helper. Run manually after approving an application.
create or replace function public.approve_seller_application(p_application_id uuid, p_admin_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application seller_applications%rowtype;
  v_store_id uuid;
  v_slug text;
begin
  select * into v_application from seller_applications where id = p_application_id for update;
  if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;

  if not exists (select 1 from profiles where id = p_admin_id and role = 'admin') then
    raise exception 'ADMIN_REQUIRED';
  end if;

  v_slug := 'mitra-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  insert into stores(owner_id, is_platform_store, name, slug, description, phone, whatsapp, address_text, status)
  values (
    v_application.applicant_id,
    false,
    coalesce(v_application.store_name, 'Toko Mitra SiBantu'),
    v_slug,
    coalesce(v_application.business_type, 'Mitra terverifikasi SiBantu'),
    coalesce(v_application.whatsapp, (select phone from profiles where id = v_application.applicant_id), '-'),
    coalesce(v_application.whatsapp, (select phone from profiles where id = v_application.applicant_id), '-'),
    coalesce(v_application.address_text, 'Alamat perlu dilengkapi oleh pedagang'),
    'active'
  ) returning id into v_store_id;

  insert into store_members(store_id, profile_id, member_role)
  values (v_store_id, v_application.applicant_id, 'owner');

  update seller_applications
  set status = 'active', store_id = v_store_id, reviewed_by = p_admin_id, reviewed_at = now()
  where id = p_application_id;

  update profiles set role = 'seller' where id = v_application.applicant_id;
  return v_store_id;
end;
$$;

revoke all on function public.approve_seller_application(uuid, uuid) from public, anon, authenticated;
grant execute on function public.approve_seller_application(uuid, uuid) to service_role;
