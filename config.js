/* ---------------------------------------------------------------------
   CONFIGURAÇÃO — o único arquivo que você precisa editar.

   Pegue os dois valores no painel do Supabase:
   Project Settings > API  →  "Project URL" e a chave "anon public".

   A chave anon é pública por natureza: ela vai no navegador de qualquer
   jeito. Quem protege os dados é o login e as políticas de segurança
   (RLS) do arquivo supabase/03_rls.sql — não o segredo da chave.
   A chave "service_role" NUNCA entra aqui nem no repositório.
--------------------------------------------------------------------- */
window.APP_CONFIG = {
  url:     "https://SEU-PROJETO.supabase.co",
  anonKey: "COLE-AQUI-A-CHAVE-ANON-PUBLIC"
};
