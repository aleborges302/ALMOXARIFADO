/* ---------------------------------------------------------------------
   CONFIGURAÇÃO — já preenchida com o projeto ALMOXARIFADO
   (organização Renea Infraestrutura, região Canada Central).

   Estes dois valores são públicos por natureza: eles rodam no navegador
   de qualquer pessoa que abrir o site. Quem protege os dados é o login
   somado às políticas de segurança (RLS) do arquivo supabase/03_rls.sql.
   Testado: sem login, a chave abaixo não devolve nenhuma linha.

   A chave "secret" / "service_role" NUNCA entra aqui nem no repositório.

   Se algum dia precisar trocar: Supabase > Project Settings > API Keys.
   A chave legada equivalente (formato eyJ..., aba "Legacy anon") também
   funciona, caso você prefira usá-la.
--------------------------------------------------------------------- */
window.APP_CONFIG = {
  url:     "https://jmqymhvaznqqwmgmbnnk.supabase.co",
  anonKey: "sb_publishable_p3q9do84ad1IGWqOEfpxsQ_wPHu6fEp"
};
