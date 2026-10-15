-- =====================================================================
-- ALMOXARIFADO DA OFICINA — 12. TAMANHO DA ETIQUETA
--
-- Rode este arquivo inteiro no SQL Editor do Supabase, uma vez.
--
-- Guarda a medida do rolo de etiqueta usado na impressora. Fica no
-- banco, e não no navegador, para não ter de reconfigurar máquina por
-- máquina quando alguém imprime de outro computador.
-- =====================================================================

alter table public.config
  add column if not exists etiq_largura numeric not null default 80,
  add column if not exists etiq_altura  numeric not null default 40,
  add column if not exists etiq_margem  numeric not null default 3;

comment on column public.config.etiq_largura is 'Largura da etiqueta em milímetros';
comment on column public.config.etiq_altura  is 'Altura da etiqueta em milímetros';
comment on column public.config.etiq_margem  is 'Margem interna da etiqueta em milímetros';

-- Conferência: é esta medida que a impressão vai usar.
select etiq_largura as largura_mm,
       etiq_altura  as altura_mm,
       etiq_margem  as margem_mm
from public.config
where id = 1;
