-- =====================================================================
-- ALMOXARIFADO DA OFICINA — 09. CONTROLE DE LUBRIFICAÇÃO
--
-- Rode este arquivo inteiro no SQL Editor do Supabase, uma vez.
--
-- COMO FUNCIONA
--
-- Cada equipamento tem uma CARTA DE LUBRIFICAÇÃO: a lista dos pontos que
-- precisam de lubrificante, com o que aplicar, quanto, e de quanto em
-- quanto tempo.
--
-- Cada ponto pode ter até três intervalos ao mesmo tempo — horas de
-- horímetro, litros de combustível abastecido e dias de calendário — e
-- VENCE PELO QUE CHEGAR PRIMEIRO. É a regra do próprio manual da
-- Caterpillar: "use whichever of the following occurs first: fuel
-- consumption, service hours, and calendar time". Máquina parada também
-- envelhece o óleo, por isso o calendário entra junto.
--
-- Quando a lubrificação é executada, o lubrificante SAI DO ESTOQUE pela
-- mesma função registrar_movimento que o resto do sistema usa: entra no
-- custo daquela máquina e aparece no botão "Peças" da tela de Frota.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Leituras: horímetro e abastecimento
--
-- horimetro é LEITURA (acumulada, o que está no painel da máquina).
-- litros é INCREMENTO (o que entrou naquele abastecimento).
-- Uma linha pode ter os dois, ou só um.
-- ---------------------------------------------------------------------
create table if not exists public.lub_leituras (
  id           bigint generated always as identity primary key,
  frota_id     uuid not null references public.frota (id) on delete cascade,
  frota        text not null,
  data         date not null default current_date,
  horimetro    numeric(14,2),
  litros       numeric(14,2),
  obs          text,
  usuario_id   uuid references public.perfis (id),
  usuario_nome text,
  criado_em    timestamptz not null default now(),
  check (horimetro is not null or litros is not null)
);
create index if not exists ix_lubl_frota on public.lub_leituras (frota_id, data desc);

-- ---------------------------------------------------------------------
-- 2. Pontos de lubrificação (a carta)
--
-- ultima_horas / ultima_litros / ultima_data marcam de onde conta o
-- próximo vencimento. Na implantação você preenche com a situação atual;
-- depois disso quem atualiza é a execução.
-- ---------------------------------------------------------------------
create table if not exists public.lub_pontos (
  id             uuid primary key default gen_random_uuid(),
  frota_id       uuid not null references public.frota (id) on delete cascade,
  frota          text not null,
  ordem          int  not null default 1,
  componente     text not null,
  item_codigo    text references public.itens (codigo) on delete set null,
  lubrificante   text,
  qtd            numeric(14,3) not null default 0,
  unidade        text,
  metodo         text not null default 'graxa'
                 check (metodo in ('graxa','troca','completar','filtro','inspecao')),
  int_horas      numeric(14,2),
  int_litros     numeric(14,2),
  int_dias       int,
  criticidade    text not null default 'media' check (criticidade in ('baixa','media','alta')),
  procedimento   text,
  ultima_horas   numeric(14,2),
  ultima_litros  numeric(14,2),
  ultima_data    date,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  check (coalesce(int_horas,0) > 0 or coalesce(int_litros,0) > 0 or coalesce(int_dias,0) > 0)
);
create index if not exists ix_lubp_frota on public.lub_pontos (frota_id, ordem);

comment on column public.lub_pontos.metodo is
  'graxa: engraxadeira | troca: drenar e abastecer | completar: acertar nivel | filtro: troca de filtro | inspecao: so conferir';

-- ---------------------------------------------------------------------
-- 3. Execuções
-- ---------------------------------------------------------------------
create table if not exists public.lub_execucoes (
  id            bigint generated always as identity primary key,
  ponto_id      uuid not null references public.lub_pontos (id) on delete cascade,
  frota_id      uuid not null references public.frota (id) on delete cascade,
  frota         text not null,
  componente    text,
  data          date not null default current_date,
  horimetro     numeric(14,2),
  litros_acum   numeric(14,2),
  qtd           numeric(14,3) not null default 0,
  item_codigo   text,
  movimento_id  bigint references public.movimentos (id) on delete set null,
  responsavel   text,
  obs           text,
  usuario_id    uuid references public.perfis (id),
  usuario_nome  text,
  criado_em     timestamptz not null default now()
);
create index if not exists ix_lube_ponto on public.lub_execucoes (ponto_id, data desc);
create index if not exists ix_lube_frota on public.lub_execucoes (frota_id, data desc);

-- ---------------------------------------------------------------------
-- 4. Situação atual de cada ponto
--
-- Calcula o quanto já correu desde a última execução em cada uma das três
-- réguas, e fica com a pior delas. 1,0 = venceu.
-- ---------------------------------------------------------------------
create or replace view public.v_lub_status
with (security_invoker = true) as
with atual as (
  select f.id as frota_id,
         coalesce(max(l.horimetro), 0)::numeric as horas_atuais,
         coalesce(sum(l.litros), 0)::numeric    as litros_atuais
  from public.frota f
  left join public.lub_leituras l on l.frota_id = f.id
  group by f.id
)
select p.*,
       a.horas_atuais,
       a.litros_atuais,
       greatest(a.horas_atuais  - coalesce(p.ultima_horas,  a.horas_atuais),  0) as horas_desde,
       greatest(a.litros_atuais - coalesce(p.ultima_litros, a.litros_atuais), 0) as litros_desde,
       greatest(current_date    - coalesce(p.ultima_data,   current_date),    0) as dias_desde,
       greatest(
         case when coalesce(p.int_horas,0)  > 0
              then greatest(a.horas_atuais  - coalesce(p.ultima_horas,  a.horas_atuais), 0) / p.int_horas  else 0 end,
         case when coalesce(p.int_litros,0) > 0
              then greatest(a.litros_atuais - coalesce(p.ultima_litros, a.litros_atuais), 0) / p.int_litros else 0 end,
         case when coalesce(p.int_dias,0)   > 0
              then greatest(current_date    - coalesce(p.ultima_data,   current_date),    0)::numeric / p.int_dias else 0 end
       ) as consumo
from public.lub_pontos p
join atual a on a.frota_id = p.frota_id
where p.ativo;

-- ---------------------------------------------------------------------
-- 5. Registrar leitura de horímetro / abastecimento
-- ---------------------------------------------------------------------
create or replace function public.registrar_leitura(
  p_frota     text,
  p_data      date    default current_date,
  p_horimetro numeric default null,
  p_litros    numeric default null,
  p_obs       text    default null
) returns public.lub_leituras
language plpgsql
security definer set search_path = public
as $$
declare
  v_f    public.frota%rowtype;
  v_l    public.lub_leituras%rowtype;
  v_nome text := public.nome_usuario();
  v_max  numeric;
begin
  if v_nome is null then raise exception 'Usuário sem perfil ativo.'; end if;
  if public.papel() = 'consulta' then raise exception 'Seu perfil é somente leitura.'; end if;
  if p_horimetro is null and p_litros is null then
    raise exception 'Informe o horímetro, os litros abastecidos, ou os dois.';
  end if;
  if coalesce(p_horimetro, 1) <= 0 or coalesce(p_litros, 1) <= 0 then
    raise exception 'Horímetro e litros precisam ser maiores que zero.';
  end if;

  select * into v_f from public.frota where codigo = upper(trim(p_frota));
  if not found then raise exception 'Equipamento % não está cadastrado.', p_frota; end if;

  -- Horímetro não anda para trás: quase sempre é erro de digitação.
  if p_horimetro is not null then
    select max(horimetro) into v_max from public.lub_leituras where frota_id = v_f.id;
    if v_max is not null and p_horimetro < v_max then
      raise exception 'O horímetro informado (%) é menor que a última leitura (%). Confira o número.',
        p_horimetro, v_max;
    end if;
  end if;

  insert into public.lub_leituras (frota_id, frota, data, horimetro, litros, obs, usuario_id, usuario_nome)
  values (v_f.id, v_f.codigo, coalesce(p_data, current_date), p_horimetro, p_litros,
          nullif(trim(coalesce(p_obs,'')), ''), auth.uid(), v_nome)
  returning * into v_l;

  return v_l;
end $$;

-- ---------------------------------------------------------------------
-- 6. Registrar a lubrificação feita
--
-- Se o ponto aponta para um item do almoxarifado e a quantidade é maior
-- que zero, o lubrificante sai do estoque pela função de sempre: com
-- saldo travado, custo médio e histórico, amarrado à frota.
-- ---------------------------------------------------------------------
create or replace function public.registrar_lubrificacao(
  p_ponto_id    uuid,
  p_data        date    default current_date,
  p_horimetro   numeric default null,
  p_qtd         numeric default null,
  p_responsavel text    default null,
  p_os          text    default null,
  p_obs         text    default null
) returns public.lub_execucoes
language plpgsql
security definer set search_path = public
as $$
declare
  v_p     public.lub_pontos%rowtype;
  v_e     public.lub_execucoes%rowtype;
  v_mov   public.movimentos%rowtype;
  v_nome  text := public.nome_usuario();
  v_qtd   numeric;
  v_horas numeric;
  v_lit   numeric;
  v_mid   bigint := null;
begin
  if v_nome is null then raise exception 'Usuário sem perfil ativo.'; end if;
  if public.papel() = 'consulta' then raise exception 'Seu perfil é somente leitura.'; end if;

  select * into v_p from public.lub_pontos where id = p_ponto_id for update;
  if not found then raise exception 'Ponto de lubrificação não encontrado.'; end if;

  v_qtd := coalesce(p_qtd, v_p.qtd, 0);

  -- Se veio leitura de horímetro junto, grava como leitura também.
  if p_horimetro is not null and p_horimetro > 0 then
    perform public.registrar_leitura(v_p.frota, coalesce(p_data, current_date), p_horimetro, null,
                                     'Leitura na lubrificação');
  end if;

  select coalesce(max(horimetro),0), coalesce(sum(litros),0)
    into v_horas, v_lit
    from public.lub_leituras where frota_id = v_p.frota_id;

  -- Baixa do lubrificante no estoque.
  if v_p.item_codigo is not null and v_qtd > 0 and v_p.metodo <> 'inspecao' then
    v_mov := public.registrar_movimento(
      v_p.item_codigo, 'saida', v_qtd, 0, coalesce(p_data, current_date),
      nullif(trim(coalesce(p_os,'')), ''), v_p.frota,
      nullif(trim(coalesce(p_responsavel,'')), ''), null, null,
      'Lubrificação: ' || v_p.componente);
    v_mid := v_mov.id;
  end if;

  insert into public.lub_execucoes (
    ponto_id, frota_id, frota, componente, data, horimetro, litros_acum, qtd,
    item_codigo, movimento_id, responsavel, obs, usuario_id, usuario_nome
  ) values (
    v_p.id, v_p.frota_id, v_p.frota, v_p.componente, coalesce(p_data, current_date),
    v_horas, v_lit, v_qtd, v_p.item_codigo, v_mid,
    nullif(trim(coalesce(p_responsavel,'')), ''), nullif(trim(coalesce(p_obs,'')), ''),
    auth.uid(), v_nome
  ) returning * into v_e;

  -- Zera as três réguas a partir de agora.
  update public.lub_pontos
     set ultima_horas  = v_horas,
         ultima_litros = v_lit,
         ultima_data   = coalesce(p_data, current_date),
         atualizado_em = now()
   where id = v_p.id;

  return v_e;
end $$;

-- ---------------------------------------------------------------------
-- 7. Copiar a carta de um equipamento para outro
--    (máquinas iguais têm a mesma carta; ninguém quer digitar duas vezes)
-- ---------------------------------------------------------------------
create or replace function public.copiar_carta_lub(p_origem text, p_destino text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_o public.frota%rowtype;
  v_d public.frota%rowtype;
  n   int;
begin
  if not public.pode_lancar() then
    raise exception 'Só o almoxarife ou o administrador monta carta de lubrificação.';
  end if;

  select * into v_o from public.frota where codigo = upper(trim(p_origem));
  if not found then raise exception 'Equipamento de origem % não encontrado.', p_origem; end if;
  select * into v_d from public.frota where codigo = upper(trim(p_destino));
  if not found then raise exception 'Equipamento de destino % não encontrado.', p_destino; end if;
  if v_o.id = v_d.id then raise exception 'Origem e destino são o mesmo equipamento.'; end if;

  insert into public.lub_pontos (frota_id, frota, ordem, componente, item_codigo, lubrificante,
                                 qtd, unidade, metodo, int_horas, int_litros, int_dias,
                                 criticidade, procedimento, ativo)
  select v_d.id, v_d.codigo, ordem, componente, item_codigo, lubrificante,
         qtd, unidade, metodo, int_horas, int_litros, int_dias,
         criticidade, procedimento, true
  from public.lub_pontos
  where frota_id = v_o.id and ativo;

  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- 8. Segurança
-- ---------------------------------------------------------------------
alter table public.lub_leituras  enable row level security;
alter table public.lub_pontos    enable row level security;
alter table public.lub_execucoes enable row level security;

drop policy if exists lubl_leitura on public.lub_leituras;
create policy lubl_leitura on public.lub_leituras
  for select to authenticated using (public.papel() is not null);

drop policy if exists lubp_leitura on public.lub_pontos;
create policy lubp_leitura on public.lub_pontos
  for select to authenticated using (public.papel() is not null);

drop policy if exists lubp_escrita on public.lub_pontos;
create policy lubp_escrita on public.lub_pontos
  for all to authenticated using (public.pode_lancar()) with check (public.pode_lancar());

drop policy if exists lube_leitura on public.lub_execucoes;
create policy lube_leitura on public.lub_execucoes
  for select to authenticated using (public.papel() is not null);

-- Leituras e execuções não aceitam escrita direta: só pelas funções acima,
-- do mesmo jeito que movimentos e empréstimos.

grant select on public.lub_leituras, public.lub_pontos, public.lub_execucoes, public.v_lub_status
  to authenticated;
grant insert, update, delete on public.lub_pontos to authenticated;

revoke execute on function public.registrar_leitura(text,date,numeric,numeric,text)      from public, anon;
revoke execute on function public.registrar_lubrificacao(uuid,date,numeric,numeric,text,text,text) from public, anon;
revoke execute on function public.copiar_carta_lub(text,text)                            from public, anon;
grant  execute on function public.registrar_leitura(text,date,numeric,numeric,text)      to authenticated;
grant  execute on function public.registrar_lubrificacao(uuid,date,numeric,numeric,text,text,text) to authenticated;
grant  execute on function public.copiar_carta_lub(text,text)                            to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table
      public.lub_pontos, public.lub_leituras, public.lub_execucoes;
  exception when others then null;
  end;
end $$;

-- ---------------------------------------------------------------------
-- 9. Conferência
-- ---------------------------------------------------------------------
select 'tabelas de lubrificacao' as conferencia, count(*) as criadas
from information_schema.tables
where table_schema = 'public' and table_name in ('lub_pontos','lub_leituras','lub_execucoes');
