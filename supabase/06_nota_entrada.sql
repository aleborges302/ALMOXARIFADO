-- =====================================================================
-- ALMOXARIFADO DA OFICINA — 06. ENTRADA DE NOTA COM VÁRIOS ITENS
--
-- Rode este arquivo inteiro no SQL Editor do Supabase, uma vez.
--
-- Lança a nota inteira dentro de UMA transação: ou todos os itens entram,
-- ou nenhum entra. Sem isso, uma queda de internet no meio de uma nota de
-- 15 linhas deixaria 7 itens lançados e 8 não — e ninguém saberia quais.
--
-- Cada linha continua passando por registrar_movimento, que é quem trava a
-- linha do item, confere o perfil e recalcula o custo médio ponderado. Ou
-- seja: nada aqui contorna as regras; isto só agrupa.
-- =====================================================================

create or replace function public.registrar_nota(
  p_data       date,
  p_fornecedor text,
  p_nf         text,
  p_obs        text,
  p_linhas     jsonb   -- [{"codigo":"FIL-OL-2831","qtd":12,"vlr_unit":48.90}, ...]
) returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_linha jsonb;
  v_i     int := 0;
  v_qtd   numeric;
  v_vlr   numeric;
begin
  if jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas) = 0 then
    raise exception 'Informe pelo menos um item na nota.';
  end if;
  if jsonb_array_length(p_linhas) > 200 then
    raise exception 'Máximo de 200 itens por nota.';
  end if;

  for v_linha in select * from jsonb_array_elements(p_linhas) loop
    v_i := v_i + 1;

    v_qtd := (v_linha ->> 'qtd')::numeric;
    v_vlr := (v_linha ->> 'vlr_unit')::numeric;

    if coalesce(v_qtd, 0) <= 0 then
      raise exception 'Linha % (%): quantidade inválida.', v_i, coalesce(v_linha ->> 'codigo', '?');
    end if;
    if coalesce(v_vlr, 0) <= 0 then
      raise exception 'Linha % (%): informe o valor unitário.', v_i, coalesce(v_linha ->> 'codigo', '?');
    end if;

    begin
      perform public.registrar_movimento(
        v_linha ->> 'codigo',
        'entrada',
        v_qtd,
        v_vlr,
        coalesce(p_data, current_date),
        null, null, null,
        p_fornecedor,
        p_nf,
        nullif(trim(coalesce(v_linha ->> 'obs', p_obs, '')), '')
      );
    exception when others then
      -- Reergue o erro dizendo QUAL linha falhou. A transação inteira
      -- volta atrás: nenhum item da nota fica lançado.
      raise exception 'Linha % (%): %', v_i, coalesce(v_linha ->> 'codigo', '?'), sqlerrm;
    end;
  end loop;

  return v_i;
end $$;

revoke all on function public.registrar_nota(date,text,text,text,jsonb) from public, anon;
grant execute on function public.registrar_nota(date,text,text,text,jsonb) to authenticated;

-- Conferência: deve listar a função nova.
select proname, pg_get_function_identity_arguments(oid) as argumentos
from pg_proc
where pronamespace = 'public'::regnamespace and proname = 'registrar_nota';
