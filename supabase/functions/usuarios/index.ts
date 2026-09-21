// =====================================================================
// ALMOXARIFADO DA OFICINA — Edge Function "usuarios"
//
// Roda no servidor do Supabase, não no navegador. É o único lugar onde a
// chave service_role é usada — e ela nem aparece aqui: o Supabase injeta
// sozinho na variável de ambiente.
//
// Toda chamada é conferida duas vezes:
//   1. o token de quem chamou precisa ser válido;
//   2. essa pessoa precisa ter perfil 'admin' e estar ativa.
//
// Ações: criar | senha | listar
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const resp = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const URL_SB  = Deno.env.get("SUPABASE_URL")!;
const ANON    = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PAPEIS = ["admin", "almoxarife", "mecanico", "consulta"];
const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp({ erro: "Método não permitido." }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return resp({ erro: "Sem autenticação." }, 401);
  }

  // ---------------------------------------------------- quem está chamando
  const comoUsuario = createClient(URL_SB, ANON, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: eUser } = await comoUsuario.auth.getUser();
  if (eUser || !user) return resp({ erro: "Sessão expirada. Entre de novo." }, 401);

  const admin = createClient(URL_SB, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: perfil } = await admin
    .from("perfis").select("papel, ativo").eq("id", user.id).maybeSingle();

  if (!perfil || !perfil.ativo || perfil.papel !== "admin") {
    return resp({ erro: "Só o administrador pode gerenciar usuários." }, 403);
  }

  // ------------------------------------------------------------- pedido
  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch { return resp({ erro: "Requisição inválida." }, 400); }
  const acao = String(corpo.acao ?? "");

  // ------------------------------------------------------------- criar
  if (acao === "criar") {
    const email = String(corpo.email ?? "").trim().toLowerCase();
    const senha = String(corpo.senha ?? "");
    const nome  = String(corpo.nome  ?? "").trim();
    const papel = String(corpo.papel ?? "mecanico");

    if (!EMAIL_OK.test(email)) return resp({ erro: "Informe um e-mail válido." }, 400);
    if (nome.length < 2)       return resp({ erro: "Informe o nome da pessoa." }, 400);
    if (senha.length < 8)      return resp({ erro: "A senha precisa ter pelo menos 8 caracteres." }, 400);
    if (!PAPEIS.includes(papel)) return resp({ erro: "Perfil inválido." }, 400);

    const { data: novo, error: eCria } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,              // já entra confirmado, sem e-mail de ativação
      user_metadata: { nome },
    });

    if (eCria || !novo?.user) {
      const m = String(eCria?.message ?? "");
      if (/already|exist|registered|duplicate/i.test(m)) {
        return resp({ erro: "Já existe um usuário com esse e-mail." }, 409);
      }
      return resp({ erro: m || "Não foi possível criar o usuário." }, 400);
    }

    const { error: ePerfil } = await admin.rpc("definir_perfil_admin", {
      p_id: novo.user.id, p_nome: nome, p_papel: papel, p_ativo: true,
    });
    if (ePerfil) {
      return resp({
        erro: "O login foi criado, mas o perfil falhou: " + ePerfil.message +
              " — ajuste o perfil na própria lista de usuários.",
      }, 500);
    }

    return resp({ ok: true, id: novo.user.id, mensagem: "Usuário criado." });
  }

  // ------------------------------------------------------------- senha
  if (acao === "senha") {
    const id    = String(corpo.id ?? "");
    const senha = String(corpo.senha ?? "");
    if (!id)              return resp({ erro: "Usuário não informado." }, 400);
    if (senha.length < 8) return resp({ erro: "A senha precisa ter pelo menos 8 caracteres." }, 400);

    const { error } = await admin.auth.admin.updateUserById(id, { password: senha });
    if (error) return resp({ erro: error.message }, 400);
    return resp({ ok: true, mensagem: "Senha redefinida." });
  }

  // ------------------------------------------------------------ listar
  // Devolve só o e-mail e as datas — a lista de perfis o app já tem.
  if (acao === "listar") {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) return resp({ erro: error.message }, 400);
    return resp({
      ok: true,
      usuarios: data.users.map((u) => ({
        id: u.id,
        email: u.email ?? "",
        criado: u.created_at ?? null,
        ultimoAcesso: u.last_sign_in_at ?? null,
      })),
    });
  }

  return resp({ erro: "Ação desconhecida." }, 400);
});
