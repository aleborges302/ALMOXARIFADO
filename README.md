# Almoxarifado da Oficina

Controle de estoque da oficina de manutenção de caminhões, tratores e máquinas:
entradas com nota fiscal, requisições vinculadas a ordem de serviço e frota,
custo médio ponderado, ponto de reposição, inventário, curva ABC e controle de
ferramentas emprestadas.

**Banco de dados:** Supabase (PostgreSQL)
**Site:** arquivos estáticos — GitHub Pages, Vercel, Netlify ou Hostinger
**Sem build:** é HTML, CSS e JavaScript puro. Não precisa de Node nem de compilação.

---

## Estrutura

```
index.html                  aplicação
migrar.html                 importador do backup do sistema antigo (usar uma vez)
manifest.webmanifest        instalação como app no celular
sw.js                       cache da casca do app
assets/config.js            ÚNICO arquivo a editar: URL e chave do Supabase
assets/estilo.css           estilos
assets/app.js               aplicação
supabase/01_schema.sql      tabelas, trigger de proteção de saldo, view
supabase/02_funcoes.sql     regras de negócio (saldo, custo médio, empréstimos)
supabase/03_rls.sql         segurança por perfil (Row Level Security)
supabase/04_dados_iniciais.sql  listas iniciais e promoção do primeiro admin
supabase/05_cadastro_usuarios.sql  segurança do cadastro de usuário
supabase/functions/usuarios/index.ts  Edge Function que cria usuário e troca senha
```

---

## Situação atual (11/09/2026)

O banco **já está criado e configurado** no projeto `ALMOXARIFADO`
(organização Renea Infraestrutura, região Canada Central):

- ✅ `01_schema.sql`, `02_funcoes.sql` e `03_rls.sql` executados com sucesso
- ✅ Listas iniciais gravadas (categorias, unidades, locais, tipos de equipamento)
- ✅ `assets/config.js` já preenchido com a URL e a chave pública do projeto
- ⬜ **Falta criar o primeiro usuário** e promovê-lo a administrador (passos 1.3 e 1.4)
- ⬜ Falta subir os arquivos para o GitHub e publicar (Parte 2)

A Parte 1 abaixo fica como referência, e para o caso de você precisar
recriar o banco do zero algum dia.

---

## Parte 1 — Supabase (15 minutos)

### 1.1 Criar o projeto

1. Entre em <https://supabase.com> e crie a conta (o plano gratuito atende com folga:
   este sistema usa poucos MB por ano).
2. **New project** → nome `almoxarifado-oficina` → região **South America (São Paulo)**
   → defina a senha do banco e **guarde-a**.
3. Espere uns 2 minutos até o projeto ficar verde.

### 1.2 Criar as tabelas

No menu lateral, **SQL Editor** → **New query**. Cole e rode **um arquivo por vez,
nesta ordem**, conferindo "Success" antes de passar para o próximo:

1. `supabase/01_schema.sql`
2. `supabase/02_funcoes.sql`
3. `supabase/03_rls.sql`

### 1.3 Criar o primeiro usuário

1. **Authentication → Users → Add user → Create new user**
2. E-mail e senha da pessoa. Marque **Auto Confirm User** (sem isso ela não
   consegue entrar enquanto não confirmar o e-mail).

Só o primeiro precisa ser criado assim. Do segundo em diante, o administrador
cria pela própria tela do sistema: **Ajustes → Usuários → Novo usuário**
(ver Parte 5).

### 1.4 Definir o administrador

Abra `supabase/04_dados_iniciais.sql`, troque o e-mail na linha indicada pelo
e-mail do administrador, e rode o arquivo no SQL Editor.

Todo usuário novo nasce com o perfil **mecânico**. Depois de virar admin, você
muda o perfil dos demais direto na tela **Ajustes** do sistema — não precisa
mexer mais no SQL.

| Perfil | O que faz |
|---|---|
| **admin** | Tudo, inclusive definir perfis e apagar dados de exemplo |
| **almoxarife** | Lança entradas, saídas, ajustes, inventário, cadastros e baixa de ferramenta |
| **mecanico** | Só requisita saída e retira/devolve ferramenta |
| **consulta** | Só lê (supervisão, contabilidade) |

### 1.5 Copiar as credenciais

**Project Settings → API**, anote:

- **Project URL** — algo como `https://abcdefgh.supabase.co`
- **anon public** — chave longa começando com `eyJ...`

> A chave `anon` é pública por natureza: ela roda no navegador de qualquer
> visitante. O que protege os dados é o login somado às políticas de RLS do
> arquivo `03_rls.sql`. A chave **`service_role` nunca vai para o site nem para
> o repositório** — ela ignora todas as regras de segurança.

---

## Parte 2 — GitHub (10 minutos)

### 2.1 Criar o repositório

1. <https://github.com> → **New repository** → nome `almoxarifado-oficina`.
2. Escolha a visibilidade — leia a observação abaixo antes.
3. **Create repository**.

> **Atenção à visibilidade.** O GitHub Pages no plano gratuito só publica a
> partir de repositório **público**: o código (não os dados) fica visível para
> qualquer pessoa. Os dados continuam protegidos pelo login e pelo RLS, mas a
> RENEA pode preferir não expor o código. Se for o caso, deixe o repositório
> **privado** e publique pela **Vercel** ou **Netlify**, que servem repositório
> privado no plano gratuito — são os mesmos arquivos, muda só onde você clica
> em "Deploy". Pages a partir de repositório privado só existe no GitHub
> Enterprise Cloud.

### 2.2 Editar a configuração

Antes de subir, abra `assets/config.js` e troque os dois valores pelos que você
anotou no passo 1.5.

### 2.3 Subir os arquivos

**Pelo site, sem instalar nada:** no repositório vazio, clique em
**uploading an existing file**, arraste todos os arquivos e pastas do projeto e
clique em **Commit changes**.

**Pelo Git, se preferir linha de comando:**

```bash
cd almoxarifado-oficina
git init
git add .
git commit -m "Sistema de almoxarifado da oficina"
git branch -M main
git remote add origin https://github.com/SUA-CONTA/almoxarifado-oficina.git
git push -u origin main
```

### 2.4 Publicar

**Settings → Pages** → em *Source* escolha **Deploy from a branch** →
branch `main`, pasta `/ (root)` → **Save**.

Em 1 a 2 minutos o endereço aparece na própria página:
`https://SUA-CONTA.github.io/almoxarifado-oficina/`

### 2.5 Domínio próprio (opcional)

Para usar `almoxarifado.renea.com.br`:

1. No DNS do domínio (Hostinger, se for lá que ele está), crie um registro
   **CNAME** com nome `almoxarifado` apontando para `SUA-CONTA.github.io`.
2. Em **Settings → Pages → Custom domain**, digite `almoxarifado.renea.com.br`
   e salve. Marque **Enforce HTTPS** quando o certificado ficar pronto
   (leva alguns minutos).

### 2.6 Restringir o acesso no Supabase

De volta ao Supabase, em **Authentication → URL Configuration**, coloque o
endereço do site em **Site URL** e em **Redirect URLs**. Isso faz o link de
"esqueci minha senha" voltar para o lugar certo.

---

## Parte 3 — Migrar o que já existe

Se você já vem usando a versão anterior do sistema:

1. No sistema antigo: **Ajustes → Baixar backup completo (JSON)**.
2. Abra `https://SEU-ENDERECO/migrar.html`.
3. Entre com o usuário **admin**, escolha o arquivo e clique em **Importar**.

Os itens entram com saldo e custo médio já calculados; o histórico entra como
registro, sem recalcular saldo (por isso a ordem importa — importe o item antes
do histórico, que é o que a página já faz sozinha).

Depois da migração, abra **Ajustes → Conferir saldos com o histórico** para ver
se algo divergiu.

---

## Parte 4 — Usar no celular

O site é responsivo e instalável:

- **Android (Chrome):** menu ⋮ → *Instalar aplicativo*
- **iPhone (Safari):** botão compartilhar → *Adicionar à Tela de Início*

Fica com ícone próprio e abre em tela cheia. O botão **Ler código** nas telas de
movimentação usa a câmera para ler código de barras e QR — funciona no Chrome
para Android; no iPhone o campo continua manual.

**Dica de implantação:** imprima etiquetas com o código de cada item em formato
Code 128 e cole na prateleira. O almoxarife aponta a câmera e o item já vem
selecionado — é o que faz o controle sobreviver ao dia a dia da oficina.

---

## Parte 5 — Cadastro de usuário pela tela do sistema

O administrador cria usuário, define o perfil e redefine senha direto em
**Ajustes → Usuários**, sem abrir o painel do Supabase.

Isso exige três coisas, feitas uma vez só:

### 5.1 Rodar `supabase/05_cadastro_usuarios.sql`

No SQL Editor, como os outros. Além de preparar o cadastro, ele fecha duas
falhas que existiam antes:

- o perfil vinha do `raw_user_meta_data`, preenchido pelo navegador de quem se
  cadastra — dava para criar uma conta já como **admin**;
- a proteção do perfil testava `papel() <> 'admin'`, e para quem está bloqueado
  `papel()` é NULO — em SQL, `NULL <> 'admin'` não é verdadeiro, então a
  proteção era pulada e o usuário bloqueado conseguia **se liberar e se
  promover** editando a própria linha.

Depois do arquivo 05, todo usuário novo nasce **mecânico e bloqueado**, e só o
administrador libera.

### 5.2 Publicar a Edge Function `usuarios`

Criar usuário exige a chave de administrador do Supabase, que **não pode ficar
no navegador**. A Edge Function roda no servidor do Supabase, confere se quem
chamou é admin e só então cria o login.

No painel: **Edge Functions → Deploy a new function → Via editor**, nome
`usuarios`, cole o conteúdo de `supabase/functions/usuarios/index.ts` e
publique. A chave de serviço já está disponível lá dentro como variável de
ambiente — não precisa configurar nada.

### 5.3 Desligar o cadastro público

**Authentication → Sign In / Providers → Email → Allow new users to sign up:
desligado.** A partir daí, ninguém de fora consegue nem tentar criar conta: o
único caminho é o administrador pela tela do sistema.

---

## Manutenção

| O quê | Onde | Quando |
|---|---|---|
| Backup dos dados | Ajustes → Baixar backup (JSON) | Mensal, guardar na rede da empresa |
| Backup do banco | Supabase → Database → Backups | Automático no plano pago; no gratuito use o JSON |
| Novo usuário | Sistema → Ajustes → Usuários → **Novo usuário** | Quando entrar alguém na equipe |
| Trocar senha de alguém | Sistema → Ajustes → Usuários → **Senha** | Quando a pessoa esquecer |
| Bloquear usuário | Sistema → Ajustes → Usuários → Bloqueado | Na saída da pessoa |
| Atualizar o sistema | Commit no GitHub | Publica sozinho em ~1 minuto |

O projeto gratuito do Supabase **hiberna após alguns dias sem nenhum acesso** —
a primeira abertura depois disso demora alguns segundos e nada se perde. Com uso
diário isso não acontece.

---

## Decisões técnicas, em resumo

- **Saldo não é editável direto.** Um trigger no banco impede alterar `saldo` e
  `custo_medio` fora das funções de movimentação. Mesmo quem tem acesso ao
  painel do Supabase não "acerta" um saldo sem deixar rastro no histórico.
- **Custo médio ponderado** recalculado a cada entrada; saídas baixam pelo custo
  médio vigente. É o critério aceito pela contabilidade brasileira.
- **Concorrência resolvida no banco.** As funções travam a linha do item
  (`SELECT ... FOR UPDATE`), então dois lançamentos simultâneos do mesmo item
  entram em fila em vez de sobrescrever um ao outro.
- **Histórico é imutável pelo aplicativo.** Não há política de UPDATE nem DELETE
  em `movimentos`: erro se corrige com um ajuste, que fica registrado.
- **Item com histórico não é excluído**, só inativado — senão o histórico ficaria
  órfão.
