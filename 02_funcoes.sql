-- =====================================================================
-- ALMOXARIFADO DA OFICINA — 02. REGRAS DE NEGÓCIO
-- Toda alteração de saldo passa por estas funções. Elas travam a linha
-- do item (FOR UPDATE), então dois lançamentos simultâneos no mesmo item
-- entram em fila em vez de se atropelarem.
-- =====================================================================

-- ------------------------------------------------- movimento de estoque
create or replace function public.registrar_movimento(
  p_codigo      text,
  p_tipo        text,
  p_qtd         numeric,
  p_vlr_unit    numeric default 0,
  p_data        date    default current_date,
  p_os          text    default null,
  p_frota       text    default null,
  p_solicitante text    default null,
  p_fornecedor  text    default null,
  p_nf          text    default null,
  p_obs         text    default null
) returns public.movimentos
language plpgsql
security definer set search_path = public
as $$
declare
  v_item  public.itens%rowtype;
  v_papel text := public.papel();
  v_nome  text := public.nome_usuario();
  v_saldo numeric; v_cm numeric; v_novo numeric; v_ncm numeric;
  v_vu numeric; v_vt numeric;
  v_mov public.movimentos%rowtype;
begin
  if v_nome is null then
    raise exception 'Usuário sem perfil ativo. Peça ao administrador para liberar o acesso.';
  end if;
  if v_papel = 'consulta' then
    raise exception 'Seu perfil é somente leitura.';
  end if;
  if v_papel = 'mecanico' and p_tipo <> 'saida' then
    raise exception 'Perfil mecânico só pode lançar saída (requisição).';
  end if;
  if p_qtd is null or (p_qtd <= 0 and p_tipo <> 'ajuste') then
    raise exception 'Informe uma quantidade maior que zero.';
  end if;

  select * into v_item from public.itens where codigo = upper(trim(p_codigo)) for update;
  if not found then
    raise exception 'Item % não está cadastrado.', p_codigo;
  end if;
  if not v_item.ativo and p_tipo <> 'ajuste' then
    raise exception 'Item % está inativo.', v_item.codigo;
  end if;

  v_saldo := v_item.saldo;
  v_cm    := v_item.custo_medio;
  v_novo  := v_saldo;
  v_ncm   := v_cm;

  if p_tipo = 'entrada' then
    if coalesce(p_vlr_unit, 0) <= 0 then
      raise exception 'Informe o valor unitário da entrada.';
    end if;
    v_novo := v_saldo + p_qtd;
    v_ncm  := case when v_novo > 0
                   then ((v_saldo * v_cm) + (p_qtd * p_vlr_unit)) / v_novo
                   else p_vlr_unit end;
    v_vu   := p_vlr_unit;

  elsif p_tipo = 'devolucao' then
    v_novo := v_saldo + p_qtd;
    v_vu   := v_cm;

  elsif p_tipo = 'saida' then
    v_novo := v_saldo - p_qtd;
    if v_novo < 0 then
      raise exception 'Saldo insuficiente de %: disponível % %.',
        v_item.codigo, v_saldo, v_item.unidade;
    end if;
    v_vu := v_cm;

  elsif p_tipo in ('ajuste','inicial') then
    v_novo := p_qtd;
    if p_tipo = 'inicial' and coalesce(p_vlr_unit, 0) > 0 then
      v_ncm := p_vlr_unit;
    end if;
    v_vu := v_ncm;

  else
    raise exception 'Tipo de movimento inválido: %', p_tipo;
  end if;

  v_vt := case when p_tipo = 'ajuste'
               then round((p_qtd - v_saldo) * v_ncm, 2)
               else round(p_qtd * v_vu, 2) end;

  perform set_config('almox.movimento', 'on', true);
  update public.itens
     set saldo = round(v_novo, 3), custo_medio = round(v_ncm, 4)
   where id = v_item.id;
  perform set_config('almox.movimento', 'off', true);

  insert into public.movimentos (
    data, tipo, item_id, codigo, descricao, unidade, qtd, vlr_unit, vlr_total,
    saldo_anterior, saldo_posterior, os, frota, solicitante, fornecedor, nf, obs,
    usuario_id, usuario_nome
  ) values (
    coalesce(p_data, current_date), p_tipo, v_item.id, v_item.codigo, v_item.descricao,
    v_item.unidade, p_qtd, round(v_vu, 4), v_vt,
    round(v_saldo, 3), round(v_novo, 3),
    nullif(trim(coalesce(p_os, '')), ''), nullif(upper(trim(coalesce(p_frota, ''))), ''),
    nullif(trim(coalesce(p_solicitante, '')), ''), nullif(trim(coalesce(p_fornecedor, '')), ''),
    nullif(trim(coalesce(p_nf, '')), ''), nullif(trim(coalesce(p_obs, '')), ''),
    auth.uid(), v_nome
  ) returning * into v_mov;

  return v_mov;
end $$;

-- ------------------------------------------------- retirada de ferramenta
create or replace function public.registrar_retirada(
  p_codigo       text,
  p_qtd          integer,
  p_retirado_por text,
  p_retirado_em  date default current_date,
  p_previsao     date default null,
  p_os           text default null,
  p_frota        text default null,
  p_obs          text default null
) returns public.emprestimos
language plpgsql
security definer set search_path = public
as $$
declare
  v_f     public.ferramentas%rowtype;
  v_fora  integer;
  v_papel text := public.papel();
  v_nome  text := public.nome_usuario();
  v_emp   public.emprestimos%rowtype;
begin
  if v_nome is null then raise exception 'Usuário sem perfil ativo.'; end if;
  if v_papel = 'consulta' then raise exception 'Seu perfil é somente leitura.'; end if;
  if coalesce(p_qtd, 0) <= 0 then raise exception 'Informe a quantidade.'; end if;
  if coalesce(trim(p_retirado_por), '') = '' then
    raise exception 'Informe quem está levando a ferramenta.';
  end if;

  select * into v_f from public.ferramentas where codigo = upper(trim(p_codigo)) for update;
  if not found then raise exception 'Ferramenta % não está cadastrada.', p_codigo; end if;

  select coalesce(sum(qtd), 0) into v_fora
    from public.emprestimos where ferramenta_id = v_f.id and situacao = 'aberto';

  if p_qtd > (v_f.quantidade - v_fora) then
    raise exception 'Disponível apenas % de % (% em campo).',
      v_f.quantidade - v_fora, v_f.descricao, v_fora;
  end if;

  insert into public.emprestimos (
    ferramenta_id, codigo, descricao, qtd, retirado_em, previsao, retirado_por,
    os, frota, obs, situacao, usuario_id, usuario_nome
  ) values (
    v_f.id, v_f.codigo, v_f.descricao, p_qtd, coalesce(p_retirado_em, current_date),
    p_previsao, trim(p_retirado_por),
    nullif(trim(coalesce(p_os, '')), ''), nullif(upper(trim(coalesce(p_frota, ''))), ''),
    nullif(trim(coalesce(p_obs, '')), ''), 'aberto', auth.uid(), v_nome
  ) returning * into v_emp;

  return v_emp;
end $$;

-- ------------------------------------------ devolução / baixa de ferramenta
create or replace function public.encerrar_emprestimo(
  p_id           bigint,
  p_situacao     text,                      -- 'devolvido' ou 'baixado'
  p_data         date default current_date,
  p_recebido_por text default null,
  p_motivo       text default null,
  p_obs          text default null
) returns public.emprestimos
language plpgsql
security definer set search_path = public
as $$
declare
  v_emp   public.emprestimos%rowtype;
  v_papel text := public.papel();
  v_nome  text := public.nome_usuario();
begin
  if v_nome is null then raise exception 'Usuário sem perfil ativo.'; end if;
  if v_papel = 'consulta' then raise exception 'Seu perfil é somente leitura.'; end if;
  if p_situacao not in ('devolvido','baixado') then
    raise exception 'Situação inválida: %', p_situacao;
  end if;
  if p_situacao = 'baixado' and not public.pode_lancar() then
    raise exception 'Só o almoxarife ou o administrador pode dar baixa em ferramenta.';
  end if;

  select * into v_emp from public.emprestimos where id = p_id for update;
  if not found then raise exception 'Retirada não encontrada.'; end if;
  if v_emp.situacao <> 'aberto' then
    raise exception 'Esta retirada já foi encerrada em %.', v_emp.devolvido_em;
  end if;

  update public.emprestimos
     set situacao      = p_situacao,
         devolvido_em  = coalesce(p_data, current_date),
         recebido_por  = coalesce(nullif(trim(coalesce(p_recebido_por, '')), ''), v_nome),
         motivo        = nullif(trim(coalesce(p_motivo, '')), ''),
         obs_devolucao = nullif(trim(coalesce(p_obs, '')), '')
   where id = p_id
  returning * into v_emp;

  -- Baixa reduz o total da ferramenta: o que se perdeu não volta a existir.
  if p_situacao = 'baixado' then
    update public.ferramentas
       set quantidade = greatest(quantidade - v_emp.qtd, 0), atualizado_em = now()
     where id = v_emp.ferramenta_id;
  end if;

  return v_emp;
end $$;

-- --------------------------------------------------- inventário (lote)
-- p_linhas: [{"codigo":"FIL-OL-2831","contado":7}, ...]
create or replace function public.aplicar_inventario(
  p_linhas   jsonb,
  p_local    text default null,
  p_categoria text default null
) returns public.inventarios
language plpgsql
security definer set search_path = public
as $$
declare
  v_linha   jsonb;
  v_item    public.itens%rowtype;
  v_dif     numeric;
  v_impacto numeric := 0;
  v_reg     jsonb := '[]'::jsonb;
  v_inv     public.inventarios%rowtype;
  v_nome    text := public.nome_usuario();
begin
  if not public.pode_lancar() then
    raise exception 'Só o almoxarife ou o administrador pode aplicar inventário.';
  end if;

  for v_linha in select * from jsonb_array_elements(p_linhas) loop
    select * into v_item from public.itens
     where codigo = upper(trim(v_linha ->> 'codigo'));
    continue when not found;

    v_dif := (v_linha ->> 'contado')::numeric - v_item.saldo;
    continue when abs(v_dif) < 0.0001;

    perform public.registrar_movimento(
      v_item.codigo, 'ajuste', (v_linha ->> 'contado')::numeric, 0,
      current_date, null, null, null, null, null,
      'Inventário ' || to_char(current_date, 'DD/MM/YYYY')
    );

    v_impacto := v_impacto + (v_dif * v_item.custo_medio);
    v_reg := v_reg || jsonb_build_object(
      'codigo', v_item.codigo, 'descricao', v_item.descricao, 'unidade', v_item.unidade,
      'sistema', v_item.saldo, 'contado', (v_linha ->> 'contado')::numeric, 'diferenca', v_dif
    );
  end loop;

  insert into public.inventarios (data, responsavel, local, categoria, impacto, linhas, usuario_id)
  values (current_date, v_nome, p_local, p_categoria, round(v_impacto, 2), v_reg, auth.uid())
  returning * into v_inv;

  return v_inv;
end $$;

-- ------------------------------------------------ recalcular saldo do item
-- Refaz saldo e custo médio a partir do histórico completo do item.
create or replace function public.recalcular_item(p_codigo text)
returns public.itens
language plpgsql
security definer set search_path = public
as $$
declare
  v_item public.itens%rowtype;
  v_m    record;
  v_s    numeric := 0;
  v_cm   numeric := 0;
  v_ns   numeric;
begin
  if not public.pode_lancar() then
    raise exception 'Sem permissão para recalcular saldos.';
  end if;

  select * into v_item from public.itens where codigo = upper(trim(p_codigo)) for update;
  if not found then raise exception 'Item % não encontrado.', p_codigo; end if;

  for v_m in select * from public.movimentos
              where item_id = v_item.id order by data, id loop
    if v_m.tipo = 'entrada' then
      v_ns := v_s + v_m.qtd;
      v_cm := case when v_ns > 0 then ((v_s * v_cm) + (v_m.qtd * v_m.vlr_unit)) / v_ns else v_m.vlr_unit end;
      v_s  := v_ns;
    elsif v_m.tipo = 'devolucao' then v_s := v_s + v_m.qtd;
    elsif v_m.tipo = 'saida'     then v_s := v_s - v_m.qtd;
    else
      v_s := v_m.qtd;
      if v_m.tipo = 'inicial' and v_m.vlr_unit > 0 then v_cm := v_m.vlr_unit; end if;
    end if;
  end loop;

  perform set_config('almox.movimento', 'on', true);
  update public.itens set saldo = round(v_s, 3), custo_medio = round(v_cm, 4)
   where id = v_item.id returning * into v_item;
  perform set_config('almox.movimento', 'off', true);

  return v_item;
end $$;

-- ------------------------------------------------------ limpar exemplos
create or replace function public.apagar_exemplos()
returns text
language plpgsql
security definer set search_path = public
as $$
declare n int; total int := 0;
begin
  if public.papel() <> 'admin' then
    raise exception 'Somente o administrador pode apagar os dados de exemplo.';
  end if;
  delete from public.emprestimos where exemplo; get diagnostics n = row_count; total := total + n;
  delete from public.movimentos  where exemplo; get diagnostics n = row_count; total := total + n;
  delete from public.ferramentas where exemplo; get diagnostics n = row_count; total := total + n;
  delete from public.itens       where exemplo; get diagnostics n = row_count; total := total + n;
  delete from public.frota       where exemplo; get diagnostics n = row_count; total := total + n;
  delete from public.fornecedores where exemplo; get diagnostics n = row_count; total := total + n;
  return total || ' registro(s) de exemplo removido(s).';
end $$;

-- ----------------------------------- importação do backup do sistema atual
-- Cria o item já com o saldo e o custo, sem passar pelo movimento inicial.
create or replace function public.importar_item(
  p_codigo text, p_descricao text, p_categoria text, p_unidade text, p_local text,
  p_min numeric, p_max numeric, p_saldo numeric, p_custo numeric,
  p_aplicacao text default null, p_fornecedor text default null, p_ativo boolean default true
) returns public.itens
language plpgsql
security definer set search_path = public
as $$
declare v_item public.itens%rowtype;
begin
  if public.papel() <> 'admin' then
    raise exception 'Somente o administrador pode importar o cadastro.';
  end if;

  insert into public.itens (codigo, descricao, categoria, unidade, local,
                            estoque_min, estoque_max, saldo, custo_medio,
                            aplicacao, fornecedor, ativo)
  values (upper(trim(p_codigo)), p_descricao, p_categoria, coalesce(upper(p_unidade),'UN'), p_local,
          coalesce(p_min,0), coalesce(p_max,0), coalesce(p_saldo,0), coalesce(p_custo,0),
          p_aplicacao, p_fornecedor, coalesce(p_ativo,true))
  on conflict (codigo) do nothing
  returning * into v_item;

  if v_item.id is null then
    select * into v_item from public.itens where codigo = upper(trim(p_codigo));
    perform set_config('almox.movimento', 'on', true);
    update public.itens set saldo = coalesce(p_saldo,0), custo_medio = coalesce(p_custo,0)
     where id = v_item.id returning * into v_item;
    perform set_config('almox.movimento', 'off', true);
  end if;

  return v_item;
end $$;

-- Grava um movimento histórico já calculado, sem mexer no saldo atual.
create or replace function public.importar_movimento(p_mov jsonb)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare v_id bigint; v_item public.itens%rowtype;
begin
  if public.papel() <> 'admin' then
    raise exception 'Somente o administrador pode importar o histórico.';
  end if;

  select * into v_item from public.itens where codigo = upper(trim(p_mov ->> 'codigo'));
  if not found then return null; end if;

  insert into public.movimentos (
    data, tipo, item_id, codigo, descricao, unidade, qtd, vlr_unit, vlr_total,
    saldo_anterior, saldo_posterior, os, frota, solicitante, fornecedor, nf, obs,
    usuario_nome, exemplo
  ) values (
    (p_mov ->> 'data')::date, p_mov ->> 'tipo', v_item.id, v_item.codigo,
    coalesce(p_mov ->> 'descricao', v_item.descricao), coalesce(p_mov ->> 'un', v_item.unidade),
    (p_mov ->> 'qtd')::numeric, coalesce((p_mov ->> 'vlrUnit')::numeric, 0),
    coalesce((p_mov ->> 'vlrTotal')::numeric, 0),
    (p_mov ->> 'saldoAnterior')::numeric, (p_mov ->> 'saldoPosterior')::numeric,
    p_mov ->> 'os', p_mov ->> 'frota', p_mov ->> 'solicitante', p_mov ->> 'fornecedor',
    p_mov ->> 'nf', p_mov ->> 'obs', p_mov ->> 'usuario',
    coalesce((p_mov ->> 'exemplo')::boolean, false)
  ) returning id into v_id;

  return v_id;
end $$;
