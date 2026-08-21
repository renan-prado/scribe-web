-- Admin role + soft-deactivation on profiles.
--
-- Adds two columns to public.profiles:
--   role       — 'user' (default) or 'admin'. Gates access to /backstage
--                and to the /api/admin/* routes. First admin is set
--                manually in the Supabase dashboard; subsequent admins
--                are promoted from the /backstage UI.
--   is_active  — soft-deactivation flag. Set to false to block a user
--                without cascading their sessions. Not enforced at the
--                DB layer (auth still succeeds); the app checks it in
--                the proxy on the next request.
--
-- Admin data access is done through the service-role Supabase client
-- from server routes only, so RLS on the domain tables stays exactly
-- as-is (per-user scoped). This migration therefore does NOT add
-- admin bypass policies — the service role bypasses RLS entirely.
--
-- The only RLS change is a WITH CHECK on profiles_update_own so users
-- cannot self-promote to admin. Role/is_active mutations go through
-- the admin API using service role.

alter table public.profiles
  add column if not exists role text not null default 'user'
    check (role in ('user', 'admin'));

alter table public.profiles
  add column if not exists is_active boolean not null default true;

create index if not exists profiles_role_idx on public.profiles (role) where role = 'admin';

-- Tighten the existing self-update policy so users cannot mutate
-- role or is_active on their own row. Everything else (display_name,
-- avatar_url, email) stays writable.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
    and is_active = (select is_active from public.profiles where id = auth.uid())
  );
