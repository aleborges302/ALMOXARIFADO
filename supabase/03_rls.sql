-- =====================================================================
-- ALMOXARIFADO DA OFICINA — 03. SEGURANÇA (Row Level Security)
--
-- Regra geral: quem está logado e com perfil ativo LÊ tudo.
-- Gravar cadastro é do almoxarife e do admin.
-- Saldo, movimentos e empréstimos NÃO aceitam escrita direta: só pelas
-- funções do arquivo 02, que validam perfil, saldo e disponibilidade.
-- =====================================================================

alter table public.perfis        enable row level security;
alter table public.config        enable row level security;
alter table public.itens         enable row level security;
alter table public.movimentos    enable row level security;
alter table public.frota         enable row level security;
alter table public.fornecedores  enable row level security;
alter table public.ferramentas   enable row level security;
alter table public.emprestimos   enable row level security;
alter table public.inventarios   enable row level security;

-- ---------------------------------------------------------------- perfis
drop policy if exists perfis_leitura on public.perfis;
create policy perfis_leitura on public.perfis
  for select to authenticated using (true);

drop policy if exists perfis_proprio on public.perfis;
create policy perfis_proprio on public.perfis
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists perfis_admin on public.perfis;
create policy perfis_admin on public.perfis
  for all to authenticated
  using (public.papel() = 'admin') with check (public.papel() = 'admin');

-- Sem isso, qualquer usuário poderia se promover a admin editando o próprio
-- perfil: a política acima deixa a pessoa mexer na própria linha, e este
-- gatilho garante que papel e situação só mudam pela mão do administrador.
create or replace function public.fn_protege_papel()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if public.papel() <> 'admin' then
    new.papel := old.papel;
    new.ativo := old.ativo;
  end if;
  return new;
end $$;

drop trigger if exists tg_protege_papel on public.perfis;
create trigger tg_protege_papel
  before update on public.perfis
  for each row execute function public.fn_protege_papel();

-- --------------------------------------------------------------- config
drop policy if exists config_leitura on public.config;
create policy config_leitura on public.config
  for select to authenticated using (public.papel() is not null);

drop policy if exists config_escrita on public.config;
create policy config_escrita on public.config
  for all to authenticated
  using (public.pode_lancar()) with check (public.pode_lancar());

-- ------------------------- cadastros: itens, frota, fornecedores, ferramentas
do $$
declare t text;
begin
  foreach t in array array['itens','frota','fornecedores','ferramentas'] loop
    execute format('drop policy if exists %I on public.%I', t || '_leitura', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.papel() is not null)',
      t || '_leitura', t);

    execute format('drop policy if exists %I on public.%I', t || '_escrita', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.pode_lancar()) with check (public.pode_lancar())',
      t || '_escrita', t);
  end loop;
end $$;

-- ------------------------------- históricos: só leitura direta pelo app
drop policy if exists movimentos_leitura on public.movimentos;
create policy movimentos_leitura on public.movimentos
  for select to authenticated using (public.papel() is not null);

drop policy if exists emprestimos_leitura on public.emprestimos;
create policy emprestimos_leitura on public.emprestimos
  for select to authenticated using (public.papel() is not null);

drop policy if exists inventarios_leitura on public.inventarios;
create policy inventarios_leitura on public.inventarios
  for select to authenticated using (public.papel() is not null);

-- Nenhuma política de INSERT/UPDATE/DELETE nessas três tabelas: a escrita
-- acontece exclusivamente pelas funções SECURITY DEFINER, que rodam como
-- dono das tabelas. É isso que impede alguém de "corrigir" um saldo
-- direto no banco pelo navegador.

-- ------------------------------------------------ permissões das tabelas
-- Além do RLS: histórico não recebe nem privilégio de escrita.
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on
  public.itens, public.frota, public.fornecedores, public.ferramentas,
  public.config, public.perfis to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------------------------------------------- permissões das funções
revoke all on function public.registrar_movimento(text,text,numeric,numeric,date,text,text,text,text,text,text) from public;
revoke all on function public.registrar_retirada(text,integer,text,date,date,text,text,text) from public;
revoke all on function public.encerrar_emprestimo(bigint,text,date,text,text,text) from public;
revoke all on function public.aplicar_inventario(jsonb,text,text) from public;
revoke all on function public.recalcular_item(text) from public;
revoke all on function public.apagar_exemplos() from public;
revoke all on function public.importar_item(text,text,text,text,text,numeric,numeric,numeric,numeric,text,text,boolean) from public;
revoke all on function public.importar_movimento(jsonb) from public;

grant execute on function public.registrar_movimento(text,text,numeric,numeric,date,text,text,text,text,text,text) to authenticated;
grant execute on function public.registrar_retirada(text,integer,text,date,date,text,text,text) to authenticated;
grant execute on function public.encerrar_emprestimo(bigint,text,date,text,text,text) to authenticated;
grant execute on function public.aplicar_inventario(jsonb,text,text) to authenticated;
grant execute on function public.recalcular_item(text) to authenticated;
grant execute on function public.apagar_exemplos() to authenticated;
grant execute on function public.importar_item(text,text,text,text,text,numeric,numeric,numeric,numeric,text,text,boolean) to authenticated;
grant execute on function public.importar_movimento(jsonb) to authenticated;
grant execute on function public.papel() to authenticated;
grant execute on function public.nome_usuario() to authenticated;
grant execute on function public.pode_lancar() to authenticated;
