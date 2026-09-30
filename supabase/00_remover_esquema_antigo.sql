-- Remove o esquema anterior (tabelas vazias) antes de aplicar esquema.sql.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.propostas cascade;
drop table if exists public.projetos cascade;
drop table if exists public.profiles cascade;
