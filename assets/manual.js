"use strict";
/* =====================================================================
   ALMOXARIFADO DA OFICINA — MANUAL DE USO
   Este arquivo é só texto. Quem desenha a tela é o app.js (vManual).
   A cada mudança no sistema, acrescente o que mudou em MANUAL.mudancas
   e ajuste a seção correspondente.
   ===================================================================== */
window.MANUAL={
  atualizado:"2026-09-30",

  secoes:[

  /* ------------------------------------------------------------ */
  {id:"inicio",t:"Como o sistema funciona",ic:"◧",
   r:"O que este sistema é, onde ficam os dados e por onde começar.",
   b:[
    {p:["Este é o controle do almoxarifado da oficina de manutenção: peças e insumos que entram por nota fiscal, saem por requisição da oficina, voltam por devolução e são conferidos no inventário. Junto vêm as ferramentas emprestadas, a carta de lubrificação dos equipamentos e os relatórios de consumo."]},
    {h:"Onde ficam os dados",
     p:["Nada fica guardado no computador ou no celular. Tudo vive no banco de dados do Supabase, na nuvem. A tela é só a janela: qualquer pessoa autorizada, de qualquer aparelho, vê a mesma informação no mesmo instante.",
        "Por isso o sistema precisa de internet para funcionar, e por isso uma baixa lançada pelo mecânico no celular já aparece no computador do almoxarife."]},
    {h:"O caminho normal de uma peça",
     li:["<b>Cadastro</b> — a peça entra no catálogo em Estoque › Novo item, com part number, descrição, unidade e estoque mínimo.",
         "<b>Entrada</b> — chegou a nota fiscal, lança em Movimentar › Entrada (ou Nota com vários itens). O saldo sobe e o custo médio é recalculado.",
         "<b>Saída</b> — o mecânico pede a peça, lança em Movimentar › Saída com a OS e o equipamento. O saldo desce pelo custo médio.",
         "<b>Devolução</b> — sobrou peça, volta pelo mesmo custo com que saiu.",
         "<b>Conferência</b> — de tempos em tempos, Inventário conta o que existe de verdade e ajusta o que estiver diferente."]},
    {h:"O que o sistema não deixa fazer",
     p:["Saldo e custo médio não são digitados em lugar nenhum — eles só mudam por movimentação. Isso é de propósito: é o que garante que o valor em estoque bata com o histórico. Para corrigir quantidade existe Movimentar › Ajuste, que deixa rastro de quem corrigiu e quando."],
     nota:"Item que já tem movimentação não pode ser excluído: o histórico ficaria órfão. Marque como inativo — ele some das listas e o histórico continua íntegro."}
   ]},

  /* ------------------------------------------------------------ */
  {id:"perfis",t:"Perfis, senhas e quem pode o quê",ic:"◍",
   r:"Os quatro perfis, o que cada um enxerga e como criar um usuário novo.",
   b:[
    {h:"Os quatro perfis",
     li:["<b>Administrador</b> — faz tudo, e só ele cria usuários, troca senha dos outros, liga o aviso de e-mail e apaga os dados de exemplo.",
         "<b>Almoxarife</b> — lança entradas, saídas, devoluções e ajustes; cadastra itens, frota, fornecedores, ferramentas e pontos de lubrificação.",
         "<b>Mecânico</b> — registra saída e devolução de peça, retira e devolve ferramenta, lança leitura de horímetro. Não cadastra nem dá entrada de nota.",
         "<b>Consulta</b> — vê tudo, não lança nada. Serve para engenharia, contabilidade e gerência."]},
    {h:"Criar um usuário",
     p:["Em <b>Ajustes › Usuários › Novo usuário</b>. O administrador informa nome, e-mail e senha, escolhe o perfil e pronto: a pessoa já entra com esse e-mail e essa senha.",
        "Não existe cadastro pela tela de login — de propósito. Ninguém de fora cria conta sozinho."]},
    {h:"Quem sai da equipe",
     p:["Nunca apague o usuário. Marque como <b>Bloqueado</b> em Ajustes › Usuários. A pessoa deixa de entrar na hora, e o histórico continua mostrando quem lançou cada movimento."],
     nota:"Usuário bloqueado não consegue mudar o próprio perfil nem se desbloquear — isso é travado no banco, não só na tela."},
    {h:"Trocar a própria senha",
     p:["Botão <b>Conta</b>, no alto à direita. Também dá para corrigir ali o nome que aparece no histórico. A senha tem que ter pelo menos 8 caracteres."]}
   ]},

  /* ------------------------------------------------------------ */
  {id:"painel",t:"Painel",ic:"◧",
   r:"A primeira tela: como está o almoxarifado hoje.",
   b:[
    {p:["O Painel é leitura, não se lança nada por ele. Serve para bater o olho de manhã."]},
    {h:"Os números do topo",
     li:["<b>Valor em estoque</b> — soma de saldo × custo médio de tudo que está cadastrado.",
         "<b>Abaixo do mínimo</b> — itens que chegaram ou passaram do ponto de reposição. É o mesmo número do sininho vermelho ao lado de Estoque no menu.",
         "<b>Saídas do mês</b> e <b>Entradas do mês</b> — quanto saiu para a oficina e quanto entrou por nota no mês corrente.",
         "<b>Itens sem saldo</b> — zerados, para juntar na próxima compra.",
         "<b>Ferramentas em campo</b> — o que está na mão da equipe, com aviso quando passa do prazo de devolução."]},
    {h:"Os quadros",
     p:["<b>Entradas e saídas por mês</b> mostra os últimos seis meses lado a lado — barra escura é compra, barra clara é consumo. <b>Consumo por equipamento</b> só enche se as saídas forem lançadas com o prefixo da frota; sem isso o sistema não tem como saber o custo de cada máquina.",
        "<b>Reposição necessária</b> já calcula quanto comprar de cada item para voltar ao máximo cadastrado, e <b>Parados há 90 dias</b> mostra o dinheiro dormindo na prateleira."]}
   ]},

  /* ------------------------------------------------------------ */
  {id:"estoque",t:"Estoque e cadastro de item",ic:"▤",
   r:"O catálogo de peças: part number, mínimo, máximo e importação de planilha.",
   b:[
    {h:"O part number é a identidade da peça",
     p:["Cada item é identificado pelo <b>part number</b> — o código do fabricante, aquele que está na embalagem e que o fornecedor entende. É ele que aparece na lista, no histórico, nos relatórios e no e-mail de aviso.",
        "Item que não tem part number de fábrica (graxa a granel, estopa, parafuso comum) pode ficar com o campo em branco: o sistema cria um código interno do tipo ITEM-0001 e segue a vida."],
     nota:"O part number não se repete. Se você tentar cadastrar um que já existe, o sistema avisa em qual item ele está."},
    {h:"Cadastrar um item",
     p:["<b>Novo item</b>, no alto à direita. Os campos que importam de verdade:"],
     li:["<b>Descrição</b> — o nome que a oficina usa. É por aqui que a maioria das buscas acontece.",
         "<b>Unidade</b> — PC, L, KG, M. Depois de haver movimento, mudar a unidade bagunça o histórico; escolha certo na primeira vez.",
         "<b>Estoque mínimo</b> — o ponto em que o item entra na lista de reposição e no e-mail de aviso. Deixar zero é desligar o aviso desse item.",
         "<b>Estoque máximo</b> — quanto o sistema sugere recompor. Sem ele, a sugestão vira o dobro do mínimo.",
         "<b>Aplicação / equipamento</b> — em que máquina a peça serve. Ajuda muito na busca depois.",
         "<b>Saldo inicial</b> — só no cadastro. Entra no histórico como movimento “Saldo inicial”, com o custo unitário que você informar."]},
    {h:"Buscar e filtrar",
     p:["A busca olha part number, descrição, aplicação e categoria ao mesmo tempo. Os filtros de categoria, localização e situação se somam a ela. A situação <b>Inativos</b> é a única maneira de ver itens desativados."]},
    {h:"Importar uma planilha",
     p:["<b>Importar CSV</b> aceita uma linha por item, separada por ponto e vírgula, nesta ordem:"],
     li:["part number ; descrição ; categoria ; unidade ; local ; mínimo ; máximo ; saldo ; custo unitário"],
     nota:"Exportar CSV devolve a planilha exatamente nessa ordem, então dá para exportar, corrigir no Excel e importar de volta. Linhas com part number já cadastrado são ignoradas, nunca duplicadas."},
    {h:"Cores da lista",
     li:["<b>Linha vermelha</b> — saldo zerado.",
         "<b>Linha amarela</b> — no mínimo ou abaixo dele.",
         "<b>Etiqueta “ex.”</b> — item de exemplo que veio com o sistema; some quando o administrador usar Ajustes › Apagar dados de exemplo."]}
   ]},

  /* ------------------------------------------------------------ */
  {id:"movimentar",t:"Movimentar",ic:"⇄",
   r:"Entrada de nota, requisição da oficina, devolução e ajuste de contagem.",
   b:[
    {h:"Os quatro tipos",
     li:["<b>Entrada</b> — chegada de material por nota fiscal. Sobe o saldo e recalcula o custo médio.",
         "<b>Saída</b> — requisição da oficina. Baixa o saldo pelo custo médio do momento e joga o valor no custo do equipamento.",
         "<b>Devolução</b> — peça que sobrou e voltou. Entra de novo pelo mesmo custo com que saiu, não pelo preço de compra.",
         "<b>Ajuste</b> — correção de contagem. Aqui você digita o <b>saldo real contado</b>, não a diferença; o sistema calcula o resto."]},
    {h:"Custo médio ponderado",
     p:["Toda entrada mistura o que chegou com o que já havia: se você tinha 10 peças a R$ 100 e chegaram 10 a R$ 120, o custo médio passa a R$ 110 e é por R$ 110 que a próxima saída vai sair. É o critério contábil correto e é feito sozinho — não existe campo para digitar custo médio."]},
    {h:"Nota com vários itens",
     p:["Na Entrada, o botão <b>Nota com vários itens</b> abre a tela de digitação de nota inteira: você preenche data, fornecedor e número da NF uma vez só, depois vai acrescentando item, quantidade e valor, um por linha.",
        "Nada é gravado até você confirmar. E se uma linha der erro — item inativo, valor zerado — <b>a nota inteira é desfeita</b>, nenhuma linha entra pela metade. A mensagem diz qual linha travou."]},
    {h:"O botão “Ler código”",
     p:["Usa a câmera do aparelho para ler o código de barras da embalagem e joga o que leu no campo do item. Funciona com o part number e com o código interno. Em celular é o jeito mais rápido; em computador sem câmera, digite."]},
    {h:"Saída bem lançada",
     p:["Na saída, três campos não são obrigatórios mas mudam tudo depois:"],
     li:["<b>Ordem de serviço</b> — é o que permite saber quanto custou cada serviço.",
         "<b>Frota / equipamento</b> — é o que permite saber quanto custou cada máquina.",
         "<b>Solicitado por</b> — quem pediu a peça. Quando quem lança é o próprio mecânico, já vem preenchido."],
     nota:"Sem OS e sem frota o lançamento funciona, mas os relatórios de custo por serviço e por equipamento ficam vazios. Vale a disciplina."}
   ]},

  /* ------------------------------------------------------------ */
  {id:"historico",t:"Histórico",ic:"≡",
   r:"Toda movimentação já lançada, com filtro e exportação.",
   b:[
    {p:["O Histórico é a lista completa e imutável: nenhum lançamento é apagado ou editado. Errou? Lança o contrário (uma devolução, um ajuste) e os dois ficam registrados. É isso que torna o número confiável numa auditoria."]},
    {h:"Filtrar",
     p:["Dá para filtrar por período, tipo de movimento e texto livre — a busca olha part number, descrição, observação e quem solicitou. O que estiver filtrado na tela é exatamente o que sai no CSV."]}
   ]},

  /* ------------------------------------------------------------ */
  {id:"frota",t:"Frota",ic:"⛟",
   r:"Os equipamentos da obra e tudo que cada um já consumiu.",
   b:[
    {h:"Cadastro",
     p:["Cada equipamento tem um <b>prefixo</b> (o código que a obra usa), tipo, marca/modelo, ano, placa e local. O prefixo é o que aparece nas saídas e o que amarra o custo — escolha o mesmo que a equipe fala no rádio."]},
    {h:"O botão Peças",
     p:["Abre o histórico de peças daquele equipamento em duas partes: primeiro o <b>consolidado por peça</b> (quantas vezes, quanto, quando foi a última), depois <b>lançamento a lançamento</b> com data, OS e quem pediu.",
        "É o que responde “esse caminhão já comeu quantos filtros esse ano?” e é onde aparece a peça devolvida, marcada como tal, já descontada do consumo."]}
   ]},

  /* ------------------------------------------------------------ */
  {id:"fornecedores",t:"Fornecedores",ic:"⌂",
   r:"Quem vende o quê, para agilizar a cotação.",
   b:[
    {p:["Cadastro simples: nome, CNPJ, contato, telefone, e-mail e observação. O fornecedor cadastrado aparece na lista do item (“fornecedor habitual”) e na entrada de nota, o que evita digitar o mesmo nome de dez jeitos diferentes."]},
    {h:"Para que serve na prática",
     p:["Quando o aviso de estoque mínimo chega, a lista já vem com o fornecedor habitual de cada item ao lado — é meio caminho andado da cotação."]}
   ]},

  /* ------------------------------------------------------------ */
  {id:"ferramentas",t:"Ferramentas",ic:"⚒",
   r:"Quem está com cada ferramenta e desde quando.",
   b:[
    {h:"Ferramentaria x almoxarifado",
     p:["Ferramenta não é peça: ela sai e volta, não é consumida. Por isso vive numa tela separada, com quantidade total e quantidade disponível, e não entra no valor do estoque."]},
    {h:"Retirar e devolver",
     li:["<b>Registrar retirada</b> — ferramenta, quantidade, quem levou, prazo de devolução, OS e equipamento.",
         "<b>Devolver</b> — quando volta, informando quem recebeu.",
         "<b>Baixar</b> — quando não volta: perda, quebra ou extravio, com o motivo registrado."]},
    {h:"Atrasos",
     p:["Passou do prazo, a retirada fica em vermelho e o número aparece no sininho ao lado de Ferramentas no menu e no Painel. É a lista para cobrar na reunião de segunda."]}
   ]},

  /* ------------------------------------------------------------ */
  {id:"lubrificacao",t:"Lubrificação",ic:"◌",
   r:"Carta de lubrificação por equipamento, vencendo por hora, litro ou dia.",
   b:[
    {h:"As três réguas",
     p:["Cada ponto de lubrificação pode ter três intervalos ao mesmo tempo: <b>horas de horímetro</b>, <b>litros abastecidos</b> e <b>dias de calendário</b>. O ponto vence pelo que chegar primeiro — é assim que os fabricantes de máquina pesada mandam fazer.",
        "Exemplo: o filtro hidráulico vence a cada 500 h, 2.000 L ou 180 dias. Máquina parada vence pelo calendário; máquina forçada vence pelo consumo. Nenhuma das duas passa batido."],
     nota:"Não precisa preencher as três. Uma régua já basta — as outras ficam em branco."},
    {h:"Aba Vencimentos",
     p:["A primeira aba mostra tudo ordenado pelo mais atrasado. <b>Vencido</b> é o que passou de 100% do intervalo; <b>próximo</b> é de 90% em diante. O número vermelho no menu é a conta dos vencidos."]},
    {h:"Aba Cartas",
     p:["É onde se monta a carta de cada equipamento: ponto/componente, ordem, método (pistola, banho, nível, troca), lubrificante, quantidade, os intervalos, a criticidade e o procedimento.",
        "Se o ponto for ligado a um item do almoxarifado, a lubrificação registrada já dá baixa no estoque e joga o custo no equipamento — não precisa lançar saída à parte."]},
    {h:"Copiar carta",
     p:["Equipamento igual não se cadastra duas vezes: <b>Copiar carta de outro equipamento</b> traz a carta inteira de uma máquina para outra, e você só ajusta o que for diferente."]},
    {h:"Aba Leituras",
     p:["É o combustível do sistema. Sem horímetro lançado, a régua de horas nunca anda; sem litro lançado, a de litros também não. Só a régua de dias funciona sozinha.",
        "O horímetro não pode voltar para trás — se a leitura for menor que a anterior, o sistema recusa, porque quase sempre é erro de digitação."]},
    {h:"Aba Histórico",
     p:["Tudo que já foi lubrificado, com data, ponto, quantidade aplicada e quem fez. É o comprovante de manutenção preventiva que a concessionária pede."]}
   ]},

  /* ------------------------------------------------------------ */
  {id:"inventario",t:"Inventário",ic:"☑",
   r:"Contagem física e ajuste do que estiver diferente.",
   b:[
    {h:"Como fazer a contagem",
     p:["Filtre por localização (conta uma estante de cada vez, é mais fácil de não perder a linha), digite o que contou na coluna <b>Contado</b> e deixe em branco o que não contou. O sistema já mostra a diferença item a item e o impacto em dinheiro."]},
    {h:"Aplicar os ajustes",
     p:["O botão <b>Aplicar ajustes</b> só mexe nos itens com divergência. Cada correção vira um movimento do tipo Ajuste, com o nome de quem aplicou e a data — o inventário fica auditável."],
     nota:"Antes de aplicar, vale usar Ajustes › Conferir saldos com o histórico. Se o saldo do sistema estiver errado por outro motivo, é melhor descobrir antes de ajustar por cima."}
   ]},

  /* ------------------------------------------------------------ */
  {id:"relatorios",t:"Relatórios",ic:"▦",
   r:"Curva ABC, custo por OS, custo por equipamento e reposição.",
   b:[
    {p:["Todos os relatórios respeitam o período informado no topo. Sem data, consideram o histórico inteiro."]},
    {h:"Curva ABC",
     p:["Ordena os itens pelo valor consumido nas saídas. <b>Classe A</b> são os itens que somam os primeiros 80% do dinheiro — costumam ser poucos. <b>B</b> vai até 95% e <b>C</b> é o resto.",
        "Serve para decidir onde vale a pena negociar preço e o que precisa de controle apertado: é na classe A que 1% de desconto vira dinheiro de verdade."]},
    {h:"Custo por ordem de serviço",
     p:["Os 20 serviços mais caros do período, com o equipamento e a quantidade de itens. Só enxerga as saídas que tiveram a OS informada."]},
    {h:"Custo por equipamento",
     p:["Quanto cada máquina consumiu de almoxarifado no período. É o número que entra na conta de hora-máquina e na decisão de trocar um equipamento velho."]},
    {h:"Reposição sugerida",
     p:["Lista o que está no mínimo, quanto comprar para voltar ao máximo e o valor estimado pelo custo médio atual. Sai em CSV pronto para virar pedido de compra."]}
   ]},

  /* ------------------------------------------------------------ */
  {id:"ajustes",t:"Ajustes",ic:"⚙",
   r:"Identificação da obra, listas, usuários, backup e manutenção.",
   b:[
    {h:"Identificação",
     p:["Empresa e obra aparecem no cabeçalho do sistema e no e-mail de aviso. Vale preencher para não confundir obras diferentes."]},
    {h:"As listas",
     p:["<b>Categorias</b>, <b>Unidades</b>, <b>Localizações</b> e <b>Tipos de equipamento</b> alimentam os campos de seleção dos cadastros. Mantê-las curtas é o que impede o catálogo de virar bagunça — “Filtros” resolve melhor que “Filtro de óleo”, “Filtro de ar”, “Filtros diversos”."]},
    {h:"Backup",
     p:["<b>Baixar backup completo (JSON)</b> gera um arquivo com configuração, itens, frota, fornecedores, ferramentas, empréstimos, movimentos e inventários. Não é obrigatório — o Supabase já faz cópia — mas é bom guardar um de vez em quando fora dele."]},
    {h:"Conferir saldos com o histórico",
     p:["Recalcula o saldo de cada item somando todas as movimentações e mostra onde o saldo gravado não bate. Em uso normal nunca deve dar diferença; se der, mostre a tela antes de corrigir."]},
    {h:"Apagar dados de exemplo",
     p:["Só o administrador, e só uma vez: apaga os itens e equipamentos de demonstração que vieram com o sistema. Não toca em nada que a equipe cadastrou."]}
   ]},

  /* ------------------------------------------------------------ */
  {id:"email",t:"Aviso de estoque mínimo por e-mail",ic:"✉",
   r:"Um resumo por dia com tudo que chegou no mínimo.",
   b:[
    {h:"Como funciona",
     p:["Uma vez por dia o sistema olha o estoque e, se houver item no mínimo ou abaixo, manda um e-mail com a lista: part number, descrição, saldo, mínimo, quanto falta e o fornecedor habitual, mais a estimativa do que custaria repor tudo.",
        "Em dia sem nenhum item no mínimo, <b>nada é enviado</b> — de propósito. E-mail que chega todo dia dizendo que está tudo bem é e-mail que ninguém lê."]},
    {h:"Configurar",
     p:["<b>Ajustes › Aviso de estoque mínimo</b>, só para o administrador. Um e-mail por linha, quantos quiser. O botão <b>Enviar agora</b> dispara na hora, ignorando o liga/desliga, para testar."]},
    {h:"Por que é um resumo diário e não um e-mail por item",
     p:["Numa oficina várias saídas por dia cruzam o mínimo. Um e-mail por item faria a pessoa criar uma regra para mandar tudo para a lixeira na primeira semana."]},
    {h:"Domínio de envio",
     p:["Quem entrega o e-mail é o Resend. Para mandar para qualquer destinatário — incluindo endereços de fora da RENEA — o domínio <b>remetente</b> precisa estar verificado por três registros de DNS. Sem essa verificação, o Resend só entrega no e-mail do dono da conta."]}
   ]},

  /* ------------------------------------------------------------ */
  {id:"erp",t:"Integração com o ERP",ic:"⇆",
   r:"Como o ERP alimenta o almoxarifado sem ninguém digitar duas vezes.",
   b:[
    {p:["O sistema aceita ser alimentado por fora: o ERP pode cadastrar item, lançar entrada de nota e consultar saldo direto no banco, sem passar pela tela."]},
    {h:"A regra que não pode ser quebrada",
     p:["O ERP usa um <b>usuário próprio</b> (por exemplo erp@renea.com.br) com perfil almoxarife, nunca a chave de administrador do servidor. Todo lançamento fica com o nome dele no histórico, e se a integração fizer besteira dá para ver exatamente o que ela fez."]},
    {h:"Onde está o detalhe",
     p:["A especificação técnica completa — tabelas, funções, formato dos campos e exemplos de chamada — está no documento <b>INTEGRACAO-ERP.md</b>, que foi entregue para quem cuida do ERP."]}
   ]},

  /* ------------------------------------------------------------ */
  {id:"problemas",t:"Quando algo dá errado",ic:"⚠",
   r:"Os tropeços mais comuns e o que fazer.",
   b:[
    {h:"“Item não encontrado no cadastro”",
     p:["O part number digitado não existe ou o item está inativo. Confira em Estoque com o filtro Situação em <b>Inativos</b> — pode ser um item desativado por engano."]},
    {h:"“Saldo insuficiente”",
     p:["A saída é maior que o saldo. O sistema não deixa o estoque ficar negativo. Se a peça existe fisicamente e o sistema não sabe, o caminho é Inventário ou Movimentar › Ajuste, nunca forçar a saída."]},
    {h:"A tela não abre ou fica em branco",
     p:["Quase sempre é a pasta <b>assets</b> incompleta no servidor. Ao atualizar o sistema, suba a pasta assets <b>inteira</b> — app.js, manual.js, config.js, estilo.css e as imagens. Subir só o app.js apaga o resto."]},
    {h:"“Sessão expirada”",
     p:["Entre de novo. Nenhum lançamento se perde: o que já foi gravado está no banco."]},
    {h:"Número grande virou número pequeno",
     p:["Já corrigido, mas vale saber: em campos de quantidade, digite 5000 ou 5.000 — os dois são entendidos como cinco mil. Vírgula é decimal, ponto é milhar, como em português."]},
    {h:"O e-mail de aviso não chegou",
     p:["Três possibilidades, nesta ordem: não havia item no mínimo naquele dia (é o normal); o aviso está desligado em Ajustes; ou o domínio remetente ainda não está verificado. O botão <b>Enviar agora</b> mostra a mensagem de erro exata."]}
   ]}
  ],

  /* ------------------------------------------------------------ */
  /* Histórico de alterações — o mais recente em cima.            */
  mudancas:[
   {d:"2026-09-30",t:"Part number no lugar do código",
    p:"O campo Código saiu da tela de cadastro. Quem identifica a peça agora é o part number do fabricante, que aparece no estoque, no histórico, nos relatórios e nos CSV. Item sem part number ganha um código interno automático. O código antigo continua existindo por baixo, amarrando todo o histórico."},
   {d:"2026-09-30",t:"Manual dentro do sistema",
    p:"Esta tela. Passa a ser atualizada a cada mudança, com o registro do que mudou aqui embaixo."},
   {d:"2026-09-29",t:"Aviso de estoque mínimo por e-mail",
    p:"Resumo diário com os itens no mínimo, configurável em Ajustes pelo administrador, com botão de teste."},
   {d:"2026-09-29",t:"Controle de lubrificação",
    p:"Carta de lubrificação por equipamento vencendo por horímetro, litros abastecidos ou dias — o que chegar primeiro. Com leituras, execuções que dão baixa no estoque e cópia de carta entre equipamentos iguais."},
   {d:"2026-09-28",t:"Campo de part number",
    p:"Acrescentado ao cadastro de item e à busca."},
   {d:"2026-09-28",t:"Blindagem de segurança",
    p:"Funções do banco deixaram de aceitar chamada de visitante não autenticado. Corrigidas também duas falhas que permitiam a um usuário mudar o próprio perfil."},
   {d:"2026-09-27",t:"Nota com vários itens",
    p:"Tela de digitação de nota inteira, com todas as linhas gravadas de uma vez — e desfeitas juntas se alguma der erro."},
   {d:"2026-09-26",t:"Peças por equipamento",
    p:"Botão Peças na Frota, com o consolidado e o lançamento a lançamento. “Mecânico solicitante” passou a se chamar “Solicitado por”."},
   {d:"2026-09-25",t:"Cadastro de usuários pelo sistema",
    p:"O administrador cria usuário e define senha direto em Ajustes. O cadastro aberto pela tela de login foi desligado."}
  ]
};
