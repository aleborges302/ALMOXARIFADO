-- =====================================================================
-- ALMOXARIFADO DA OFICINA — 08. PART NUMBER NO CADASTRO DE ITEM
--
-- Rode este arquivo inteiro no SQL Editor do Supabase, uma vez.
--
-- O "código" continua sendo o código interno da RENEA (o da etiqueta da
-- prateleira). O part number é o código do fabricante, impresso na caixa
-- da peça — é por ele que se compra e se confere a peça recebida.
-- São coisas diferentes e por isso ganham campos diferentes.
-- =====================================================================

alter table public.itens add column if not exists part_number text;

comment on column public.itens.part_number is
  'Código do fabricante / part number da peça (o que vem impresso na caixa)';

-- Busca por part number precisa ser rápida e não diferenciar maiúscula.
create index if not exists ix_itens_part_number
  on public.itens (upper(part_number));

-- Conferência
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'itens' and column_name = 'part_number';
