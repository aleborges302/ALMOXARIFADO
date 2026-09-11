-- =====================================================================
-- ALMOXARIFADO DA OFICINA — 01. ESTRUTURA
-- Rode este arquivo inteiro no SQL Editor do Supabase (uma vez só).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- perfis
-- Uma linha por usuário do sistema, criada automaticamente quando você
-- adiciona a pessoa em Authentication > Users no painel do Supabase.
create table if not exists public.perfis (
  id          uuid primary key references auth.users (id) on delete cascade,
  nome        text not null,
  papel       text not null default 'mecanico'
              check (papel in ('admin','almoxarife','mecanico','consulta')),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);
comment on table public.perfis is 'Usuários do almoxarifado e seu nível de acesso';
comment on column public.perfis.papel is
  'admin: tudo, inclusive usuários | almoxarife: lança tudo | mecanico: só requisita saída e retira ferramenta | consulta: só lê';

-- Cria o perfil assim que o usuário é criado no painel do Supabase.
create or replace function public.fn_novo_usuario()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfis (id, nome, papel)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data ->> 'papel', ''), 'mecanico')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists tg_novo_usuario on auth.users;
create trigger tg_novo_usuario
  after insert on auth.users
  for each row execute function public.fn_novo_usuario();

-- Papel do usuário logado. SECURITY DEFINER para não recursar nas políticas.
create or replace function public.papel()
returns text
language sql
stable
security definer set search_path = public
as $$
  select papel from public.perfis where id = auth.uid() and ativo
$$;

create or replace function public.nome_usuario()
returns text
language sql
stable
security definer set search_path = public
as $$
  select nome from public.perfis where id = auth.uid() and ativo
$$;

-- Quem pode gravar cadastros e lançamentos.
create or replace function public.pode_lancar()
returns boolean
language sql
stable
as $$ select public.papel() in ('admin','almoxarife') $$;

-- --------------------------------------------------------------- config
create table if not exists public.config (
  id            int primary key default 1 check (id = 1),
  empresa       text not null default '',
  obra          text not null default 'Oficina de manutenção',
  categorias    text[] not null default '{}',
  unidades      text[] not null default '{}',
  locais        text[] not null default '{}',
  tipos_frota   text[] not null default '{}',
  atualizado_em timestamptz not null default now()
);

-- --------------------------------------------------------- fornecedores
create table if not exists public.fornecedores (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null unique,
  cnpj      text,
  contato   text,
  telefone  text,
  email     text,
  obs       text,
  exemplo   boolean not null default false,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- frota
create table if not exists public.frota (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique,
  tipo          text,
  marca_modelo  text,
  placa         text,
  ano           text,
  local         text,
  ativo         boolean not null default true,
  exemplo       boolean not null default false,
  criado_em     timestamptz not null default now()
);

-- ---------------------------------------------------------------- itens
create table if not exists public.itens (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique,
  descricao     text not null,
  categoria     text,
  unidade       text not null default 'UN',
  local         text,
  estoque_min   numeric(14,3) not null default 0,
  estoque_max   numeric(14,3) not null default 0,
  saldo         numeric(14,3) not null default 0,
  custo_medio   numeric(14,4) not null default 0,
  aplicacao     text,
  fornecedor    text,
  ativo         boolean not null default true,
  exemplo       boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists ix_itens_categoria on public.itens (categoria);
create index if not exists ix_itens_local     on public.itens (local);
create index if not exists ix_itens_descricao on public.itens (descricao);

-- Saldo e custo médio só mudam por lançamento de movimento.
create or replace function public.fn_protege_saldo()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('almox.movimento', true), '') <> 'on' then
    new.saldo := old.saldo;
    new.custo_medio := old.custo_medio;
  end if;
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists tg_protege_saldo on public.itens;
create trigger tg_protege_saldo
  before update on public.itens
  for each row execute function public.fn_protege_saldo();

-- ----------------------------------------------------------- movimentos
create table if not exists public.movimentos (
  id              bigint generated always as identity primary key,
  data            date not null default current_date,
  tipo            text not null check (tipo in ('inicial','entrada','saida','devolucao','ajuste')),
  item_id         uuid not null references public.itens (id) on delete restrict,
  codigo          text not null,
  descricao       text,
  unidade         text,
  qtd             numeric(14,3) not null,
  vlr_unit        numeric(14,4) not null default 0,
  vlr_total       numeric(14,2) not null default 0,
  saldo_anterior  numeric(14,3),
  saldo_posterior numeric(14,3),
  os              text,
  frota           text,
  solicitante     text,
  fornecedor      text,
  nf              text,
  obs             text,
  usuario_id      uuid references public.perfis (id),
  usuario_nome    text,
  exemplo         boolean not null default false,
  criado_em       timestamptz not null default now()
);
create index if not exists ix_mov_data  on public.movimentos (data desc, id desc);
create index if not exists ix_mov_item  on public.movimentos (item_id);
create index if not exists ix_mov_os    on public.movimentos (os);
create index if not exists ix_mov_frota on public.movimentos (frota);
create index if not exists ix_mov_tipo  on public.movimentos (tipo);

-- ---------------------------------------------------------- ferramentas
create table if not exists public.ferramentas (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique,
  descricao     text not null,
  marca         text,
  patrimonio    text,
  quantidade    integer not null default 1 check (quantidade >= 0),
  local         text,
  obs           text,
  exemplo       boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.emprestimos (
  id             bigint generated always as identity primary key,
  ferramenta_id  uuid not null references public.ferramentas (id) on delete restrict,
  codigo         text not null,
  descricao      text,
  qtd            integer not null check (qtd > 0),
  retirado_em    date not null default current_date,
  previsao       date,
  retirado_por   text not null,
  os             text,
  frota          text,
  obs            text,
  situacao       text not null default 'aberto' check (situacao in ('aberto','devolvido','baixado')),
  devolvido_em   date,
  recebido_por   text,
  motivo         text,
  obs_devolucao  text,
  usuario_id     uuid references public.perfis (id),
  usuario_nome   text,
  exemplo        boolean not null default false,
  criado_em      timestamptz not null default now()
);
create index if not exists ix_emp_situacao on public.emprestimos (situacao);
create index if not exists ix_emp_ferr     on public.emprestimos (ferramenta_id);
create index if not exists ix_emp_data     on public.emprestimos (retirado_em desc);

-- ---------------------------------------------------------- inventários
create table if not exists public.inventarios (
  id           bigint generated always as identity primary key,
  data         date not null default current_date,
  responsavel  text,
  local        text,
  categoria    text,
  impacto      numeric(14,2) not null default 0,
  linhas       jsonb not null default '[]'::jsonb,
  usuario_id   uuid references public.perfis (id),
  criado_em    timestamptz not null default now()
);

-- ----------------------------------------------------------------- view
-- Disponibilidade real da ferramentaria: total menos o que está em campo.
create or replace view public.v_ferramentas
with (security_invoker = true) as
select f.*,
       coalesce(e.em_campo, 0)::int                                as em_campo,
       greatest(f.quantidade - coalesce(e.em_campo, 0), 0)::int    as disponivel
from public.ferramentas f
left join (
  select ferramenta_id, sum(qtd)::int as em_campo
  from public.emprestimos
  where situacao = 'aberto'
  group by ferramenta_id
) e on e.ferramenta_id = f.id;

-- Atualização ao vivo entre os usuários conectados.
do $$
begin
  begin
    alter publication supabase_realtime add table
      public.itens, public.movimentos, public.ferramentas,
      public.emprestimos, public.frota, public.fornecedores,
      public.config, public.perfis, public.inventarios;
  exception when duplicate_object then null;
  end;
end $$;
