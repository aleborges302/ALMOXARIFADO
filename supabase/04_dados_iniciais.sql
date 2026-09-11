-- =====================================================================
-- ALMOXARIFADO DA OFICINA — 04. CONFIGURAÇÃO INICIAL
-- Rode depois de criar o primeiro usuário no painel (Authentication > Users).
-- =====================================================================

-- Listas usadas nos formulários. Ajuste à vontade depois, pela tela Ajustes.
insert into public.config (id, empresa, obra, categorias, unidades, locais, tipos_frota)
values (
  1,
  'RENEA Infraestrutura',
  'Oficina de manutenção',
  array['Lubrificantes','Filtros','Peças de motor','Sistema hidráulico','Freios',
        'Elétrica','Pneus e rodas','Ferramentas','EPI','Consumíveis','Solda','Fixadores'],
  array['UN','PC','L','KG','M','CX','PAR','JG','M²','RL'],
  array['Estante A','Estante B','Estante C','Prateleira D','Pátio','Contêiner'],
  array['Caminhão','Trator','Escavadeira','Retroescavadeira','Pá carregadeira',
        'Rolo compactador','Motoniveladora','Caminhonete','Gerador','Outro']
)
on conflict (id) do update
  set empresa = excluded.empresa,
      obra = excluded.obra,
      categorias = excluded.categorias,
      unidades = excluded.unidades,
      locais = excluded.locais,
      tipos_frota = excluded.tipos_frota,
      atualizado_em = now();

-- ---------------------------------------------------------------------
-- PRIMEIRO ADMINISTRADOR
-- Troque o e-mail abaixo pelo e-mail que você cadastrou em
-- Authentication > Users e rode esta linha. Sem isso ninguém consegue
-- gravar nada — todo usuário novo nasce com o papel 'mecanico'.
-- ---------------------------------------------------------------------
update public.perfis p
   set papel = 'admin', ativo = true
  from auth.users u
 where u.id = p.id
   and u.email = 'suporte@renea.com.br';   -- <<< TROQUE AQUI

-- Confira o resultado:
select u.email, p.nome, p.papel, p.ativo
  from public.perfis p join auth.users u on u.id = p.id
 order by p.criado_em;
