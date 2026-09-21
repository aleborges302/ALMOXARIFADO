-- =====================================================================
-- ALMOXARIFADO DA OFICINA — 05. CADASTRO DE USUÁRIO PELO SISTEMA
--
-- Rode este arquivo inteiro no SQL Editor do Supabase, uma vez.
-- Ele faz três coisas:
--   1. Fecha duas brechas de segurança que existiam no cadastro de usuário.
--   2. Faz todo usuário novo nascer BLOQUEADO e como mecânico.
--   3. Cria a função que a Edge Function usa para definir nome e perfil.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Usuário novo nasce bloqueado e sempre como mecânico
--
-- Antes, o perfil vinha de raw_user_meta_data — que é preenchido pelo
-- próprio navegador de quem se cadastra. Quem descobrisse a chave pública
-- do site poderia criar uma conta já como 'admin'. Agora o gatilho ignora
-- o que vem do navegador: todo mundo entra como mecânico e BLOQUEADO, e
-- só o administrador libera.
-- ---------------------------------------------------------------------
create or replace function public.fn_novo_usuario()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfis (id, nome, papel, ativo)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)),
    'mecanico',
    false
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. Correção da proteção de perfil
--
-- A versão anterior testava  public.papel() <> 'admin'.  Para quem está
-- bloqueado, papel() devolve NULL, e NULL <> 'admin' não é verdadeiro nem
-- falso — resultado: a proteção era pulada e um usuário bloqueado
-- conseguia se auto-liberar e se promover a admin editando a própria
-- linha. O coalesce abaixo resolve.
--
-- A trava 'almox.perfil' é a porta de serviço usada pela função do
-- item 3, do mesmo jeito que 'almox.movimento' protege o saldo.
-- ---------------------------------------------------------------------
create or replace function public.fn_protege_papel()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if coalesce(current_setting('almox.perfil', true), '') <> 'on'
     and coalesce(public.papel(), '') <> 'admin' then
    new.papel := old.papel;
    new.ativo := old.ativo;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. Quem está bloqueado não enxerga a lista de usuários
-- ---------------------------------------------------------------------
drop policy if exists perfis_leitura on public.perfis;
create policy perfis_leitura on public.perfis
  for select to authenticated
  using (public.papel() is not null or id = auth.uid());

-- ---------------------------------------------------------------------
-- 4. Função usada pela Edge Function 'usuarios'
--
-- Só a Edge Function consegue chamar: o privilégio é dado apenas ao papel
-- service_role, que existe no servidor do Supabase e nunca no navegador.
-- É ela que grava nome, perfil e situação do usuário recém-criado.
-- ---------------------------------------------------------------------
create or replace function public.definir_perfil_admin(
  p_id    uuid,
  p_nome  text,
  p_papel text,
  p_ativo boolean default true
) returns public.perfis
language plpgsql
security definer set search_path = public
as $$
declare v_p public.perfis%rowtype;
begin
  if p_papel not in ('admin','almoxarife','mecanico','consulta') then
    raise exception 'Perfil inválido: %', p_papel;
  end if;

  perform set_config('almox.perfil', 'on', true);

  insert into public.perfis (id, nome, papel, ativo)
  values (p_id, coalesce(nullif(trim(p_nome), ''), 'Usuário'), p_papel, coalesce(p_ativo, true))
  on conflict (id) do update
     set nome  = excluded.nome,
         papel = excluded.papel,
         ativo = excluded.ativo
  returning * into v_p;

  perform set_config('almox.perfil', 'off', true);
  return v_p;
end $$;

revoke all on function public.definir_perfil_admin(uuid,text,text,boolean)
  from public, anon, authenticated;
grant execute on function public.definir_perfil_admin(uuid,text,text,boolean)
  to service_role;

-- ---------------------------------------------------------------------
-- 5. Garantia explícita de acesso do service_role (usado só pela Edge
--    Function, dentro do servidor do Supabase). Normalmente já vem assim;
--    deixar escrito evita surpresa.
-- ---------------------------------------------------------------------
grant usage on schema public to service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------
-- 6. Conferência — deve devolver o administrador ativo e mais ninguém
--    com perfil elevado.
-- ---------------------------------------------------------------------
select nome, papel, ativo from public.perfis order by papel, nome;
