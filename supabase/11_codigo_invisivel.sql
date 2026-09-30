-- =====================================================================
-- ALMOXARIFADO DA OFICINA — 11. PART NUMBER NO LUGAR DO CÓDIGO
--
-- Rode este arquivo inteiro no SQL Editor do Supabase, uma vez.
--
-- O 'codigo' continua sendo a chave interna: é nele que penduram os
-- movimentos, os pontos de lubrificação e todo o histórico. Ele só
-- deixa de aparecer. Quem identifica a peça na tela é o part number.
--
-- Aqui só o aviso de estoque mínimo por e-mail é ajustado, para que o
-- e-mail mostre a mesma coisa que a tela.
-- =====================================================================

create or replace view public.v_estoque_minimo
with (security_invoker = true) as
-- 'create or replace view' exige a mesma ordem de colunas; a coluna nova
-- entra no fim, por isso 'codigo_interno' aparece lá embaixo.
select coalesce(nullif(i.part_number, ''), i.codigo) as codigo,   -- o que o e-mail mostra
       i.part_number,
       i.descricao,
       i.unidade,
       i.local,
       i.categoria,
       i.fornecedor,
       i.saldo,
       i.estoque_min,
       greatest(i.estoque_min - i.saldo, 0) as falta,
       i.estoque_max,
       greatest(coalesce(i.estoque_max, 0) - i.saldo, 0) as ate_o_maximo,
       i.custo_medio,
       case when i.saldo <= 0 then 'sem saldo' else 'no minimo' end as situacao,
       i.codigo as codigo_interno                                 -- a chave, para conferência
from public.itens i
where i.ativo
  and i.estoque_min > 0
  and i.saldo <= i.estoque_min;

grant select on public.v_estoque_minimo to authenticated;

-- Conferência: é isto que vai no e-mail.
select codigo, descricao, saldo, estoque_min, falta
from public.v_estoque_minimo
order by saldo;
