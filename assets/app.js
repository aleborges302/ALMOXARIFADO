"use strict";
/* =====================================================================
   ALMOXARIFADO DA OFICINA — aplicação (Supabase + GitHub Pages)
   Todo o estado vive no Postgres do Supabase. Este arquivo é só a tela.
   ===================================================================== */

/* ------------------------------------------------------------- utilidades */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const BRL=v=>(Number(v)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const NUM=(v,d=2)=>(Number(v)||0).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
const INT=v=>(Number(v)||0).toLocaleString("pt-BR");
/* Numero para DENTRO de input: sem separador de milhar, senao 5.000 volta como 5. */
const NUMIN=(v,d=0)=>(Number(v)||0).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d,useGrouping:false});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function pnum(s){if(typeof s==="number")return isFinite(s)?s:0;if(s==null||s==="")return 0;let t=String(s).trim().replace(/\s|R\$/g,"");
  if(t.includes(","))t=t.replace(/\./g,"").replace(",",".");
  else if(/^-?\d{1,3}(\.\d{3})+$/.test(t))t=t.replace(/\./g,"");  /* 5.000 e 1.234.567 sao milhar, nao decimal */const n=parseFloat(t);return isFinite(n)?n:0;}
const hoje=()=>new Date(new Date().getTime()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);
const mesDe=d=>String(d||"").slice(0,7);
const dbr=d=>{const p=String(d||"").slice(0,10).split("-");return p.length===3?p[2]+"/"+p[1]+"/"+p[0]:(d||"");};
const MESN=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const mesLbl=m=>{const p=String(m).split("-");return p[1]?MESN[+p[1]-1]+"/"+p[0].slice(2):m;};
function lsGet(k,d){try{const v=localStorage.getItem(k);return v==null?d:v;}catch(e){return d;}}
function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}

function toast(msg,kind){const el=document.createElement("div");el.className="toast"+(kind?" "+kind:"");el.textContent=msg;$("#toasts").appendChild(el);setTimeout(()=>el.remove(),kind==="e"?8000:4000);}
function fecharModal(){$("#modal").innerHTML="";pararLeitor();}
function modal(titulo,corpo,rodape){
  $("#modal").innerHTML='<div class="scrim" id="scrim"><div class="dlg" role="dialog" aria-modal="true" aria-label="'+esc(titulo)+'"><header><h3>'+esc(titulo)+'</h3><button class="x" id="mx" aria-label="Fechar">&times;</button></header><div class="pad">'+corpo+'</div>'+(rodape?'<footer>'+rodape+'</footer>':'')+'</div></div>';
  $("#mx").onclick=fecharModal;
  $("#scrim").addEventListener("mousedown",e=>{if(e.target.id==="scrim")fecharModal();});
}
const TIPOS={inicial:"Saldo inicial",entrada:"Entrada",saida:"Saída",devolucao:"Devolução",ajuste:"Ajuste"};
const TIPOTAG={inicial:"t-pri",entrada:"t-ok",saida:"t-warn",devolucao:"t-pri",ajuste:"t-neu"};
const PAPEIS={admin:"Administrador",almoxarife:"Almoxarife",mecanico:"Mecânico",consulta:"Consulta"};

/* ----------------------------------------------------------------- estado */
const SB=window.supabase.createClient(window.APP_CONFIG.url,window.APP_CONFIG.anonKey,
  {auth:{persistSession:true,autoRefreshToken:true}});
const S={user:null,perfil:null,perfis:[],emails:{},emailsOk:false,cfg:null,itens:[],movs:[],frota:[],forn:[],ferr:[],emps:[],invs:[],lubP:[],lubL:[],lubE:[],
  view:lsGet("almox.view","painel"),carregando:true};
const CFG_PADRAO={empresa:"",obra:"Oficina de manutenção",categorias:[],unidades:["UN"],locais:[],tiposFrota:[],alertaEmails:[],alertaAtivo:false};
const cfg=()=>S.cfg||CFG_PADRAO;
const papel=()=>S.perfil?S.perfil.papel:"";
const podeLancar=()=>["admin","almoxarife"].includes(papel());
const podeRequisitar=()=>["admin","almoxarife","mecanico"].includes(papel());
const ehAdmin=()=>papel()==="admin";

const mI=r=>({_id:r.id,codigo:r.codigo,partNumber:r.part_number||"",descricao:r.descricao,categoria:r.categoria||"",unidade:r.unidade||"",local:r.local||"",
  estoqueMin:+r.estoque_min||0,estoqueMax:+r.estoque_max||0,saldo:+r.saldo||0,custoMedio:+r.custo_medio||0,
  aplicacao:r.aplicacao||"",fornecedor:r.fornecedor||"",ativo:r.ativo!==false,exemplo:!!r.exemplo});
const mM=r=>({id:r.id,data:r.data,tipo:r.tipo,codigo:r.codigo,descricao:r.descricao||"",un:r.unidade||"",qtd:+r.qtd||0,
  vlrUnit:+r.vlr_unit||0,vlrTotal:+r.vlr_total||0,saldoPosterior:r.saldo_posterior==null?null:+r.saldo_posterior,
  os:r.os||"",frota:r.frota||"",solicitante:r.solicitante||"",fornecedor:r.fornecedor||"",nf:r.nf||"",obs:r.obs||"",usuario:r.usuario_nome||""});
const mV=r=>({_id:r.id,codigo:r.codigo,tipo:r.tipo||"",marcaModelo:r.marca_modelo||"",placa:r.placa||"",ano:r.ano||"",
  local:r.local||"",ativo:r.ativo!==false,exemplo:!!r.exemplo});
const mLP=r=>({_id:r.id,frotaId:r.frota_id,frota:r.frota,ordem:+r.ordem||1,componente:r.componente,
  itemCodigo:r.item_codigo||"",lubrificante:r.lubrificante||"",qtd:+r.qtd||0,unidade:r.unidade||"",
  metodo:r.metodo||"graxa",intHoras:+r.int_horas||0,intLitros:+r.int_litros||0,intDias:+r.int_dias||0,
  criticidade:r.criticidade||"media",procedimento:r.procedimento||"",
  ultimaHoras:r.ultima_horas==null?null:+r.ultima_horas,ultimaLitros:r.ultima_litros==null?null:+r.ultima_litros,
  ultimaData:r.ultima_data||"",ativo:r.ativo!==false,
  horasAtuais:+r.horas_atuais||0,litrosAtuais:+r.litros_atuais||0,
  horasDesde:+r.horas_desde||0,litrosDesde:+r.litros_desde||0,diasDesde:+r.dias_desde||0,consumo:+r.consumo||0});
const mLL=r=>({id:r.id,frota:r.frota,data:r.data,horimetro:r.horimetro==null?null:+r.horimetro,
  litros:r.litros==null?null:+r.litros,obs:r.obs||"",usuario:r.usuario_nome||""});
const mLE=r=>({id:r.id,pontoId:r.ponto_id,frota:r.frota,componente:r.componente||"",data:r.data,
  horimetro:r.horimetro==null?null:+r.horimetro,litrosAcum:r.litros_acum==null?null:+r.litros_acum,
  qtd:+r.qtd||0,itemCodigo:r.item_codigo||"",responsavel:r.responsavel||"",obs:r.obs||"",usuario:r.usuario_nome||""});
const mO=r=>({_id:r.id,nome:r.nome,cnpj:r.cnpj||"",contato:r.contato||"",telefone:r.telefone||"",email:r.email||"",obs:r.obs||"",exemplo:!!r.exemplo});
const mT=r=>({_id:r.id,codigo:r.codigo,descricao:r.descricao,marca:r.marca||"",patrimonio:r.patrimonio||"",
  quantidade:+r.quantidade||0,local:r.local||"",obs:r.obs||"",emCampo:+r.em_campo||0,disponivel:+r.disponivel||0,exemplo:!!r.exemplo});
const mE=r=>({id:r.id,codigo:r.codigo,descricao:r.descricao||"",qtd:+r.qtd||0,retiradoEm:r.retirado_em,previsao:r.previsao||"",
  retiradoPor:r.retirado_por||"",os:r.os||"",frota:r.frota||"",obs:r.obs||"",situacao:r.situacao,devolvidoEm:r.devolvido_em||"",
  recebidoPor:r.recebido_por||"",motivo:r.motivo||"",obsDevolucao:r.obs_devolucao||"",usuario:r.usuario_nome||""});

const movsAll=()=>S.movs;
const empAll=()=>S.emps;
const empAbertos=()=>S.emps.filter(e=>e.situacao==="aberto");
const empAtrasados=()=>empAbertos().filter(e=>e.previsao&&e.previsao<hoje());
const pnDe=x=>{const i=(x&&typeof x==="object")?x:S.itens.find(y=>y.codigo===x);return (i&&i.partNumber)?i.partNumber:(i?i.codigo:(x||""));};
const itemPor=c=>{const v=String(c||"").trim().toUpperCase();
  return S.itens.find(i=>i.codigo===v) || S.itens.find(i=>i.partNumber&&i.partNumber.toUpperCase()===v);};
const valorEstoque=()=>S.itens.reduce((s,i)=>s+i.saldo*i.custoMedio,0);
const abaixoMin=()=>S.itens.filter(i=>i.ativo&&i.estoqueMin>0&&i.saldo<=i.estoqueMin);
function dispFerr(cod){const f=S.ferr.find(x=>x.codigo===cod);return f?{tot:f.quantidade,fora:f.emCampo,disp:f.disponivel}:{tot:0,fora:0,disp:0};}
function nomeFrota(c){const f=S.frota.find(x=>x.codigo===c);return f?f.codigo+" · "+(f.marcaModelo||f.tipo||""):c;}
function itensSemMovimento(dias){
  const lim=new Date(Date.now()-dias*864e5).toISOString().slice(0,10),ult={};
  for(const m of S.movs){if(!ult[m.codigo]||String(m.data)>ult[m.codigo])ult[m.codigo]=m.data;}
  return S.itens.filter(i=>i.saldo>0&&(!ult[i.codigo]||ult[i.codigo]<lim));
}
function erroMsg(e){
  if(!e)return "Não foi possível concluir.";
  const m=String(e.message||e.error_description||e);
  if(/Invalid login credentials/i.test(m))return "E-mail ou senha incorretos.";
  if(/Email not confirmed/i.test(m))return "E-mail ainda não confirmado. Peça ao administrador para confirmar sua conta.";
  if(/Failed to fetch|NetworkError/i.test(m))return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  if(/duplicate key|already exists/i.test(m))return "Já existe um registro com esse código.";
  if(/violates row-level security/i.test(m))return "Seu perfil não tem permissão para essa operação.";
  return m;
}

/* -------------------------------------------------------------- login */
function telaLogin(msg){
  $("#raiz").innerHTML='<div class="login"><div class="box">'
   +'<div class="mark"><i></i><div><h1>Almoxarifado<small>Oficina de manutenção</small></h1></div></div>'
   +'<form id="fl" autocomplete="on">'
   +(msg?'<div class="err">'+esc(msg)+'</div>':'')
   +'<label class="f">E-mail<input id="l_em" type="email" autocomplete="username" required></label>'
   +'<label class="f">Senha<input id="l_pw" type="password" autocomplete="current-password" required></label>'
   +'<button class="btn pri" id="l_ok" type="submit" style="justify-content:center">Entrar</button>'
   +'<button class="btn gh sm" id="l_rec" type="button" style="justify-content:center">Esqueci minha senha</button>'
   +'</form>'
   +'<p class="fine" style="margin-top:14px">O acesso é criado pelo administrador do almoxarifado.</p>'
   +'</div></div>';
  $("#fl").onsubmit=async ev=>{
    ev.preventDefault();
    const b=$("#l_ok");b.disabled=true;b.textContent="Entrando…";
    const {error}=await SB.auth.signInWithPassword({email:$("#l_em").value.trim(),password:$("#l_pw").value});
    if(error){telaLogin(erroMsg(error));return;}
    location.reload();
  };
  $("#l_rec").onclick=async()=>{
    const em=$("#l_em").value.trim();
    if(!em){toast("Digite seu e-mail primeiro.","e");return;}
    const {error}=await SB.auth.resetPasswordForEmail(em,{redirectTo:location.href});
    toast(error?erroMsg(error):"Se esse e-mail estiver cadastrado, o link de redefinição foi enviado.",error?"e":"s");
  };
}
async function sair(){await SB.auth.signOut();location.reload();}

/* --------------------------------------------------------- carregamento */
async function carregarTudo(){
  const p=q=>q.then(r=>{if(r.error)throw r.error;return r.data||[];});
  try{
    const [cfgR,itens,movs,frota,forn,ferr,emps,invs,perfis,lubP,lubL,lubE]=await Promise.all([
      SB.from("config").select("*").eq("id",1).maybeSingle(),
      p(SB.from("itens").select("*").order("descricao")),
      p(SB.from("movimentos").select("*").order("data",{ascending:false}).order("id",{ascending:false}).limit(5000)),
      p(SB.from("frota").select("*").order("codigo")),
      p(SB.from("fornecedores").select("*").order("nome")),
      p(SB.from("v_ferramentas").select("*").order("descricao")),
      p(SB.from("emprestimos").select("*").order("retirado_em",{ascending:false}).order("id",{ascending:false}).limit(3000)),
      p(SB.from("inventarios").select("*").order("data",{ascending:false}).limit(200)),
      p(SB.from("perfis").select("*").order("nome")),
      p(SB.from("v_lub_status").select("*").order("frota").order("ordem")),
      p(SB.from("lub_leituras").select("*").order("data",{ascending:false}).order("id",{ascending:false}).limit(2000)),
      p(SB.from("lub_execucoes").select("*").order("data",{ascending:false}).order("id",{ascending:false}).limit(2000))
    ]);
    const c=cfgR&&cfgR.data;
    S.cfg=c?{empresa:c.empresa||"",obra:c.obra||"",categorias:c.categorias||[],unidades:c.unidades||["UN"],
      locais:c.locais||[],tiposFrota:c.tipos_frota||[],
      alertaEmails:c.alerta_emails||[],alertaAtivo:c.alerta_ativo===true}:null;
    S.itens=itens.map(mI);S.movs=movs.map(mM);S.frota=frota.map(mV);S.forn=forn.map(mO);
    S.ferr=ferr.map(mT);S.emps=emps.map(mE);
    S.invs=invs.map(r=>({_id:r.id,data:r.data,responsavel:r.responsavel||"",local:r.local||"",categoria:r.categoria||"",
      impacto:+r.impacto||0,linhas:r.linhas||[]}));
    S.perfis=perfis;
    S.lubP=lubP.map(mLP);S.lubL=lubL.map(mLL);S.lubE=lubE.map(mLE);
    S.carregando=false;
    render();
  }catch(e){
    S.carregando=false;
    $("#raiz").innerHTML='<div class="login"><div class="box"><div class="panel pad"><h3>Não foi possível carregar</h3>'
      +'<p class="fine">'+esc(erroMsg(e))+'</p><p class="fine">Se a mensagem fala em permissão, seu usuário ainda não tem perfil ativo — peça ao administrador.</p>'
      +'<button class="btn" id="er_sair">Sair</button></div></div></div>';
    $("#er_sair").onclick=sair;
  }
}
let recTimer=null;
function recarregarBreve(){clearTimeout(recTimer);recTimer=setTimeout(carregarTudo,500);}
function ligarRealtime(){
  SB.channel("almox")
    .on("postgres_changes",{event:"*",schema:"public"},recarregarBreve)
    .subscribe();
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)recarregarBreve();});
}

/* ------------------------------------------------------------ gravações */
async function rpc(nome,args){
  const {data,error}=await SB.rpc(nome,args);
  if(error)throw error;
  return data;
}
async function gravarMov(m){
  return rpc("registrar_movimento",{p_codigo:m.codigo,p_tipo:m.tipo,p_qtd:m.qtd,p_vlr_unit:m.vlrUnit||0,
    p_data:m.data,p_os:m.os||null,p_frota:m.frota||null,p_solicitante:m.solicitante||null,
    p_fornecedor:m.fornecedor||null,p_nf:m.nf||null,p_obs:m.obs||null});
}
async function salvarCfg(patch){
  const c=cfg();
  const linha={id:1,empresa:patch.empresa!==undefined?patch.empresa:c.empresa,obra:patch.obra!==undefined?patch.obra:c.obra,
    categorias:patch.categorias||c.categorias,unidades:patch.unidades||c.unidades,locais:patch.locais||c.locais,
    tipos_frota:patch.tiposFrota||c.tiposFrota,
    alerta_emails:patch.alertaEmails!==undefined?patch.alertaEmails:c.alertaEmails,
    alerta_ativo:patch.alertaAtivo!==undefined?patch.alertaAtivo:c.alertaAtivo,
    atualizado_em:new Date().toISOString()};
  const {error}=await SB.from("config").upsert(linha);
  if(error)throw error;
  await carregarTudo();
}

/* -------------------------------------------------------------- shell */
const VIEWS=[
  {g:"Operação"},
  {id:"painel",n:"Painel",ic:"◧"},
  {id:"movimentar",n:"Movimentar",ic:"⇄"},
  {id:"estoque",n:"Estoque",ic:"▤"},
  {id:"historico",n:"Histórico",ic:"≡"},
  {g:"Cadastros"},
  {id:"frota",n:"Frota",ic:"⛟"},
  {id:"fornecedores",n:"Fornecedores",ic:"⌂"},
  {g:"Controle"},
  {id:"ferramentas",n:"Ferramentas",ic:"⚒"},
  {id:"lubrificacao",n:"Lubrificação",ic:"◌"},
  {id:"inventario",n:"Inventário",ic:"☑"},
  {id:"relatorios",n:"Relatórios",ic:"▦"},
  {id:"ajustes",n:"Ajustes",ic:"⚙"},
  {g:"Ajuda"},
  {id:"manual",n:"Manual",ic:"?"}
];
function montarShell(){
  $("#raiz").innerHTML='<div class="app"><nav class="rail" id="rail" aria-label="Módulos"></nav><main>'
   +'<div class="topbar"><div class="obra" id="obraLbl"></div><div class="sep" aria-hidden="true"></div>'
   +'<div class="fine" id="statusLbl"></div>'
   +'<div class="who"><div style="text-align:right"><div id="whoNome" style="font-weight:600;color:var(--ink)"></div>'
   +'<div class="papel" id="whoPapel"></div></div>'
   +'<button class="btn sm gh" id="btConta">Conta</button><button class="btn sm gh" id="btSair">Sair</button></div></div>'
   +'<div class="wrap" id="view"></div></main></div>';
  $("#btSair").onclick=sair;
  $("#btConta").onclick=telaConta;
}
function montarRail(){
  const n=abaixoMin().length,at=empAtrasados().length;
  let h='<div class="brand"><div class="mk"></div><div><b>Almoxarifado</b><span>Oficina de manutenção</span></div></div>';
  for(const v of VIEWS){
    if(v.g){h+='<div class="navgrp">'+v.g+'</div>';continue;}
    const lv=S.lubP.filter(p=>p.consumo>=1).length;
    const bd=v.id==="estoque"&&n?'<span class="bdg" title="itens no mínimo">'+n+'</span>'
      :(v.id==="ferramentas"&&at?'<span class="bdg" title="retiradas em atraso">'+at+'</span>'
      :(v.id==="lubrificação"||v.id==="lubrificacao")&&lv?'<span class="bdg" title="pontos vencidos">'+lv+'</span>':'');
    h+='<button class="nav" data-v="'+v.id+'" aria-current="'+(S.view===v.id)+'"><span class="ic" aria-hidden="true">'+v.ic+'</span>'+v.n+bd+'</button>';
  }
  const rail=$("#rail");rail.innerHTML=h;
  $$(".nav",rail).forEach(b=>b.onclick=()=>{S.view=b.dataset.v;lsSet("almox.view",S.view);fecharModal();render();window.scrollTo(0,0);});
}
function telaConta(){
  modal("Minha conta",'<div class="grid">'
   +'<div><div class="fine">Usuário</div><div style="font-weight:600">'+esc(S.perfil?S.perfil.nome:"")+'</div>'
   +'<div class="fine">'+esc(S.user?S.user.email:"")+' · '+esc(PAPEIS[papel()]||papel())+'</div></div>'
   +'<label class="f">Meu nome no sistema<input id="ct_nm" value="'+esc(S.perfil?S.perfil.nome:"")+'"></label>'
   +'<label class="f">Nova senha<input id="ct_pw" type="password" placeholder="deixe em branco para não trocar" autocomplete="new-password"></label>'
   +'</div>','<button class="btn gh" id="ct_x">Fechar</button><button class="btn pri" id="ct_ok">Salvar</button>');
  $("#ct_x").onclick=fecharModal;
  $("#ct_ok").onclick=async()=>{
    try{
      const nm=$("#ct_nm").value.trim();
      if(nm&&nm!==S.perfil.nome){const {error}=await SB.from("perfis").update({nome:nm}).eq("id",S.user.id);if(error)throw error;}
      const pw=$("#ct_pw").value;
      if(pw){if(pw.length<8){toast("A senha precisa ter ao menos 8 caracteres.","e");return;}
        const {error}=await SB.auth.updateUser({password:pw});if(error)throw error;}
      fecharModal();toast("Conta atualizada.","s");await carregarPerfil();await carregarTudo();
    }catch(e){toast(erroMsg(e),"e");}
  };
}

/* ------------------------------------------------------------- render */
function render(){
  if(!$("#rail"))montarShell();
  montarRail();
  $("#obraLbl").textContent=(cfg().empresa?cfg().empresa+" · ":"")+(cfg().obra||"Almoxarifado");
  $("#whoNome").textContent=S.perfil?S.perfil.nome:"";
  $("#whoPapel").textContent=PAPEIS[papel()]||"";
  $("#statusLbl").textContent=S.carregando?"carregando…":INT(S.itens.length)+" itens · "+INT(S.movs.length)+" lançamentos";
  const v=$("#view");
  ({painel:vPainel,estoque:vEstoque,movimentar:vMovimentar,historico:vHistorico,frota:vFrota,fornecedores:vForn,
    ferramentas:vFerramentas,lubrificacao:vLubrificacao,inventario:vInventario,relatorios:vRelatorios,ajustes:vAjustes,
    manual:vManual}[S.view]||vPainel)(v);
}
function head(t,sub,acts){return '<div class="viewhead"><div><h2>'+esc(t)+'</h2>'+(sub?'<p>'+esc(sub)+'</p>':'')+'</div>'+(acts?'<div class="acts">'+acts+'</div>':'')+'</div>';}
function kpi(k,v,s,cls){return '<div class="kpi '+(cls||"")+'"><div class="k">'+esc(k)+'</div><div class="v">'+v+'</div><div class="s">'+esc(s||"")+'</div></div>';}
function bar(lb,val,frac,cls){return '<div class="bar"><div class="lb"><b>'+esc(lb)+'</b><span>'+val+'</span></div><div class="track"><div class="fill '+(cls||"")+'" style="width:'+Math.max(1,Math.round(frac*100))+'%"></div></div></div>';}
function ligarGo(el){$$("[data-go]",el).forEach(b=>b.onclick=()=>{S.view=b.dataset.go;lsSet("almox.view",S.view);render();window.scrollTo(0,0);});}
function soLeitura(){return papel()==="consulta"?'<div class="note" style="margin-bottom:14px">Seu perfil é <b>somente consulta</b>: você vê tudo, mas não pode lançar.</div>':'';}

/* ------------------------------------------------------------- Painel */
function vPainel(el){
  const movs=S.movs,mAtual=mesDe(hoje());
  const doMes=movs.filter(m=>mesDe(m.data)===mAtual);
  const sai=doMes.filter(m=>m.tipo==="saida"),ent=doMes.filter(m=>m.tipo==="entrada");
  const vSai=sai.reduce((s,m)=>s+m.vlrTotal,0),vEnt=ent.reduce((s,m)=>s+m.vlrTotal,0);
  const low=abaixoMin();
  const meses=[];for(let i=5;i>=0;i--){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);meses.push(d.toISOString().slice(0,7));}
  const serie=meses.map(m=>({m,s:movs.filter(x=>mesDe(x.data)===m&&x.tipo==="saida").reduce((a,b)=>a+b.vlrTotal,0),
    e:movs.filter(x=>mesDe(x.data)===m&&x.tipo==="entrada").reduce((a,b)=>a+b.vlrTotal,0)}));
  const topSerie=Math.max(1,...serie.map(x=>Math.max(x.s,x.e)));
  const porEq={};for(const m of movs){if(m.tipo!=="saida"||!m.frota)continue;porEq[m.frota]=(porEq[m.frota]||0)+m.vlrTotal;}
  const eq=Object.entries(porEq).sort((a,b)=>b[1]-a[1]).slice(0,7),topEq=Math.max(1,...eq.map(x=>x[1]));

  let h=head("Painel","Situação do almoxarifado da oficina em "+dbr(hoje())+".",
    (podeRequisitar()?'<button class="btn pri" data-go="movimentar">Registrar movimento</button>':'')
    +'<button class="btn" data-go="relatorios">Relatórios</button>')+soLeitura();
  h+='<div class="kpis">'
   +kpi("Valor em estoque",BRL(valorEstoque()),INT(S.itens.length)+" itens cadastrados")
   +kpi("Abaixo do mínimo",INT(low.length),low.length?"reposição necessária":"nenhum item crítico",low.length?"al":"")
   +kpi("Saídas do mês",BRL(vSai),INT(sai.length)+" requisições")
   +kpi("Entradas do mês",BRL(vEnt),INT(ent.length)+" notas lançadas")
   +kpi("Itens sem saldo",INT(S.itens.filter(i=>i.saldo<=0).length),"conferir na próxima compra")
   +kpi("Ferramentas em campo",INT(empAbertos().reduce((s,e)=>s+e.qtd,0)),empAtrasados().length?INT(empAtrasados().length)+" em atraso":"nenhuma em atraso",empAtrasados().length?"al":"")
   +'</div>';
  h+='<div class="cols"><div class="grid" style="gap:16px">';
  h+='<div class="panel"><header><h3>Entradas e saídas por mês</h3><div class="r">valores em R$</div></header><div class="pad">'
   +'<div class="mo">'+serie.map(x=>'<div class="col"><div class="stk"><div class="b1" style="height:'+Math.max(2,Math.round(x.e/topSerie*46))+'px" title="Entradas '+BRL(x.e)+'"></div><div class="b2" style="height:'+Math.max(2,Math.round(x.s/topSerie*46))+'px" title="Saídas '+BRL(x.s)+'"></div></div><div class="cap">'+mesLbl(x.m)+'</div></div>').join("")+'</div>'
   +'<div class="lgd"><span><i style="background:var(--primary)"></i>Entradas</span><span><i style="background:var(--accent)"></i>Saídas (consumo)</span><span style="margin-left:auto;font-family:var(--mono)">máx. '+BRL(topSerie)+'</span></div></div></div>';
  h+='<div class="panel"><header><h3>Consumo por equipamento</h3><div class="r">acumulado</div></header><div class="pad">'
   +(eq.length?'<div class="bars">'+eq.map(([k,v])=>bar(nomeFrota(k),BRL(v),v/topEq,"a")).join("")+'</div>'
   :'<div class="empty"><b>Sem consumo lançado</b>Vincule as saídas a uma frota para ver o custo por equipamento.</div>')+'</div></div>';
  h+='<div class="panel"><header><h3>Últimas movimentações</h3><div class="r"><button class="btn sm gh" data-go="historico">Ver histórico</button></div></header>'+tabMovs(movs.slice(0,10),true)+'</div>';
  h+='</div><div class="grid" style="gap:16px">';
  h+='<div class="panel"><header><h3>Reposição necessária</h3><div class="r">'+INT(low.length)+'</div></header>'
   +(low.length?'<div class="tw"><table><thead><tr><th>Item</th><th class="num">Saldo</th><th class="num">Mín.</th><th class="num">Comprar</th></tr></thead><tbody>'
     +low.slice(0,12).map(i=>{const alvo=i.estoqueMax>0?i.estoqueMax:i.estoqueMin*2;const q=Math.max(0,alvo-i.saldo);
       return '<tr class="low"><td><div class="cod">'+esc(pnDe(i))+'</div><div class="mut">'+esc(i.descricao)+'</div></td><td class="num">'+NUM(i.saldo,2)+'</td><td class="num">'+NUM(i.estoqueMin,2)+'</td><td class="num"><b>'+NUM(q,2)+'</b><div class="mut">'+BRL(q*i.custoMedio)+'</div></td></tr>';}).join("")
     +'</tbody></table></div>'+(low.length>12?'<div class="pad fine">+'+(low.length-12)+' outros itens no mínimo.</div>':'')
   :'<div class="empty"><b>Estoque em ordem</b>Nenhum item chegou ao ponto de reposição.</div>')+'</div>';
  const semMov=itensSemMovimento(90);
  h+='<div class="panel"><header><h3>Parados há 90 dias</h3><div class="r">'+INT(semMov.length)+'</div></header>'
   +(semMov.length?'<div class="tw"><table><thead><tr><th>Item</th><th class="num">Saldo</th><th class="num">Valor</th></tr></thead><tbody>'
     +semMov.slice(0,10).map(i=>'<tr><td><div class="cod">'+esc(pnDe(i))+'</div><div class="mut">'+esc(i.descricao)+'</div></td><td class="num">'+NUM(i.saldo,2)+'</td><td class="num">'+BRL(i.saldo*i.custoMedio)+'</td></tr>').join("")
     +'</tbody></table></div>':'<div class="empty"><b>Sem estoque parado</b>Todos os itens com saldo tiveram movimento recente.</div>')+'</div>';
  h+='</div></div>';
  el.innerHTML=h;ligarGo(el);
}

/* ------------------------------------------------------------ Estoque */
const FE={q:"",cat:"",loc:"",st:"todos"};
function vEstoque(el){
  let h=head("Estoque","Catálogo de peças e insumos com saldo, custo médio e ponto de reposição.",
    (podeLancar()?'<button class="btn pri" id="novoItem">Novo item</button><button class="btn" id="impItens">Importar CSV</button>':'')
    +'<button class="btn" id="expItens">Exportar CSV</button>')+soLeitura();
  h+='<div class="panel" style="margin-bottom:16px"><div class="pad grid g2">'
   +'<label class="f">Buscar<input id="fq" placeholder="part number, descrição ou aplicação" value="'+esc(FE.q)+'"></label>'
   +'<label class="f">Categoria<select id="fcat"><option value="">Todas</option>'+cfg().categorias.map(c=>'<option'+(FE.cat===c?" selected":"")+'>'+esc(c)+'</option>').join("")+'</select></label>'
   +'<label class="f">Localização<select id="floc"><option value="">Todas</option>'+cfg().locais.map(c=>'<option'+(FE.loc===c?" selected":"")+'>'+esc(c)+'</option>').join("")+'</select></label>'
   +'<label class="f">Situação<select id="fst">'+[["todos","Todas"],["min","No mínimo"],["zero","Sem saldo"],["ok","Acima do mínimo"],["inativo","Inativos"]].map(([v,n])=>'<option value="'+v+'"'+(FE.st===v?" selected":"")+'>'+n+'</option>').join("")+'</select></label>'
   +'</div></div>';
  const lista=filtrarItens();
  h+='<div class="panel"><header><h3>'+INT(lista.length)+' itens</h3><div class="r">valor filtrado: '+BRL(lista.reduce((s,i)=>s+i.saldo*i.custoMedio,0))+'</div></header>';
  h+=lista.length?'<div class="tw"><table><thead><tr><th>Part number</th><th>Descrição</th><th>Categoria</th><th>Local</th><th class="num">Saldo</th><th class="num">Mín/Máx</th><th class="num">Custo médio</th><th class="num">Valor</th><th></th></tr></thead><tbody>'
    +lista.map(i=>{const cls=!i.ativo?"":(i.saldo<=0?"zero":(i.estoqueMin>0&&i.saldo<=i.estoqueMin?"low":""));
      return '<tr class="'+cls+'"><td class="cod">'+esc(pnDe(i))+(i.exemplo?' <span class="tag t-acc">ex.</span>':'')+'</td>'
      +'<td>'+esc(i.descricao)+(i.aplicacao?'<div class="mut">'+esc(i.aplicacao)+'</div>':'')+(!i.ativo?' <span class="tag t-neu">inativo</span>':'')+'</td>'
      +'<td class="mut">'+esc(i.categoria||"—")+'</td><td class="mut">'+esc(i.local||"—")+'</td>'
      +'<td class="num"><b>'+NUM(i.saldo,2)+'</b> <span class="mut">'+esc(i.unidade)+'</span></td>'
      +'<td class="num mut">'+NUM(i.estoqueMin,0)+' / '+(i.estoqueMax?NUM(i.estoqueMax,0):"—")+'</td>'
      +'<td class="num">'+BRL(i.custoMedio)+'</td><td class="num">'+BRL(i.saldo*i.custoMedio)+'</td>'
      +'<td class="num">'+(podeRequisitar()?'<button class="btn sm" data-sai="'+esc(i.codigo)+'">Saída</button> ':'')
      +(podeLancar()?'<button class="btn sm gh" data-ed="'+esc(i.codigo)+'">Editar</button>':'')+'</td></tr>';}).join("")+'</tbody></table></div>'
    :'<div class="empty"><b>Nenhum item encontrado</b>Ajuste os filtros ou cadastre o primeiro item do almoxarifado.</div>';
  h+='</div>';
  el.innerHTML=h;
  const q=$("#fq");q.oninput=()=>{FE.q=q.value;render();const n=$("#fq");n.focus();n.setSelectionRange(n.value.length,n.value.length);};
  $("#fcat").onchange=e=>{FE.cat=e.target.value;render();};
  $("#floc").onchange=e=>{FE.loc=e.target.value;render();};
  $("#fst").onchange=e=>{FE.st=e.target.value;render();};
  if($("#novoItem"))$("#novoItem").onclick=()=>formItem(null);
  if($("#impItens"))$("#impItens").onclick=importarItens;
  $("#expItens").onclick=()=>baixar("estoque-"+hoje()+".csv",csvItens(lista));
  $$("[data-ed]",el).forEach(b=>b.onclick=()=>formItem(itemPor(b.dataset.ed)));
  $$("[data-sai]",el).forEach(b=>b.onclick=()=>{S.view="movimentar";MV.tipo="saida";MV.codigo=b.dataset.sai;render();window.scrollTo(0,0);});
}
function filtrarItens(){
  const q=FE.q.trim().toLowerCase();
  return S.itens.filter(i=>{
    if(FE.cat&&i.categoria!==FE.cat)return false;
    if(FE.loc&&i.local!==FE.loc)return false;
    if(FE.st==="min"&&!(i.estoqueMin>0&&i.saldo<=i.estoqueMin))return false;
    if(FE.st==="zero"&&i.saldo>0)return false;
    if(FE.st==="ok"&&!(i.saldo>i.estoqueMin))return false;
    if(FE.st==="inativo"&&i.ativo)return false;
    if(FE.st!=="inativo"&&!i.ativo)return false;
    if(q&&!((i.codigo+" "+i.partNumber+" "+i.descricao+" "+i.aplicacao+" "+i.categoria).toLowerCase().includes(q)))return false;
    return true;
  });
}
/* Codigo interno para item sem part number (ou com PN ja usado por outro).
   Some da tela, mas continua amarrando movimentos, lubrificacao e historico. */
function proximoCodigo(extras){
  const usados=S.itens.map(i=>i.codigo).concat(extras||[]);
  let m=0;
  for(const c of usados){
    const g=/^ITEM-(\d+)$/.exec(c||"");
    if(g)m=Math.max(m,parseInt(g[1],10));
  }
  let k=m+1,c;
  do{c="ITEM-"+String(k).padStart(4,"0");k++;}while(usados.includes(c));
  return c;
}
function formItem(it){
  const c=cfg(),novo=!it;
  const body='<div class="grid g2">'
   +'<label class="f">Part number<input id="i_pn" value="'+esc(it?it.partNumber:"")+'" placeholder="ex.: LF3000 / 2996416" autocomplete="off"></label>'
   +'<label class="f">Descrição<input id="i_desc" value="'+esc(it?it.descricao:"")+'" placeholder="Filtro de óleo lubrificante"></label>'
   +'<label class="f">Categoria<select id="i_cat">'+c.categorias.map(x=>'<option'+(it&&it.categoria===x?" selected":"")+'>'+esc(x)+'</option>').join("")+'</select></label>'
   +'<label class="f">Unidade<select id="i_un">'+c.unidades.map(x=>'<option'+(it&&it.unidade===x?" selected":"")+'>'+esc(x)+'</option>').join("")+'</select></label>'
   +'<label class="f">Localização<select id="i_loc">'+c.locais.map(x=>'<option'+(it&&it.local===x?" selected":"")+'>'+esc(x)+'</option>').join("")+'</select></label>'
   +'<label class="f">Fornecedor habitual<select id="i_for"><option value="">—</option>'+S.forn.map(f=>'<option'+(it&&it.fornecedor===f.nome?" selected":"")+'>'+esc(f.nome)+'</option>').join("")+'</select></label>'
   +'<label class="f">Estoque mínimo<input id="i_min" inputmode="decimal" value="'+(it?NUMIN(it.estoqueMin,0):"0")+'"></label>'
   +'<label class="f">Estoque máximo<input id="i_max" inputmode="decimal" value="'+(it&&it.estoqueMax?NUMIN(it.estoqueMax,0):"")+'" placeholder="opcional"></label>'
   +'</div><div class="grid" style="margin-top:12px">'
   +'<label class="f">Aplicação / equipamento<input id="i_apl" value="'+esc(it?it.aplicacao:"")+'" placeholder="Caminhão MB 2831 · Trator Valtra BM110"></label>'
   +(novo?'<div class="fine">O <b>part number</b> é o código do fabricante e identifica a peça no sistema. Item que não tem um (graxa a granel, estopa, parafuso comum) pode ficar em branco — o sistema cria um código interno.</div>'
     +'<div class="grid g2"><label class="f">Saldo inicial<input id="i_s0" inputmode="decimal" value="0"></label><label class="f">Custo unitário inicial<input id="i_c0" inputmode="decimal" value="0,00"></label></div><div class="fine">O saldo inicial entra no histórico como movimento “Saldo inicial”.</div>'
     :'<label class="f">Situação<select id="i_at"><option value="1"'+(it.ativo?" selected":"")+'>Ativo</option><option value="0"'+(!it.ativo?" selected":"")+'>Inativo</option></select></label><div class="fine">Saldo e custo médio só mudam por movimentação — use Movimentar › Ajuste para corrigir quantidade.</div>')
   +'</div>';
  modal(novo?"Novo item":"Editar item "+pnDe(it),body,
    (novo?"":'<button class="btn dg" id="i_del">Excluir</button>')+'<button class="btn gh" id="i_x">Cancelar</button><button class="btn pri" id="i_ok">Salvar</button>');
  $("#i_x").onclick=fecharModal;
  if(!novo)$("#i_del").onclick=()=>excluirItem(it);
  $("#i_ok").onclick=async()=>{
    const pn=$("#i_pn").value.trim().toUpperCase();
    const desc=$("#i_desc").value.trim();
    if(!desc){toast("Informe a descrição do item.","e");return;}
    const repetido=pn&&S.itens.find(x=>x.partNumber&&x.partNumber.toUpperCase()===pn&&(novo||x._id!==it._id));
    if(repetido){toast("O part number "+pn+" já está no item "+repetido.descricao+".","e");return;}
    /* O codigo continua sendo a chave interna (todo o historico pendura nele),
       mas nao aparece mais na tela: nasce do part number ou e gerado. */
    const cod=novo?(pn&&!S.itens.some(x=>x.codigo===pn)?pn:proximoCodigo()):it.codigo;
    const dados={codigo:cod,descricao:desc,categoria:$("#i_cat").value,unidade:$("#i_un").value,local:$("#i_loc").value,
      fornecedor:$("#i_for").value||null,estoque_min:pnum($("#i_min").value),estoque_max:pnum($("#i_max").value),
      part_number:pn||null,
      aplicacao:$("#i_apl").value.trim()||null,ativo:novo?true:$("#i_at").value==="1"};
    const b=$("#i_ok");b.disabled=true;b.textContent="Salvando…";
    try{
      if(novo){
        const {error}=await SB.from("itens").insert(dados);if(error)throw error;
        const s0=pnum($("#i_s0").value);
        if(s0!==0)await gravarMov({codigo:cod,tipo:"inicial",qtd:s0,vlrUnit:pnum($("#i_c0").value),data:hoje(),obs:"Cadastro do item"});
      }else{
        const {error}=await SB.from("itens").update(dados).eq("id",it._id);if(error)throw error;
      }
      fecharModal();toast(novo?"Item cadastrado.":"Item atualizado.","s");await carregarTudo();
    }catch(e){b.disabled=false;b.textContent="Salvar";toast(erroMsg(e),"e");}
  };
}
function excluirItem(it){
  const temMov=S.movs.some(m=>m.codigo===it.codigo);
  modal("Excluir "+it.codigo,'<p>'+(temMov?'Este item tem movimentações registradas e por isso <b>não pode ser excluído</b> — o histórico ficaria órfão. Marque-o como <b>inativo</b>: ele some do estoque e das listas, mas o histórico continua íntegro.':'O item será removido do cadastro.')+'</p>',
    '<button class="btn gh" id="d_x">Cancelar</button>'+(temMov?'<button class="btn pri" id="d_in">Marcar como inativo</button>':'<button class="btn dg" id="d_ok">Excluir</button>'));
  $("#d_x").onclick=fecharModal;
  if(temMov)$("#d_in").onclick=async()=>{try{const {error}=await SB.from("itens").update({ativo:false}).eq("id",it._id);if(error)throw error;fecharModal();toast("Item inativado.","s");await carregarTudo();}catch(e){toast(erroMsg(e),"e");}};
  else $("#d_ok").onclick=async()=>{try{const {error}=await SB.from("itens").delete().eq("id",it._id);if(error)throw error;fecharModal();toast("Item excluído.","s");await carregarTudo();}catch(e){toast(erroMsg(e),"e");}};
}

/* --------------------------------------------------------- Movimentar */
const MV={tipo:"saida",codigo:"",nota:false,nf:{data:"",fornecedor:"",nf:"",obs:"",conf:""},linhas:[]};
function vMovimentar(el){
  const t=MV.tipo,it=itemPor(MV.codigo);
  const tipos=podeLancar()?["entrada","saida","devolucao","ajuste"]:["saida"];
  if(!tipos.includes(t))MV.tipo=tipos[0];
  let h=head("Movimentar","Entradas de nota fiscal, requisições da oficina, devoluções e ajustes de contagem.")+soLeitura();
  if(!podeRequisitar()){el.innerHTML=h+'<div class="panel"><div class="empty"><b>Sem permissão</b>Seu perfil não lança movimentações.</div></div>';return;}
  h+='<div class="pillrow" style="margin-bottom:14px">'+tipos.map(k=>'<button class="pill" data-t="'+k+'" aria-pressed="'+(MV.tipo===k)+'">'+TIPOS[k]+'</button>').join("")+'</div>';
  if(MV.tipo!=="entrada")MV.nota=false;
  if(MV.tipo==="entrada"&&podeLancar()){
    h+='<div class="pillrow" style="margin:-6px 0 14px">'
      +'<button class="pill" data-mo="0" aria-pressed="'+(!MV.nota)+'">Um item</button>'
      +'<button class="pill" data-mo="1" aria-pressed="'+(!!MV.nota)+'">Nota com v\u00e1rios itens</button></div>';
    if(MV.nota){el.innerHTML=h+blocoNota();ligarNota(el);return;}
  }
  h+='<div class="split"><div class="panel"><header><h3>'+TIPOS[MV.tipo]+'</h3><div class="r">'+(MV.tipo==="entrada"?"atualiza custo médio":MV.tipo==="saida"?"baixa pelo custo médio":MV.tipo==="ajuste"?"define o saldo contado":"retorno ao estoque")+'</div></header><div class="pad grid">';
  h+='<div class="scan"><label class="f" style="flex:1">Item<input id="m_it" list="dlItens" value="'+esc(MV.codigo?pnDe(MV.codigo):"")+'" placeholder="part number ou descrição" autocomplete="off"></label><button class="btn" id="m_scan" type="button" title="Ler código de barras">Ler código</button></div>'
   +'<datalist id="dlItens">'+S.itens.filter(i=>i.ativo).map(i=>'<option value="'+esc(pnDe(i))+'">'+esc(i.descricao)+' · saldo '+NUM(i.saldo,2)+' '+esc(i.unidade)+'</option>').join("")+'</datalist>';
  h+='<div class="grid g3">'
   +'<label class="f">Data<input id="m_dt" type="date" value="'+hoje()+'"></label>'
   +'<label class="f">Quantidade'+(it?' ('+esc(it.unidade)+')':'')+'<input id="m_q" inputmode="decimal" placeholder="0,00"></label>'
   +(MV.tipo==="entrada"?'<label class="f">Valor unitário<input id="m_v" inputmode="decimal" placeholder="0,00"></label>'
     :'<label class="f">Valor unitário<input id="m_v" value="'+(it?NUM(it.custoMedio,2):"0,00")+'" disabled></label>')
   +'</div>';
  if(MV.tipo==="entrada")h+='<div class="grid g2"><label class="f">Fornecedor<input id="m_for" list="dlForn" value="'+esc(it&&it.fornecedor||"")+'" autocomplete="off"></label><datalist id="dlForn">'+S.forn.map(f=>'<option value="'+esc(f.nome)+'"></option>').join("")+'</datalist><label class="f">Nota fiscal<input id="m_nf" placeholder="nº da NF"></label></div>';
  if(MV.tipo==="saida"||MV.tipo==="devolucao")h+='<div class="grid g3">'
   +'<label class="f">Ordem de serviço<input id="m_os" placeholder="OS-0000"></label>'
   +'<label class="f">Frota / equipamento<input id="m_fr" list="dlFrota" placeholder="prefixo ou placa" autocomplete="off"></label><datalist id="dlFrota">'+S.frota.filter(f=>f.ativo).map(f=>'<option value="'+esc(f.codigo)+'">'+esc([f.tipo,f.marcaModelo,f.placa].filter(Boolean).join(" · "))+'</option>').join("")+'</datalist>'
   +'<label class="f">Solicitado por<input id="m_sol" list="dlUsr" value="'+esc(papel()==="mecanico"?(S.perfil?S.perfil.nome:""):"")+'" autocomplete="off"></label><datalist id="dlUsr">'+S.perfis.map(u=>'<option value="'+esc(u.nome)+'"></option>').join("")+'</datalist>'
   +'</div>';
  if(MV.tipo==="ajuste")h+='<div class="note">Informe em <b>Quantidade</b> o saldo real contado. A diferença é registrada no histórico com o custo médio do item.</div>';
  h+='<label class="f">Observação<input id="m_obs" placeholder="opcional"></label>';
  h+='<div style="display:flex;gap:8px;justify-content:flex-end;align-items:center"><button class="btn pri" id="m_ok">Lançar '+TIPOS[MV.tipo].toLowerCase()+'</button></div>';
  h+='</div></div>';
  h+='<div class="grid" style="gap:16px">';
  h+='<div class="panel"><header><h3>Item selecionado</h3></header>'+(it?'<div class="pad grid" style="gap:8px">'
   +'<div><div class="cod" style="font-size:15px">'+esc(pnDe(it))+'</div><div>'+esc(it.descricao)+'</div>'+(it.aplicacao?'<div class="mut">'+esc(it.aplicacao)+'</div>':'')+'</div>'
   +'<div class="kpis" style="margin:0">'+kpi("Saldo",NUM(it.saldo,2)+" "+esc(it.unidade),"mín. "+NUM(it.estoqueMin,0))+kpi("Custo médio",BRL(it.custoMedio),"valor "+BRL(it.saldo*it.custoMedio))+'</div>'
   +'<div class="fine">Local: '+esc(it.local||"—")+' · Categoria: '+esc(it.categoria||"—")+'</div></div>'
   :'<div class="empty"><b>Nenhum item</b>Escolha um item para ver saldo e custo médio.</div>')+'</div>';
  if(it)h+='<div class="panel"><header><h3>Movimentos deste item</h3></header>'+tabMovs(S.movs.filter(m=>m.codigo===it.codigo).slice(0,8),true)+'</div>';
  h+='</div></div>';
  el.innerHTML=h;
  $$("[data-t]",el).forEach(b=>b.onclick=()=>{MV.tipo=b.dataset.t;render();});
  $$("[data-mo]",el).forEach(b=>b.onclick=()=>{MV.nota=b.dataset.mo==="1";render();});
  const inp=$("#m_it");
  inp.onchange=()=>{MV.codigo=inp.value.trim().toUpperCase();render();const q=$("#m_q");if(q)q.focus();};
  $("#m_scan").onclick=()=>lerCodigo(c=>{MV.codigo=c.toUpperCase();render();});
  $("#m_ok").onclick=lancar;
}
/* ------------------------------------------- Entrada de nota com vários itens
   As linhas ficam só na tela até você confirmar. Na hora de gravar, a nota
   inteira vai numa chamada só (registrar_nota): ou entra tudo, ou não entra
   nada — não existe meia nota lançada. */
function blocoNota(){
  const L=MV.linhas,N=MV.nf;
  const total=L.reduce((a,l)=>a+l.qtd*l.vlrUnit,0);
  const conf=pnum(N.conf||"");
  const dif=conf>0?(total-conf):null;
  let h='<div class="panel"><header><h3>Entrada por nota</h3><div class="r">'+INT(L.length)+' item(ns) · '+BRL(total)+'</div></header><div class="pad grid">';
  h+='<div class="grid g3">'
   +'<label class="f">Data<input id="n_dt" type="date" value="'+esc(N.data||hoje())+'"></label>'
   +'<label class="f">Fornecedor<input id="n_for" list="dlForn" value="'+esc(N.fornecedor)+'" autocomplete="off"></label>'
   +'<datalist id="dlForn">'+S.forn.map(f=>'<option value="'+esc(f.nome)+'"></option>').join("")+'</datalist>'
   +'<label class="f">Nota fiscal<input id="n_nf" value="'+esc(N.nf)+'" placeholder="nº da NF"></label>'
   +'</div>';
  h+='<label class="f">Observação (vale para todos os itens)<input id="n_obs" value="'+esc(N.obs)+'" placeholder="opcional"></label>';
  h+='<div style="border:1px solid var(--line);border-radius:var(--r);padding:12px;display:grid;gap:10px">'
   +'<div class="scan"><label class="f" style="flex:1">Item<input id="n_it" list="dlItens" placeholder="part number ou descrição" autocomplete="off"></label>'
   +'<button class="btn" id="n_scan" type="button" title="Ler código de barras">Ler código</button></div>'
   +'<datalist id="dlItens">'+S.itens.filter(i=>i.ativo).map(i=>'<option value="'+esc(pnDe(i))+'">'+esc(i.descricao)+' · saldo '+NUM(i.saldo,2)+' '+esc(i.unidade)+'</option>').join("")+'</datalist>'
   +'<div class="grid g3">'
   +'<label class="f">Quantidade<input id="n_q" inputmode="decimal" placeholder="0,00"></label>'
   +'<label class="f">Valor unitário<input id="n_v" inputmode="decimal" placeholder="0,00"></label>'
   +'<div style="display:flex;align-items:flex-end"><button class="btn pri" id="n_add" type="button" style="width:100%;justify-content:center">Acrescentar</button></div>'
   +'</div></div>';
  if(L.length){
    h+='<div class="tw"><table><thead><tr><th>Item</th><th class="num">Total</th><th></th></tr></thead><tbody>'
     +L.map((l,ix)=>'<tr><td><div class="cod">'+esc(pnDe(l.codigo))+'</div><div>'+esc(l.descricao)+'</div>'
       +'<div class="mut">'+NUM(l.qtd,2)+' '+esc(l.un)+' × '+BRL(l.vlrUnit)+'</div></td>'
       +'<td class="num">'+BRL(l.qtd*l.vlrUnit)+'</td>'
       +'<td class="num"><button class="btn sm gh" data-nrm="'+ix+'" title="Tirar da nota">&times;</button></td></tr>').join("")
     +'</tbody></table></div>';
  }else{
    h+='<div class="empty"><b>Nenhum item na nota</b>Acrescente os itens acima. Nada é gravado até você confirmar.</div>';
  }
  h+='<div class="grid g2">'
   +'<label class="f">Total impresso na nota<input id="n_conf" value="'+esc(N.conf)+'" inputmode="decimal" placeholder="opcional, para conferir"></label>'
   +'<div style="display:flex;align-items:flex-end;padding-bottom:6px">'
   +(dif===null?'<div class="fine">Digite o total da nota para conferir antes de gravar.</div>'
     :(Math.abs(dif)<0.005?'<span class="tag t-ok">confere com '+BRL(total)+'</span>'
       :'<span class="tag t-crit">diferença de '+BRL(Math.abs(dif))+(dif>0?' a mais':' a menos')+'</span>'))
   +'</div></div>';
  h+='<div style="display:flex;gap:8px;justify-content:flex-end">'
   +'<button class="btn gh" id="n_limpa" type="button">Limpar</button>'
   +'<button class="btn pri" id="n_ok" type="button"'+(L.length?'':' disabled')+'>Lançar nota'+(L.length?' ('+INT(L.length)+')':'')+'</button></div>';
  h+='</div></div>';
  return h;
}
function lerCabNota(){
  if(!$("#n_dt"))return;
  MV.nf={data:$("#n_dt").value||hoje(),fornecedor:$("#n_for").value.trim(),nf:$("#n_nf").value.trim(),
    obs:$("#n_obs").value.trim(),conf:$("#n_conf")?$("#n_conf").value:""};
}
function ligarNota(el){
  $$("[data-t]",el).forEach(b=>b.onclick=()=>{lerCabNota();MV.tipo=b.dataset.t;render();});
  $$("[data-mo]",el).forEach(b=>b.onclick=()=>{lerCabNota();MV.nota=b.dataset.mo==="1";render();});
  $$("[data-nrm]",el).forEach(b=>b.onclick=()=>{lerCabNota();MV.linhas.splice(+b.dataset.nrm,1);render();});
  $("#n_scan").onclick=()=>lerCodigo(c=>{$("#n_it").value=c.toUpperCase();const q=$("#n_q");if(q)q.focus();});
  $("#n_add").onclick=addLinhaNota;
  $("#n_it").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();$("#n_q").focus();}};
  $("#n_q").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();$("#n_v").focus();}};
  $("#n_v").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();addLinhaNota();}};
  $("#n_conf").onchange=()=>{lerCabNota();render();};
  $("#n_limpa").onclick=()=>{lerCabNota();MV.linhas=[];render();};
  if($("#n_ok"))$("#n_ok").onclick=lancarNota;
  if(MV.foco||!MV.linhas.length){MV.foco=false;$("#n_it").focus();}
}
function addLinhaNota(){
  lerCabNota();
  const it=itemPor($("#n_it").value.trim().toUpperCase());
  if(!it){toast("Item não encontrado no cadastro.","e");return;}
  if(!it.ativo){toast("O item "+pnDe(it)+" está inativo.","e");return;}
  const q=pnum($("#n_q").value),v=pnum($("#n_v").value);
  if(!(q>0)){toast("Informe a quantidade.","e");return;}
  if(!(v>0)){toast("Informe o valor unitário.","e");return;}
  MV.linhas.push({codigo:it.codigo,descricao:it.descricao,un:it.unidade,qtd:q,vlrUnit:v});
  MV.foco=true;render();
}
async function lancarNota(){
  lerCabNota();
  const N=MV.nf,L=MV.linhas;
  if(!L.length){toast("Acrescente pelo menos um item.","e");return;}
  const b=$("#n_ok");b.disabled=true;b.textContent="Lançando…";
  try{
    const n=await rpc("registrar_nota",{p_data:N.data||hoje(),p_fornecedor:N.fornecedor||null,
      p_nf:N.nf||null,p_obs:N.obs||null,
      p_linhas:L.map(l=>({codigo:l.codigo,qtd:l.qtd,vlr_unit:l.vlrUnit}))});
    toast("Nota lançada: "+INT(n)+" item(ns) deram entrada.","s");
    MV.linhas=[];MV.nf={data:"",fornecedor:"",nf:"",obs:"",conf:""};
    await carregarTudo();
  }catch(e){
    b.disabled=false;b.textContent="Lançar nota ("+INT(L.length)+")";
    toast(erroMsg(e)+" — nenhum item foi lançado.","e");
  }
}
async function lancar(){
  const it=itemPor($("#m_it").value.trim().toUpperCase());
  if(!it){toast("Item não encontrado no cadastro.","e");return;}
  const t=MV.tipo,q=pnum($("#m_q").value);
  if(!(q>0)&&!(t==="ajuste"&&q===0)){toast("Informe a quantidade.","e");return;}
  const mov={codigo:it.codigo,tipo:t,qtd:q,data:$("#m_dt").value||hoje(),obs:$("#m_obs").value.trim()};
  if(t==="entrada"){mov.vlrUnit=pnum($("#m_v").value);mov.fornecedor=$("#m_for")?$("#m_for").value.trim():"";mov.nf=$("#m_nf")?$("#m_nf").value.trim():"";
    if(!(mov.vlrUnit>0)){toast("Informe o valor unitário da entrada.","e");return;}}
  if(t==="saida"||t==="devolucao"){mov.os=$("#m_os")?$("#m_os").value.trim():"";mov.frota=$("#m_fr")?$("#m_fr").value.trim().toUpperCase():"";mov.solicitante=$("#m_sol")?$("#m_sol").value.trim():"";}
  const b=$("#m_ok");b.disabled=true;b.textContent="Lançando…";
  try{
    await gravarMov(mov);
    toast(TIPOS[t]+" de "+NUM(q,2)+" "+it.unidade+" · "+pnDe(it)+" registrada.","s");
    MV.codigo="";await carregarTudo();
  }catch(e){b.disabled=false;b.textContent="Lançar "+TIPOS[t].toLowerCase();toast(erroMsg(e),"e");}
}

/* ==================================================== Lubrificação ====
   Carta de lubrificação por equipamento. Cada ponto pode ter três réguas
   ao mesmo tempo — horas de horímetro, litros de combustível e dias de
   calendário — e vence pela que chegar primeiro, que é a regra do manual
   do fabricante. A execução dá baixa do lubrificante no estoque pela
   mesma função de saída do resto do sistema. */
const METODOS={graxa:"Engraxar",troca:"Troca",completar:"Completar nível",filtro:"Filtro",inspecao:"Inspeção"};
const CRITIC={baixa:"Baixa",media:"Média",alta:"Alta"};
const LB={aba:"venc",frota:""};

function lubSit(p){
  if(p.consumo>=1)   return {cls:"t-crit",txt:"vencido"};
  if(p.consumo>=0.9) return {cls:"t-warn",txt:"próximo"};
  return {cls:"t-ok",txt:"em dia"};
}
/* Qual régua está mandando e quanto falta nela. */
function lubFalta(p){
  const r=[];
  if(p.intHoras>0)  r.push({u:"h",    falta:p.intHoras -p.horasDesde,  pct:p.horasDesde /p.intHoras});
  if(p.intLitros>0) r.push({u:"L",    falta:p.intLitros-p.litrosDesde, pct:p.litrosDesde/p.intLitros});
  if(p.intDias>0)   r.push({u:"dias", falta:p.intDias  -p.diasDesde,   pct:p.diasDesde  /p.intDias});
  if(!r.length)return "";
  r.sort((a,b)=>b.pct-a.pct);
  const x=r[0];
  return x.falta<=0 ? "passou "+NUM(Math.abs(x.falta),0)+" "+x.u : "faltam "+NUM(x.falta,0)+" "+x.u;
}
function lubReguas(p){
  const t=[];
  if(p.intHoras>0)  t.push(NUM(p.horasDesde,0)+"/"+NUM(p.intHoras,0)+" h");
  if(p.intLitros>0) t.push(NUM(p.litrosDesde,0)+"/"+NUM(p.intLitros,0)+" L");
  if(p.intDias>0)   t.push(INT(p.diasDesde)+"/"+INT(p.intDias)+" dias");
  return t.join(" · ");
}

function vLubrificacao(el){
  const venc=S.lubP.filter(p=>p.consumo>=1), prox=S.lubP.filter(p=>p.consumo>=0.9&&p.consumo<1);
  let h=head("Lubrificação","Carta de lubrificação por equipamento. Cada ponto vence por horas, litros abastecidos ou dias — o que chegar primeiro.",
    '<button class="btn" id="lb_leit">Registrar leitura</button>'
    +(podeLancar()?'<button class="btn pri" id="lb_novo">Novo ponto</button>':''))+soLeitura();
  h+='<div class="pillrow" style="margin-bottom:14px">'
   +[["venc","Vencimentos"],["cartas","Cartas"],["leituras","Leituras"],["hist","Histórico"]]
     .map(([k,n])=>'<button class="pill" data-lb="'+k+'" aria-pressed="'+(LB.aba===k)+'">'+n+'</button>').join("")+'</div>';

  if(LB.aba==="venc"){
    h+='<div class="kpis">'+kpi("Vencidos",INT(venc.length),"passaram do intervalo")
      +kpi("Próximos",INT(prox.length),"90% ou mais da régua")
      +kpi("Pontos na carta",INT(S.lubP.length),INT(new Set(S.lubP.map(p=>p.frota)).size)+" equipamento(s)")+'</div>';
    const lista=S.lubP.slice().sort((a,b)=>b.consumo-a.consumo);
    h+='<div class="panel"><header><h3>O que está pedindo lubrificação</h3><div class="r">'+INT(lista.length)+'</div></header>'
     +(lista.length?tabLub(lista,true):'<div class="empty"><b>Nenhum ponto cadastrado</b>Monte a carta de lubrificação de um equipamento na aba Cartas.</div>')+'</div>';
  }

  if(LB.aba==="cartas"){
    const frotas=S.frota.filter(f=>f.ativo);
    if(!LB.frota&&frotas.length)LB.frota=frotas[0].codigo;
    h+='<div class="panel" style="margin-bottom:16px"><div class="pad grid g2">'
     +'<label class="f">Equipamento<select id="lb_fr">'+frotas.map(f=>'<option'+(LB.frota===f.codigo?" selected":"")+'>'+esc(f.codigo)+'</option>').join("")+'</select></label>'
     +'<div style="display:flex;align-items:flex-end;gap:8px">'
     +(podeLancar()?'<button class="btn" id="lb_copia">Copiar carta de outro equipamento</button>':'')
     +'<button class="btn" id="lb_csv">Exportar CSV</button></div>'
     +'</div></div>';
    const carta=S.lubP.filter(p=>p.frota===LB.frota).sort((a,b)=>a.ordem-b.ordem);
    h+='<div class="panel"><header><h3>Carta de '+esc(LB.frota||"—")+'</h3><div class="r">'+INT(carta.length)+' ponto(s)</div></header>'
     +(carta.length?tabLub(carta,false):'<div class="empty"><b>Sem carta</b>Este equipamento ainda não tem pontos de lubrificação cadastrados.</div>')+'</div>';
  }

  if(LB.aba==="leituras"){
    const l=S.lubL.slice(0,300);
    h+='<div class="panel"><header><h3>Leituras de horímetro e abastecimento</h3><div class="r">'+INT(S.lubL.length)+'</div></header>'
     +(l.length?'<div class="tw"><table><thead><tr><th>Data</th><th>Equipamento</th><th class="num">Horímetro</th><th class="num">Litros</th><th>Quem lançou</th></tr></thead><tbody>'
       +l.map(x=>'<tr><td class="mut" style="white-space:nowrap">'+dbr(x.data)+'</td><td class="cod">'+esc(x.frota)+'</td>'
         +'<td class="num">'+(x.horimetro!=null?NUM(x.horimetro,1)+' <span class="mut">h</span>':'<span class="mut">—</span>')+'</td>'
         +'<td class="num">'+(x.litros!=null?NUM(x.litros,1)+' <span class="mut">L</span>':'<span class="mut">—</span>')+'</td>'
         +'<td class="mut">'+esc(x.usuario||"—")+(x.obs?'<div>'+esc(x.obs)+'</div>':'')+'</td></tr>').join("")
       +'</tbody></table></div>'
       :'<div class="empty"><b>Nenhuma leitura</b>Sem horímetro e sem abastecimento, só a régua de dias funciona.</div>')+'</div>';
  }

  if(LB.aba==="hist"){
    const l=S.lubE.slice(0,300);
    h+='<div class="panel"><header><h3>Lubrificações executadas</h3><div class="r">'+INT(S.lubE.length)+'</div></header>'
     +(l.length?'<div class="tw"><table><thead><tr><th>Data</th><th>Equipamento / ponto</th><th class="num">Aplicado</th><th>Quem fez</th></tr></thead><tbody>'
       +l.map(x=>'<tr><td class="mut" style="white-space:nowrap">'+dbr(x.data)+'</td>'
         +'<td><div class="cod">'+esc(x.frota)+'</div><div>'+esc(x.componente)+'</div>'
         +(x.horimetro!=null?'<div class="mut">'+NUM(x.horimetro,0)+' h</div>':'')+'</td>'
         +'<td class="num">'+(x.qtd?NUM(x.qtd,2)+' <span class="mut">'+esc(pnDe(x.itemCodigo))+'</span>':'<span class="mut">—</span>')+'</td>'
         +'<td class="mut">'+esc(x.responsavel||x.usuario||"—")+(x.obs?'<div>'+esc(x.obs)+'</div>':'')+'</td></tr>').join("")
       +'</tbody></table></div>'
       :'<div class="empty"><b>Nada executado ainda</b>As lubrificações registradas aparecem aqui e no histórico do estoque.</div>')+'</div>';
  }

  el.innerHTML=h;
  $$("[data-lb]",el).forEach(b=>b.onclick=()=>{LB.aba=b.dataset.lb;render();});
  if($("#lb_fr"))$("#lb_fr").onchange=()=>{LB.frota=$("#lb_fr").value;render();};
  if($("#lb_leit"))$("#lb_leit").onclick=()=>dlgLeitura(LB.frota);
  if($("#lb_novo"))$("#lb_novo").onclick=()=>formPonto(null);
  if($("#lb_copia"))$("#lb_copia").onclick=dlgCopiarCarta;
  if($("#lb_csv"))$("#lb_csv").onclick=()=>baixar("carta-lubrificacao-"+(LB.frota||"geral").toLowerCase()+"-"+hoje()+".csv",csvLub(S.lubP.filter(p=>p.frota===LB.frota)));
  $$("[data-lbex]",el).forEach(b=>b.onclick=()=>dlgLubrificar(S.lubP.find(p=>p._id===b.dataset.lbex)));
  $$("[data-lbed]",el).forEach(b=>b.onclick=()=>formPonto(S.lubP.find(p=>p._id===b.dataset.lbed)));
}

function tabLub(l,comFrota){
  return '<div class="tw"><table><thead><tr>'+(comFrota?'<th>Equipamento</th>':'')
   +'<th>Ponto</th><th>Lubrificante</th><th>Réguas</th><th>Situação</th><th></th></tr></thead><tbody>'
   +l.map(p=>{const s=lubSit(p);
     return '<tr>'+(comFrota?'<td class="cod">'+esc(p.frota)+'</td>':'')
      +'<td><div>'+esc(p.componente)+'</div><div class="mut">'+esc(METODOS[p.metodo]||p.metodo)
        +(p.criticidade==="alta"?' · crítico':'')+'</div></td>'
      +'<td>'+(p.itemCodigo?'<div class="cod">'+esc(pnDe(p.itemCodigo))+'</div>':'')
        +(p.lubrificante?'<div class="mut">'+esc(p.lubrificante)+'</div>':'')
        +(p.qtd?'<div class="mut">'+NUM(p.qtd,2)+' '+esc(p.unidade||"")+'</div>':'')
        +(!p.itemCodigo&&!p.lubrificante?'<span class="mut">—</span>':'')+'</td>'
      +'<td class="mut">'+esc(lubReguas(p))+'<div>'+esc(lubFalta(p))+'</div></td>'
      +'<td><span class="tag '+s.cls+'">'+s.txt+'</span>'
        +(p.ultimaData?'<div class="mut">desde '+dbr(p.ultimaData)+'</div>':'<div class="mut">nunca feito</div>')+'</td>'
      +'<td class="num" style="white-space:nowrap">'
        +(podeRequisitar()?'<button class="btn sm pri" data-lbex="'+p._id+'">Lubrificar</button> ':'')
        +(podeLancar()?'<button class="btn sm gh" data-lbed="'+p._id+'">Editar</button>':'')+'</td></tr>';}).join("")
   +'</tbody></table></div>';
}

function csvLub(l){return csv([["Equipamento","Ordem","Ponto","Metodo","Item","Lubrificante","Quantidade","Unidade",
  "Intervalo horas","Intervalo litros","Intervalo dias","Criticidade","Ultima em","Situacao","Procedimento"]]
  .concat(l.map(p=>[p.frota,p.ordem,p.componente,METODOS[p.metodo]||p.metodo,pnDe(p.itemCodigo),p.lubrificante,
    NUM(p.qtd,2),p.unidade,p.intHoras||"",p.intLitros||"",p.intDias||"",CRITIC[p.criticidade]||p.criticidade,
    p.ultimaData?dbr(p.ultimaData):"",lubSit(p).txt,p.procedimento])));}

/* ------------------------------------------------- registrar leitura */
function dlgLeitura(frotaSel){
  const frotas=S.frota.filter(f=>f.ativo);
  modal("Registrar leitura",'<div class="grid">'
   +'<div class="fine">O <b>horímetro</b> é a leitura do painel (acumulada). Os <b>litros</b> são os do abastecimento de agora. Pode lançar um dos dois ou os dois juntos.</div>'
   +'<div class="grid g2"><label class="f">Equipamento<select id="ll_fr">'+frotas.map(f=>'<option'+(frotaSel===f.codigo?" selected":"")+'>'+esc(f.codigo)+'</option>').join("")+'</select></label>'
   +'<label class="f">Data<input id="ll_dt" type="date" value="'+hoje()+'"></label></div>'
   +'<div class="grid g2"><label class="f">Horímetro (h)<input id="ll_h" inputmode="decimal" placeholder="ex.: 1245"></label>'
   +'<label class="f">Litros abastecidos<input id="ll_l" inputmode="decimal" placeholder="ex.: 280"></label></div>'
   +'<label class="f">Observação<input id="ll_ob" placeholder="opcional"></label>'
   +'</div>','<button class="btn gh" id="ll_x">Cancelar</button><button class="btn pri" id="ll_ok">Registrar</button>');
  $("#ll_x").onclick=fecharModal;
  $("#ll_ok").onclick=async()=>{
    const hm=pnum($("#ll_h").value),lt=pnum($("#ll_l").value);
    if(!(hm>0)&&!(lt>0)){toast("Informe o horímetro ou os litros.","e");return;}
    const b=$("#ll_ok");b.disabled=true;b.textContent="Registrando…";
    try{
      await rpc("registrar_leitura",{p_frota:$("#ll_fr").value,p_data:$("#ll_dt").value||hoje(),
        p_horimetro:hm>0?hm:null,p_litros:lt>0?lt:null,p_obs:$("#ll_ob").value.trim()||null});
      fecharModal();toast("Leitura registrada.","s");await carregarTudo();
    }catch(e){b.disabled=false;b.textContent="Registrar";toast(erroMsg(e),"e");}
  };
}

/* --------------------------------------------- executar a lubrificação */
function dlgLubrificar(p){
  if(!p)return;
  const it=p.itemCodigo?itemPor(p.itemCodigo):null;
  const s=lubSit(p);
  modal("Lubrificar · "+p.frota,
    '<div class="note" style="margin-bottom:12px"><b>'+esc(p.componente)+'</b> · '+esc(METODOS[p.metodo]||p.metodo)
     +'<div>'+esc(lubReguas(p))+' — <b>'+s.txt+'</b>, '+esc(lubFalta(p))+'</div></div>'
    +(p.procedimento?'<div class="fine" style="margin-bottom:10px">'+esc(p.procedimento)+'</div>':'')
    +'<div class="grid">'
    +'<div class="grid g2"><label class="f">Data<input id="lx_dt" type="date" value="'+hoje()+'"></label>'
    +'<label class="f">Horímetro agora<input id="lx_h" inputmode="decimal" placeholder="'+(p.horasAtuais?NUM(p.horasAtuais,0):"opcional")+'"></label></div>'
    +'<div class="grid g2"><label class="f">Quantidade aplicada'+(p.unidade?' ('+esc(p.unidade)+')':'')+'<input id="lx_q" inputmode="decimal" value="'+(p.qtd?NUMIN(p.qtd,2):"")+'"></label>'
    +'<label class="f">Ordem de serviço<input id="lx_os" placeholder="opcional"></label></div>'
    +'<label class="f">Quem fez<input id="lx_r" list="dlUsr3" value="'+esc(papel()==="mecanico"?(S.perfil?S.perfil.nome:""):"")+'" autocomplete="off"></label>'
    +'<datalist id="dlUsr3">'+S.perfis.map(u=>'<option value="'+esc(u.nome)+'"></option>').join("")+'</datalist>'
    +'<label class="f">Observação<input id="lx_ob" placeholder="opcional"></label>'
    +(it?'<div class="fine">Sai <b>'+esc(pnDe(p.itemCodigo))+'</b> do estoque (saldo atual '+NUM(it.saldo,2)+' '+esc(it.unidade)+') e entra no custo de '+esc(p.frota)+'.</div>'
        :'<div class="fine">Este ponto não está amarrado a um item do almoxarifado — nada sai do estoque.</div>')
    +'</div>',
    '<button class="btn gh" id="lx_x">Cancelar</button><button class="btn pri" id="lx_ok">Registrar lubrificação</button>');
  $("#lx_x").onclick=fecharModal;
  $("#lx_ok").onclick=async()=>{
    const b=$("#lx_ok");b.disabled=true;b.textContent="Registrando…";
    try{
      const hm=pnum($("#lx_h").value);
      await rpc("registrar_lubrificacao",{p_ponto_id:p._id,p_data:$("#lx_dt").value||hoje(),
        p_horimetro:hm>0?hm:null,p_qtd:pnum($("#lx_q").value),
        p_responsavel:$("#lx_r").value.trim()||null,p_os:$("#lx_os").value.trim()||null,
        p_obs:$("#lx_ob").value.trim()||null});
      fecharModal();toast("Lubrificação registrada.","s");await carregarTudo();
    }catch(e){b.disabled=false;b.textContent="Registrar lubrificação";toast(erroMsg(e),"e");}
  };
}

/* ------------------------------------------------- cadastro do ponto */
function formPonto(p){
  const novo=!p,c=cfg();
  const frotas=S.frota.filter(f=>f.ativo);
  const body='<div class="grid g2">'
   +'<label class="f">Equipamento<select id="lp_fr"'+(novo?"":" disabled")+'>'+frotas.map(f=>'<option'+((p?p.frota:LB.frota)===f.codigo?" selected":"")+'>'+esc(f.codigo)+'</option>').join("")+'</select></label>'
   +'<label class="f">Ordem na carta<input id="lp_or" inputmode="numeric" value="'+(p?p.ordem:(S.lubP.filter(x=>x.frota===LB.frota).length+1))+'"></label>'
   +'</div><div class="grid" style="margin-top:10px">'
   +'<label class="f">Ponto / componente<input id="lp_co" value="'+esc(p?p.componente:"")+'" placeholder="Motor — cárter · Pino da lança · Cubo dianteiro"></label>'
   +'<div class="grid g2">'
   +'<label class="f">Método<select id="lp_me">'+Object.entries(METODOS).map(([k,v])=>'<option value="'+k+'"'+(p&&p.metodo===k?" selected":"")+'>'+v+'</option>').join("")+'</select></label>'
   +'<label class="f">Criticidade<select id="lp_cr">'+Object.entries(CRITIC).map(([k,v])=>'<option value="'+k+'"'+((p?p.criticidade:"media")===k?" selected":"")+'>'+v+'</option>').join("")+'</select></label>'
   +'</div>'
   +'<div class="grid g2">'
   +'<label class="f">Item do almoxarifado<input id="lp_it" list="dlItens2" value="'+esc(p&&p.itemCodigo?pnDe(p.itemCodigo):"")+'" placeholder="part number do lubrificante" autocomplete="off"></label>'
   +'<datalist id="dlItens2">'+S.itens.filter(i=>i.ativo).map(i=>'<option value="'+esc(pnDe(i))+'">'+esc(i.descricao)+'</option>').join("")+'</datalist>'
   +'<label class="f">Ou lubrificante (texto livre)<input id="lp_lu" value="'+esc(p?p.lubrificante:"")+'" placeholder="ex.: graxa EP2"></label>'
   +'</div>'
   +'<div class="grid g2"><label class="f">Quantidade por aplicação<input id="lp_q" inputmode="decimal" value="'+(p?NUMIN(p.qtd,2):"0,00")+'"></label>'
   +'<label class="f">Unidade<select id="lp_un"><option value="">—</option>'+c.unidades.map(x=>'<option'+(p&&p.unidade===x?" selected":"")+'>'+esc(x)+'</option>').join("")+'</select></label></div>'
   +'<div class="note">Preencha <b>pelo menos um</b> intervalo. Com mais de um, vence o que chegar primeiro — é o que o manual do fabricante manda.</div>'
   +'<div class="grid g3">'
   +'<label class="f">A cada (horas)<input id="lp_ih" inputmode="decimal" value="'+(p&&p.intHoras?NUMIN(p.intHoras,0):"")+'" placeholder="250"></label>'
   +'<label class="f">A cada (litros)<input id="lp_il" inputmode="decimal" value="'+(p&&p.intLitros?NUMIN(p.intLitros,0):"")+'" placeholder="5000"></label>'
   +'<label class="f">A cada (dias)<input id="lp_id" inputmode="numeric" value="'+(p&&p.intDias?NUMIN(p.intDias,0):"")+'" placeholder="180"></label>'
   +'</div>'
   +'<label class="f">Procedimento<input id="lp_pr" value="'+esc(p?p.procedimento:"")+'" placeholder="opcional — como fazer, cuidados"></label>'
   +(novo?'<div class="note">Na implantação, informe quando o ponto foi lubrificado pela última vez. Sem isso ele nasce vencido.</div>'
      +'<div class="grid g2"><label class="f">Última vez em<input id="lp_ud" type="date"></label>'
      +'<label class="f">Horímetro da última vez<input id="lp_uh" inputmode="decimal" placeholder="opcional"></label></div>'
     :'<div class="grid g2"><label class="f">Última vez em<input id="lp_ud" type="date" value="'+esc(p.ultimaData||"")+'"></label>'
      +'<label class="f">Situação<select id="lp_at"><option value="1"'+(p.ativo?" selected":"")+'>Ativo</option><option value="0"'+(!p.ativo?" selected":"")+'>Inativo</option></select></label></div>')
   +'</div>';
  modal(novo?"Novo ponto de lubrificação":"Editar ponto",body,
    (novo?"":'<button class="btn dg" id="lp_del">Excluir</button>')+'<button class="btn gh" id="lp_x">Cancelar</button><button class="btn pri" id="lp_ok">Salvar</button>');
  $("#lp_x").onclick=fecharModal;
  if(!novo)$("#lp_del").onclick=async()=>{
    try{const {error}=await SB.from("lub_pontos").delete().eq("id",p._id);if(error)throw error;
      fecharModal();toast("Ponto excluído.","s");await carregarTudo();}catch(e){toast(erroMsg(e),"e");}};
  $("#lp_ok").onclick=async()=>{
    const comp=$("#lp_co").value.trim();
    if(!comp){toast("Informe o ponto / componente.","e");return;}
    const ih=pnum($("#lp_ih").value),il=pnum($("#lp_il").value),id=pnum($("#lp_id").value);
    if(!(ih>0)&&!(il>0)&&!(id>0)){toast("Informe pelo menos um intervalo: horas, litros ou dias.","e");return;}
    const cod=$("#lp_it").value.trim().toUpperCase();
    if(cod&&!itemPor(cod)){toast("Item "+cod+" não está no cadastro do almoxarifado.","e");return;}
    const fr=novo?$("#lp_fr").value:p.frota;
    const fo=S.frota.find(f=>f.codigo===fr);
    const d={frota_id:fo._id,frota:fo.codigo,ordem:parseInt(pnum($("#lp_or").value))||1,componente:comp,
      item_codigo:cod?itemPor(cod).codigo:null,lubrificante:$("#lp_lu").value.trim()||null,
      qtd:pnum($("#lp_q").value),unidade:$("#lp_un").value||null,metodo:$("#lp_me").value,
      int_horas:ih>0?ih:null,int_litros:il>0?il:null,int_dias:id>0?Math.round(id):null,
      criticidade:$("#lp_cr").value,procedimento:$("#lp_pr").value.trim()||null,
      ultima_data:$("#lp_ud").value||null};
    if(novo){const uh=pnum($("#lp_uh").value);if(uh>0)d.ultima_horas=uh;}
    else d.ativo=$("#lp_at").value==="1";
    const b=$("#lp_ok");b.disabled=true;b.textContent="Salvando…";
    try{
      const r=novo?await SB.from("lub_pontos").insert(d):await SB.from("lub_pontos").update(d).eq("id",p._id);
      if(r.error)throw r.error;
      LB.frota=fo.codigo;fecharModal();toast("Ponto salvo.","s");await carregarTudo();
    }catch(e){b.disabled=false;b.textContent="Salvar";toast(erroMsg(e),"e");}
  };
}

/* ------------------------------------------------------ copiar carta */
function dlgCopiarCarta(){
  const frotas=S.frota.filter(f=>f.ativo);
  const comCarta=[...new Set(S.lubP.map(p=>p.frota))];
  if(!comCarta.length){toast("Nenhum equipamento tem carta para copiar.","e");return;}
  modal("Copiar carta de lubrificação",
    '<p class="fine">Máquinas iguais têm a mesma carta. Os pontos são copiados com lubrificante, quantidade e intervalos — o histórico e as datas da origem <b>não</b> vão junto.</p>'
    +'<div class="grid g2"><label class="f">Copiar de<select id="cc_o">'+comCarta.map(f=>'<option>'+esc(f)+'</option>').join("")+'</select></label>'
    +'<label class="f">Para<select id="cc_d">'+frotas.map(f=>'<option'+(LB.frota===f.codigo?" selected":"")+'>'+esc(f.codigo)+'</option>').join("")+'</select></label></div>',
    '<button class="btn gh" id="cc_x">Cancelar</button><button class="btn pri" id="cc_ok">Copiar</button>');
  $("#cc_x").onclick=fecharModal;
  $("#cc_ok").onclick=async()=>{
    const b=$("#cc_ok");b.disabled=true;b.textContent="Copiando…";
    try{
      const n=await rpc("copiar_carta_lub",{p_origem:$("#cc_o").value,p_destino:$("#cc_d").value});
      LB.frota=$("#cc_d").value;fecharModal();toast(INT(n)+" ponto(s) copiado(s).","s");await carregarTudo();
    }catch(e){b.disabled=false;b.textContent="Copiar";toast(erroMsg(e),"e");}
  };
}

/* ----------------------------------------------------------- Histórico */
const FH={de:"",ate:"",tipo:"",q:"",os:"",frota:""};
function vHistorico(el){
  let h=head("Histórico","Todas as movimentações registradas, com filtro por período, tipo, OS e frota.",
    '<button class="btn" id="expMov">Exportar CSV</button>');
  h+='<div class="panel" style="margin-bottom:16px"><div class="pad grid g2">'
   +'<label class="f">De<input id="h_de" type="date" value="'+esc(FH.de)+'"></label>'
   +'<label class="f">Até<input id="h_ate" type="date" value="'+esc(FH.ate)+'"></label>'
   +'<label class="f">Tipo<select id="h_tp"><option value="">Todos</option>'+Object.entries(TIPOS).map(([k,v])=>'<option value="'+k+'"'+(FH.tipo===k?" selected":"")+'>'+v+'</option>').join("")+'</select></label>'
   +'<label class="f">Item / descrição<input id="h_q" value="'+esc(FH.q)+'"></label>'
   +'<label class="f">Ordem de serviço<input id="h_os" value="'+esc(FH.os)+'"></label>'
   +'<label class="f">Frota<input id="h_fr" value="'+esc(FH.frota)+'"></label>'
   +'</div></div>';
  const lista=filtrarMovs();
  const vE=lista.filter(m=>m.tipo==="entrada").reduce((s,m)=>s+m.vlrTotal,0);
  const vS=lista.filter(m=>m.tipo==="saida").reduce((s,m)=>s+m.vlrTotal,0);
  h+='<div class="panel"><header><h3>'+INT(lista.length)+' lançamentos</h3><div class="r">entradas '+BRL(vE)+' · saídas '+BRL(vS)+'</div></header>'+tabMovs(lista.slice(0,400),false)
   +(lista.length>400?'<div class="pad fine">Mostrando os 400 mais recentes do filtro. Use o período ou exporte em CSV.</div>':'')+'</div>';
  el.innerHTML=h;
  const bind=(id,k)=>{const e=$(id);e.onchange=()=>{FH[k]=e.value;render();};};
  bind("#h_de","de");bind("#h_ate","ate");bind("#h_tp","tipo");bind("#h_os","os");bind("#h_fr","frota");
  const q=$("#h_q");q.oninput=()=>{FH.q=q.value;render();const n=$("#h_q");n.focus();n.setSelectionRange(n.value.length,n.value.length);};
  $("#expMov").onclick=()=>baixar("movimentacoes-"+hoje()+".csv",csvMovs(lista));
}
function filtrarMovs(){
  const q=FH.q.trim().toLowerCase();
  return S.movs.filter(m=>{
    if(FH.de&&String(m.data)<FH.de)return false;
    if(FH.ate&&String(m.data)>FH.ate)return false;
    if(FH.tipo&&m.tipo!==FH.tipo)return false;
    if(FH.os&&!m.os.toLowerCase().includes(FH.os.toLowerCase()))return false;
    if(FH.frota&&!m.frota.toLowerCase().includes(FH.frota.toLowerCase()))return false;
    if(q&&!((m.codigo+" "+m.descricao+" "+m.obs+" "+m.solicitante).toLowerCase().includes(q)))return false;
    return true;
  });
}
function tabMovs(lista,compacto){
  if(!lista.length)return '<div class="empty"><b>Nenhum lançamento</b>As movimentações aparecem aqui assim que forem registradas.</div>';
  return '<div class="tw"><table><thead><tr><th>Data</th><th>Tipo</th><th>Item</th><th class="num">Qtd</th><th class="num">Valor</th>'
   +(compacto?'':'<th>OS / Frota</th><th>Origem</th><th>Operador</th>')+'</tr></thead><tbody>'
   +lista.map(m=>'<tr><td class="num" style="text-align:left">'+dbr(m.data)+'</td>'
     +'<td><span class="tag '+(TIPOTAG[m.tipo]||"t-neu")+'">'+esc(TIPOS[m.tipo]||m.tipo)+'</span></td>'
     +'<td><div class="cod">'+esc(pnDe(m.codigo))+'</div><div class="mut">'+esc(m.descricao)+'</div></td>'
     +'<td class="num">'+(m.tipo==="saida"?"−":m.tipo==="ajuste"?"=":"+")+NUM(m.qtd,2)+' <span class="mut">'+esc(m.un)+'</span>'+(m.saldoPosterior!=null?'<div class="mut">saldo '+NUM(m.saldoPosterior,2)+'</div>':'')+'</td>'
     +'<td class="num">'+BRL(m.vlrTotal)+'<div class="mut">'+BRL(m.vlrUnit)+'/un</div></td>'
     +(compacto?'':'<td>'+(m.os?'<div>'+esc(m.os)+'</div>':'')+(m.frota?'<div class="mut">'+esc(m.frota)+'</div>':'')+(!m.os&&!m.frota?'<span class="mut">—</span>':'')+'</td>'
       +'<td>'+(m.fornecedor?'<div>'+esc(m.fornecedor)+'</div>':'')+(m.nf?'<div class="mut">NF '+esc(m.nf)+'</div>':'')+(m.obs?'<div class="mut">'+esc(m.obs)+'</div>':'')+(!m.fornecedor&&!m.nf&&!m.obs?'<span class="mut">—</span>':'')+'</td>'
       +'<td class="mut">'+esc(m.usuario||"—")+(m.solicitante?'<div>p/ '+esc(m.solicitante)+'</div>':'')+'</td>')
     +'</tr>').join("")+'</tbody></table></div>';
}

/* --------------------------------------------------------------- Frota */
function vFrota(el){
  const custo={};for(const m of S.movs){if(m.frota&&(m.tipo==="saida"||m.tipo==="devolucao"))custo[m.frota]=(custo[m.frota]||0)+(m.tipo==="saida"?m.vlrTotal:-m.vlrTotal);}
  let h=head("Frota atendida","Caminhões, tratores e máquinas que consomem o almoxarifado. O consumo vem das saídas vinculadas a cada prefixo.",
    podeLancar()?'<button class="btn pri" id="novaFrota">Novo equipamento</button>':'')+soLeitura();
  h+='<div class="panel">'+(S.frota.length?'<div class="tw"><table><thead><tr><th>Prefixo</th><th>Tipo</th><th>Marca / modelo</th><th>Placa</th><th>Local</th><th class="num">Consumo acum.</th><th></th></tr></thead><tbody>'
   +S.frota.map(f=>'<tr><td class="cod">'+esc(f.codigo)+(f.exemplo?' <span class="tag t-acc">ex.</span>':'')+'</td><td>'+esc(f.tipo||"—")+'</td><td>'+esc(f.marcaModelo||"—")+(f.ano?' <span class="mut">'+esc(f.ano)+'</span>':'')+'</td><td class="cod">'+esc(f.placa||"—")+'</td><td class="mut">'+esc(f.local||"—")+'</td><td class="num">'+BRL(custo[f.codigo]||0)+'</td><td class="num" style="white-space:nowrap"><button class="btn sm" data-fpec="'+esc(f.codigo)+'">Peças</button> '+(podeLancar()?'<button class="btn sm gh" data-fed="'+esc(f._id)+'">Editar</button>':'')+'</td></tr>').join("")
   +'</tbody></table></div>':'<div class="empty"><b>Nenhum equipamento</b>Cadastre os prefixos da frota para medir custo de manutenção por máquina.</div>')+'</div>';
  el.innerHTML=h;
  if($("#novaFrota"))$("#novaFrota").onclick=()=>formFrota(null);
  $$("[data-fed]",el).forEach(b=>b.onclick=()=>formFrota(S.frota.find(f=>f._id===b.dataset.fed)));
  $$("[data-fpec]",el).forEach(b=>b.onclick=()=>dlgPecasFrota(b.dataset.fpec));
}

/* Tudo que este equipamento já recebeu do almoxarifado: consolidado por
   peça e, embaixo, lançamento a lançamento. Devolução entra negativa,
   para a quantidade refletir o que de fato ficou na máquina. */
function dlgPecasFrota(codigo){
  const eq=S.frota.find(f=>f.codigo===codigo);
  const movs=S.movs.filter(m=>m.frota===codigo&&(m.tipo==="saida"||m.tipo==="devolucao"))
    .slice().sort((a,b)=>String(b.data||"").localeCompare(String(a.data||""))||(b.id-a.id));
  const porItem={}; let total=0;
  for(const m of movs){
    const sg=m.tipo==="saida"?1:-1;
    let r=porItem[m.codigo];
    if(!r)r=porItem[m.codigo]={codigo:m.codigo,descricao:m.descricao,un:m.un,qtd:0,valor:0,vezes:0,ultima:m.data};
    r.qtd+=sg*m.qtd; r.valor+=sg*m.vlrTotal; r.vezes++;
    if(String(m.data||"")>String(r.ultima||""))r.ultima=m.data;
    total+=sg*m.vlrTotal;
  }
  const itens=Object.values(porItem).sort((a,b)=>b.valor-a.valor);
  const periodo=movs.length?dbr(movs[movs.length-1].data)+" a "+dbr(movs[0].data):"";
  const tit='Pe\u00e7as aplicadas em '+codigo+(eq&&eq.marcaModelo?' \u00b7 '+eq.marcaModelo:'');
  let corpo;
  if(!movs.length){
    corpo='<div class="empty"><b>Nenhuma peça aplicada</b>Este equipamento ainda não recebeu nenhuma saída do almoxarifado.</div>';
  }else{
    corpo='<div class="note" style="margin-bottom:12px"><b>'+INT(itens.length)+'</b> peça(s) diferente(s) · <b>'+INT(movs.length)+'</b> lançamento(s) · total <b>'+BRL(total)+'</b>'+(periodo?' · '+esc(periodo):'')+'</div>'
     +'<h4 style="margin:0 0 6px;font-size:13px;font-weight:600">Consolidado por peça</h4>'
     +'<div class="tw" style="max-height:32vh;overflow:auto"><table><thead><tr><th>Peça</th><th class="num">Qtd</th><th class="num">Valor</th></tr></thead><tbody>'
     +itens.map(i=>'<tr><td><div class="cod">'+esc(pnDe(i.codigo))+'</div><div>'+esc(i.descricao)+'</div>'
       +'<div class="mut">'+(i.vezes>1?INT(i.vezes)+' lançamentos · ':'')+'última em '+dbr(i.ultima)+'</div></td>'
       +'<td class="num">'+NUM(i.qtd,2)+' <span class="mut">'+esc(i.un)+'</span></td>'
       +'<td class="num">'+BRL(i.valor)+'</td></tr>').join("")
     +'</tbody></table></div>'
     +'<h4 style="margin:14px 0 6px;font-size:13px;font-weight:600">Lançamento a lançamento</h4>'
     +'<div class="tw" style="max-height:32vh;overflow:auto"><table><thead><tr><th>Peça</th><th class="num">Qtd</th><th class="num">Valor</th></tr></thead><tbody>'
     +movs.map(m=>{
       const det=[m.os||'',m.solicitante||m.usuario||''].filter(Boolean).join(' · ');
       return '<tr><td><div class="cod">'+esc(pnDe(m.codigo))+'</div><div>'+esc(m.descricao)+'</div>'
        +(m.tipo==="devolucao"?'<div><span class="tag t-pri">devolvida</span></div>':'')
        +'<div class="mut">'+esc([dbr(m.data)].concat(det?[det]:[]).join(' · '))+'</div></td>'
        +'<td class="num">'+(m.tipo==="saida"?"−":"+")+NUM(m.qtd,2)+' <span class="mut">'+esc(m.un)+'</span></td>'
        +'<td class="num">'+BRL(m.vlrTotal)+'</td></tr>';
     }).join("")
     +'</tbody></table></div>';
  }
  modal(tit,corpo,(movs.length?'<button class="btn" id="pf_csv">Baixar CSV</button>':'')+'<button class="btn pri" id="pf_x">Fechar</button>');
  $("#pf_x").onclick=fecharModal;
  if($("#pf_csv"))$("#pf_csv").onclick=()=>baixar("pecas-"+codigo.toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-"+hoje()+".csv",csvMovs(movs));
}
function formFrota(f){
  const c=cfg(),novo=!f;
  modal(novo?"Novo equipamento":"Editar "+f.codigo,'<div class="grid g2">'
   +'<label class="f">Prefixo / código<input id="f_cod" value="'+esc(f?f.codigo:"")+'" placeholder="CAM-014"></label>'
   +'<label class="f">Tipo<select id="f_tp">'+c.tiposFrota.map(x=>'<option'+(f&&f.tipo===x?" selected":"")+'>'+esc(x)+'</option>').join("")+'</select></label>'
   +'<label class="f">Marca / modelo<input id="f_mm" value="'+esc(f?f.marcaModelo:"")+'" placeholder="Mercedes-Benz Axor 2831"></label>'
   +'<label class="f">Placa<input id="f_pl" value="'+esc(f?f.placa:"")+'"></label>'
   +'<label class="f">Ano<input id="f_an" value="'+esc(f?f.ano:"")+'"></label>'
   +'<label class="f">Local / obra<input id="f_lo" value="'+esc(f?f.local:"")+'"></label>'
   +'<label class="f">Situação<select id="f_at"><option value="1"'+(!f||f.ativo?" selected":"")+'>Ativo</option><option value="0"'+(f&&!f.ativo?" selected":"")+'>Inativo</option></select></label>'
   +'</div>',(novo?"":'<button class="btn dg" id="f_del">Excluir</button>')+'<button class="btn gh" id="f_x">Cancelar</button><button class="btn pri" id="f_ok">Salvar</button>');
  $("#f_x").onclick=fecharModal;
  if(!novo)$("#f_del").onclick=async()=>{try{const {error}=await SB.from("frota").delete().eq("id",f._id);if(error)throw error;fecharModal();toast("Equipamento excluído.","s");await carregarTudo();}catch(e){toast(erroMsg(e),"e");}};
  $("#f_ok").onclick=async()=>{
    const cod=$("#f_cod").value.trim().toUpperCase();if(!cod){toast("Informe o prefixo.","e");return;}
    const d={codigo:cod,tipo:$("#f_tp").value,marca_modelo:$("#f_mm").value.trim(),placa:$("#f_pl").value.trim().toUpperCase(),
      ano:$("#f_an").value.trim(),local:$("#f_lo").value.trim(),ativo:$("#f_at").value==="1"};
    try{
      const r=f?await SB.from("frota").update(d).eq("id",f._id):await SB.from("frota").insert(d);
      if(r.error)throw r.error;fecharModal();toast("Equipamento salvo.","s");await carregarTudo();
    }catch(e){toast(erroMsg(e),"e");}
  };
}

/* -------------------------------------------------------- Fornecedores */
function vForn(el){
  const tot={};for(const m of S.movs){if(m.tipo==="entrada"&&m.fornecedor)tot[m.fornecedor]=(tot[m.fornecedor]||0)+m.vlrTotal;}
  let h=head("Fornecedores","Quem abastece o almoxarifado, com total comprado apurado pelas entradas.",
    podeLancar()?'<button class="btn pri" id="novoForn">Novo fornecedor</button>':'')+soLeitura();
  h+='<div class="panel">'+(S.forn.length?'<div class="tw"><table><thead><tr><th>Fornecedor</th><th>CNPJ</th><th>Contato</th><th>Telefone</th><th>E-mail</th><th class="num">Comprado</th><th></th></tr></thead><tbody>'
   +S.forn.map(f=>'<tr><td>'+esc(f.nome)+(f.exemplo?' <span class="tag t-acc">ex.</span>':'')+(f.obs?'<div class="mut">'+esc(f.obs)+'</div>':'')+'</td><td class="cod">'+esc(f.cnpj||"—")+'</td><td>'+esc(f.contato||"—")+'</td><td class="cod">'+esc(f.telefone||"—")+'</td><td class="mut">'+esc(f.email||"—")+'</td><td class="num">'+BRL(tot[f.nome]||0)+'</td><td class="num">'+(podeLancar()?'<button class="btn sm gh" data-oed="'+esc(f._id)+'">Editar</button>':'')+'</td></tr>').join("")
   +'</tbody></table></div>':'<div class="empty"><b>Nenhum fornecedor</b>Cadastre os fornecedores para vincular às entradas de nota fiscal.</div>')+'</div>';
  el.innerHTML=h;
  if($("#novoForn"))$("#novoForn").onclick=()=>formForn(null);
  $$("[data-oed]",el).forEach(b=>b.onclick=()=>formForn(S.forn.find(f=>f._id===b.dataset.oed)));
}
function formForn(f){
  const novo=!f;
  modal(novo?"Novo fornecedor":"Editar fornecedor",'<div class="grid g2">'
   +'<label class="f">Razão social / nome<input id="o_nm" value="'+esc(f?f.nome:"")+'"></label>'
   +'<label class="f">CNPJ<input id="o_cn" value="'+esc(f?f.cnpj:"")+'"></label>'
   +'<label class="f">Contato<input id="o_ct" value="'+esc(f?f.contato:"")+'"></label>'
   +'<label class="f">Telefone<input id="o_tl" value="'+esc(f?f.telefone:"")+'"></label>'
   +'<label class="f">E-mail<input id="o_em" value="'+esc(f?f.email:"")+'"></label>'
   +'<label class="f">Observação<input id="o_ob" value="'+esc(f?f.obs:"")+'"></label>'
   +'</div>',(novo?"":'<button class="btn dg" id="o_del">Excluir</button>')+'<button class="btn gh" id="o_x">Cancelar</button><button class="btn pri" id="o_ok">Salvar</button>');
  $("#o_x").onclick=fecharModal;
  if(!novo)$("#o_del").onclick=async()=>{try{const {error}=await SB.from("fornecedores").delete().eq("id",f._id);if(error)throw error;fecharModal();toast("Fornecedor excluído.","s");await carregarTudo();}catch(e){toast(erroMsg(e),"e");}};
  $("#o_ok").onclick=async()=>{
    const nm=$("#o_nm").value.trim();if(!nm){toast("Informe o nome do fornecedor.","e");return;}
    const d={nome:nm,cnpj:$("#o_cn").value.trim(),contato:$("#o_ct").value.trim(),telefone:$("#o_tl").value.trim(),
      email:$("#o_em").value.trim(),obs:$("#o_ob").value.trim()};
    try{
      const r=f?await SB.from("fornecedores").update(d).eq("id",f._id):await SB.from("fornecedores").insert(d);
      if(r.error)throw r.error;fecharModal();toast("Fornecedor salvo.","s");await carregarTudo();
    }catch(e){toast(erroMsg(e),"e");}
  };
}

/* --------------------------------------------------------- Ferramentas */
const FF={hist:false,q:""};
function vFerramentas(el){
  const abertos=empAbertos(),atras=empAtrasados(),todos=S.emps;
  const q=FF.q.trim().toLowerCase();
  const filtra=l=>q?l.filter(e=>(e.codigo+" "+e.descricao+" "+e.retiradoPor+" "+e.os+" "+e.frota).toLowerCase().includes(q)):l;
  let h=head("Ferramentas","Quem está com cada ferramenta, desde quando e o que já voltou para a ferramentaria.",
    (podeRequisitar()?'<button class="btn pri" id="novaRet">Registrar retirada</button>':'')
    +(podeLancar()?'<button class="btn" id="novaFerr">Nova ferramenta</button>':'')
    +'<button class="btn" id="expEmp">Exportar CSV</button>')+soLeitura();
  h+='<div class="kpis">'
   +kpi("Em poder da equipe",INT(abertos.reduce((s,e)=>s+e.qtd,0)),INT(abertos.length)+" retiradas abertas")
   +kpi("Em atraso",INT(atras.length),atras.length?"prazo de devolução vencido":"todos dentro do prazo",atras.length?"al":"")
   +kpi("Na ferramentaria",INT(S.ferr.reduce((s,f)=>s+f.disponivel,0)),INT(S.ferr.length)+" ferramentas cadastradas")
   +kpi("Baixadas",INT(todos.filter(e=>e.situacao==="baixado").length),"perda, quebra ou extravio")
   +'</div>';
  h+='<div class="panel" style="margin-bottom:16px"><div class="pad"><label class="f">Buscar<input id="ff_q" placeholder="ferramenta, quem retirou, OS ou frota" value="'+esc(FF.q)+'"></label></div></div>';
  const lista=filtra(abertos);
  h+='<div class="panel" style="margin-bottom:16px"><header><h3>Retiradas em aberto</h3><div class="r">'+INT(lista.length)+'</div></header>'
   +(lista.length?'<div class="tw"><table><thead><tr><th>Ferramenta</th><th class="num">Qtd</th><th>Retirada por</th><th>Retirada em</th><th>Devolver até</th><th>OS / Frota</th><th></th></tr></thead><tbody>'
     +lista.map(e=>{const atrasado=e.previsao&&e.previsao<hoje();
       const dias=Math.floor((new Date(hoje())-new Date(e.retiradoEm))/864e5);
       return '<tr class="'+(atrasado?"low":"")+'"><td><div class="cod">'+esc(e.codigo)+'</div><div class="mut">'+esc(e.descricao)+'</div>'+(e.obs?'<div class="mut">'+esc(e.obs)+'</div>':'')+'</td>'
       +'<td class="num">'+NUM(e.qtd,0)+'</td>'
       +'<td>'+esc(e.retiradoPor||"—")+'<div class="mut">entregue por '+esc(e.usuario||"—")+'</div></td>'
       +'<td class="num" style="text-align:left">'+dbr(e.retiradoEm)+'<div class="mut">há '+INT(dias)+' dia(s)</div></td>'
       +'<td class="num" style="text-align:left">'+(e.previsao?dbr(e.previsao)+(atrasado?' <span class="tag t-crit">atrasada</span>':''):'<span class="mut">sem prazo</span>')+'</td>'
       +'<td>'+(e.os?'<div>'+esc(e.os)+'</div>':'')+(e.frota?'<div class="mut">'+esc(e.frota)+'</div>':'')+(!e.os&&!e.frota?'<span class="mut">—</span>':'')+'</td>'
       +'<td class="num">'+(podeRequisitar()?'<button class="btn sm" data-dev="'+e.id+'">Devolver</button> ':'')
       +(podeLancar()?'<button class="btn sm gh dg" data-bx="'+e.id+'">Baixar</button>':'')+'</td></tr>';}).join("")
     +'</tbody></table></div>'
   :'<div class="empty"><b>Nenhuma ferramenta fora</b>Tudo que está cadastrado está na ferramentaria.</div>')+'</div>';
  h+='<div class="panel" style="margin-bottom:16px"><header><h3>Ferramentaria</h3><div class="r">disponível = total − em poder da equipe</div></header>'
   +(S.ferr.length?'<div class="tw"><table><thead><tr><th>Código</th><th>Ferramenta</th><th>Patrimônio</th><th>Local</th><th class="num">Total</th><th class="num">Em campo</th><th class="num">Disponível</th><th></th></tr></thead><tbody>'
     +S.ferr.map(f=>'<tr class="'+(f.disponivel<=0?"zero":"")+'"><td class="cod">'+esc(f.codigo)+(f.exemplo?' <span class="tag t-acc">ex.</span>':'')+'</td>'
       +'<td>'+esc(f.descricao)+(f.marca?'<div class="mut">'+esc(f.marca)+'</div>':'')+'</td>'
       +'<td class="cod mut">'+esc(f.patrimonio||"—")+'</td><td class="mut">'+esc(f.local||"—")+'</td>'
       +'<td class="num">'+NUM(f.quantidade,0)+'</td><td class="num">'+NUM(f.emCampo,0)+'</td><td class="num"><b>'+NUM(f.disponivel,0)+'</b></td>'
       +'<td class="num">'+(podeRequisitar()?'<button class="btn sm" data-ret="'+esc(f.codigo)+'"'+(f.disponivel<=0?" disabled":"")+'>Retirar</button> ':'')
       +(podeLancar()?'<button class="btn sm gh" data-fe="'+esc(f._id)+'">Editar</button>':'')+'</td></tr>').join("")
     +'</tbody></table></div>'
   :'<div class="empty"><b>Ferramentaria vazia</b>Cadastre as ferramentas controladas — chaves de impacto, torquímetro, macaco, esmerilhadeira, instrumentos.</div>')+'</div>';
  const hist=filtra(todos.filter(e=>e.situacao!=="aberto"));
  h+='<div class="panel"><header><h3>Devoluções e baixas</h3><div class="r"><button class="btn sm gh" id="ff_tg">'+(FF.hist?"Ocultar":"Mostrar "+INT(hist.length))+'</button></div></header>'
   +(FF.hist?(hist.length?'<div class="tw"><table><thead><tr><th>Ferramenta</th><th class="num">Qtd</th><th>Retirada por</th><th>Período</th><th>Situação</th><th>Recebida por</th></tr></thead><tbody>'
     +hist.slice(0,300).map(e=>'<tr><td><div class="cod">'+esc(e.codigo)+'</div><div class="mut">'+esc(e.descricao)+'</div></td><td class="num">'+NUM(e.qtd,0)+'</td><td>'+esc(e.retiradoPor||"—")+'</td>'
       +'<td class="num" style="text-align:left">'+dbr(e.retiradoEm)+' → '+(e.devolvidoEm?dbr(e.devolvidoEm):"—")+'</td>'
       +'<td><span class="tag '+(e.situacao==="devolvido"?"t-ok":"t-crit")+'">'+(e.situacao==="devolvido"?"Devolvida":"Baixada")+'</span>'+(e.motivo?'<div class="mut">'+esc(e.motivo)+'</div>':'')+'</td>'
       +'<td class="mut">'+esc(e.recebidoPor||"—")+'</td></tr>').join("")+'</tbody></table></div>'
     :'<div class="empty"><b>Nada devolvido ainda</b>O histórico aparece aqui quando as ferramentas voltarem.</div>')
    :'<div class="pad fine">'+INT(hist.length)+' registro(s) encerrado(s).</div>')+'</div>';
  el.innerHTML=h;
  const q2=$("#ff_q");q2.oninput=()=>{FF.q=q2.value;render();const n=$("#ff_q");n.focus();n.setSelectionRange(n.value.length,n.value.length);};
  $("#ff_tg").onclick=()=>{FF.hist=!FF.hist;render();};
  if($("#novaFerr"))$("#novaFerr").onclick=()=>formFerr(null);
  if($("#novaRet"))$("#novaRet").onclick=()=>formRetirada("");
  $("#expEmp").onclick=()=>baixar("ferramentas-emprestimos-"+hoje()+".csv",csvEmp(todos));
  $$("[data-fe]",el).forEach(b=>b.onclick=()=>formFerr(S.ferr.find(f=>f._id===b.dataset.fe)));
  $$("[data-ret]",el).forEach(b=>b.onclick=()=>formRetirada(b.dataset.ret));
  $$("[data-dev]",el).forEach(b=>b.onclick=()=>formDevolucao(+b.dataset.dev,false));
  $$("[data-bx]",el).forEach(b=>b.onclick=()=>formDevolucao(+b.dataset.bx,true));
}
function formFerr(f){
  const c=cfg(),novo=!f;
  modal(novo?"Nova ferramenta":"Editar "+f.codigo,'<div class="grid g2">'
   +'<label class="f">Código<input id="t_cod" value="'+esc(f?f.codigo:"")+'" '+(novo?"":"disabled")+' placeholder="FER-0012"></label>'
   +'<label class="f">Descrição<input id="t_ds" value="'+esc(f?f.descricao:"")+'" placeholder="Chave de impacto 1&quot; pneumática"></label>'
   +'<label class="f">Marca / modelo<input id="t_mc" value="'+esc(f?f.marca:"")+'"></label>'
   +'<label class="f">Nº de patrimônio<input id="t_pt" value="'+esc(f?f.patrimonio:"")+'"></label>'
   +'<label class="f">Quantidade total<input id="t_qt" inputmode="numeric" value="'+(f?NUM(f.quantidade,0):"1")+'"></label>'
   +'<label class="f">Local de guarda<select id="t_lo">'+c.locais.map(x=>'<option'+(f&&f.local===x?" selected":"")+'>'+esc(x)+'</option>').join("")+'</select></label>'
   +'</div><div class="grid" style="margin-top:12px"><label class="f">Observação<input id="t_ob" value="'+esc(f?f.obs:"")+'" placeholder="calibração, acessórios que acompanham"></label></div>',
   (novo?"":'<button class="btn dg" id="t_del">Excluir</button>')+'<button class="btn gh" id="t_x">Cancelar</button><button class="btn pri" id="t_ok">Salvar</button>');
  $("#t_x").onclick=fecharModal;
  if(!novo)$("#t_del").onclick=async()=>{
    if(empAbertos().some(e=>e.codigo===f.codigo)){toast("Há retirada em aberto desta ferramenta. Registre a devolução antes de excluir.","e");return;}
    try{const {error}=await SB.from("ferramentas").delete().eq("id",f._id);if(error)throw error;fecharModal();toast("Ferramenta excluída.","s");await carregarTudo();}catch(e){toast(erroMsg(e),"e");}};
  $("#t_ok").onclick=async()=>{
    const cod=(novo?$("#t_cod").value:f.codigo).trim().toUpperCase(),ds=$("#t_ds").value.trim();
    if(!cod||!ds){toast("Informe código e descrição.","e");return;}
    const d={codigo:cod,descricao:ds,marca:$("#t_mc").value.trim(),patrimonio:$("#t_pt").value.trim(),
      quantidade:Math.max(0,Math.round(pnum($("#t_qt").value))),local:$("#t_lo").value,obs:$("#t_ob").value.trim(),
      atualizado_em:new Date().toISOString()};
    try{
      const r=f?await SB.from("ferramentas").update(d).eq("id",f._id):await SB.from("ferramentas").insert(d);
      if(r.error)throw r.error;fecharModal();toast("Ferramenta salva.","s");await carregarTudo();
    }catch(e){toast(erroMsg(e),"e");}
  };
}
function formRetirada(cod){
  if(!S.ferr.length){toast("Cadastre ao menos uma ferramenta antes de registrar retiradas.","e");return;}
  const d7=new Date(Date.now()+7*864e5).toISOString().slice(0,10);
  modal("Registrar retirada",'<div class="grid">'
   +'<div class="scan"><label class="f" style="flex:1">Ferramenta<input id="r_fe" list="dlFerr" value="'+esc(cod)+'" placeholder="código da ferramenta" autocomplete="off"></label><button class="btn" id="r_scan" type="button">Ler código</button></div>'
   +'<datalist id="dlFerr">'+S.ferr.map(f=>'<option value="'+esc(f.codigo)+'">'+esc(f.descricao)+' · disponível '+NUM(f.disponivel,0)+' de '+NUM(f.quantidade,0)+'</option>').join("")+'</datalist>'
   +'<div class="grid g3"><label class="f">Quantidade<input id="r_q" inputmode="numeric" value="1"></label>'
   +'<label class="f">Retirada em<input id="r_dt" type="date" value="'+hoje()+'"></label>'
   +'<label class="f">Devolver até<input id="r_pv" type="date" value="'+d7+'"></label></div>'
   +'<div class="grid g3"><label class="f">Retirada por<input id="r_por" list="dlUsr2" value="'+esc(papel()==="mecanico"?(S.perfil?S.perfil.nome:""):"")+'" autocomplete="off" placeholder="nome do mecânico"></label>'
   +'<datalist id="dlUsr2">'+S.perfis.map(u=>'<option value="'+esc(u.nome)+'"></option>').join("")+'</datalist>'
   +'<label class="f">Ordem de serviço<input id="r_os" placeholder="OS-0000"></label>'
   +'<label class="f">Frota / equipamento<input id="r_fr" list="dlFrota2" autocomplete="off"></label>'
   +'<datalist id="dlFrota2">'+S.frota.filter(f=>f.ativo).map(f=>'<option value="'+esc(f.codigo)+'"></option>').join("")+'</datalist></div>'
   +'<label class="f">Observação<input id="r_ob" placeholder="estado da ferramenta na saída, acessórios"></label>'
   +'<div class="fine" id="r_msg"></div></div>',
   '<button class="btn gh" id="r_x">Cancelar</button><button class="btn pri" id="r_ok">Registrar retirada</button>');
  $("#r_x").onclick=fecharModal;
  const aviso=()=>{const c=$("#r_fe").value.trim().toUpperCase(),f=S.ferr.find(x=>x.codigo===c);
    $("#r_msg").textContent=f?f.descricao+" · disponível "+NUM(f.disponivel,0)+" de "+NUM(f.quantidade,0):(c?"Ferramenta não cadastrada.":"");};
  $("#r_fe").onchange=aviso;aviso();
  $("#r_scan").onclick=()=>lerCodigo(c=>{$("#r_fe").value=c.toUpperCase();aviso();});
  $("#r_ok").onclick=async()=>{
    const b=$("#r_ok");b.disabled=true;b.textContent="Registrando…";
    try{
      await rpc("registrar_retirada",{p_codigo:$("#r_fe").value.trim(),p_qtd:Math.round(pnum($("#r_q").value)),
        p_retirado_por:$("#r_por").value.trim(),p_retirado_em:$("#r_dt").value||hoje(),p_previsao:$("#r_pv").value||null,
        p_os:$("#r_os").value.trim()||null,p_frota:$("#r_fr").value.trim()||null,p_obs:$("#r_ob").value.trim()||null});
      fecharModal();toast("Retirada registrada.","s");await carregarTudo();
    }catch(e){b.disabled=false;b.textContent="Registrar retirada";toast(erroMsg(e),"e");}
  };
}
function formDevolucao(id,baixa){
  const e=S.emps.find(x=>x.id===id);
  if(!e){toast("Registro não encontrado.","e");return;}
  modal(baixa?"Dar baixa em "+e.codigo:"Devolver "+e.codigo,
   '<p>'+esc(e.descricao||e.codigo)+' · <b>'+NUM(e.qtd,0)+'</b> unidade(s) com <b>'+esc(e.retiradoPor||"—")+'</b> desde '+dbr(e.retiradoEm)+'.</p>'
   +'<div class="grid g2">'
   +(baixa?'<label class="f">Motivo<select id="v_mt"><option>Perda</option><option>Quebra / inutilizada</option><option>Extravio em obra</option><option>Descarte</option></select></label><label class="f">Data<input id="v_dt" type="date" value="'+hoje()+'"></label>'
     :'<label class="f">Devolvida em<input id="v_dt" type="date" value="'+hoje()+'"></label><label class="f">Recebida por<input id="v_rec" value="'+esc(S.perfil?S.perfil.nome:"")+'"></label>')
   +'</div><div class="grid" style="margin-top:12px"><label class="f">Observação<input id="v_ob" placeholder="'+(baixa?"o que aconteceu":"estado da ferramenta na devolução")+'"></label></div>'
   +(baixa?'<div class="note" style="margin-top:12px">A quantidade total da ferramenta no cadastro será reduzida em '+NUM(e.qtd,0)+'.</div>':''),
   '<button class="btn gh" id="v_x">Cancelar</button><button class="btn '+(baixa?"dg":"pri")+'" id="v_ok">'+(baixa?"Confirmar baixa":"Confirmar devolução")+'</button>');
  $("#v_x").onclick=fecharModal;
  $("#v_ok").onclick=async()=>{
    const b=$("#v_ok");b.disabled=true;b.textContent="Salvando…";
    try{
      await rpc("encerrar_emprestimo",{p_id:id,p_situacao:baixa?"baixado":"devolvido",p_data:$("#v_dt").value||hoje(),
        p_recebido_por:baixa?null:($("#v_rec").value.trim()||null),p_motivo:baixa?$("#v_mt").value:null,
        p_obs:$("#v_ob").value.trim()||null});
      fecharModal();toast(baixa?"Baixa registrada.":"Devolução registrada.","s");await carregarTudo();
    }catch(err){b.disabled=false;b.textContent=baixa?"Confirmar baixa":"Confirmar devolução";toast(erroMsg(err),"e");}
  };
}

/* ---------------------------------------------------------- Inventário */
const IV={loc:"",cat:"",cont:{}};
function vInventario(el){
  let h=head("Inventário","Folha de contagem física. O que divergir do sistema gera um ajuste no histórico.",
    '<button class="btn" id="expInv">Exportar folha</button>')+soLeitura();
  h+='<div class="panel" style="margin-bottom:16px"><div class="pad grid g2">'
   +'<label class="f">Localização<select id="v_loc"><option value="">Todas</option>'+cfg().locais.map(c=>'<option'+(IV.loc===c?" selected":"")+'>'+esc(c)+'</option>').join("")+'</select></label>'
   +'<label class="f">Categoria<select id="v_cat"><option value="">Todas</option>'+cfg().categorias.map(c=>'<option'+(IV.cat===c?" selected":"")+'>'+esc(c)+'</option>').join("")+'</select></label>'
   +'</div></div>';
  const lista=S.itens.filter(i=>i.ativo&&(!IV.loc||i.local===IV.loc)&&(!IV.cat||i.categoria===IV.cat));
  let div=0,divv=0;
  for(const i of lista){const c=IV.cont[i.codigo];if(c==null||c==="")continue;const d=pnum(c)-i.saldo;if(Math.abs(d)>1e-6){div++;divv+=d*i.custoMedio;}}
  h+='<div class="panel"><header><h3>Contagem · '+INT(lista.length)+' itens</h3><div class="r">'+INT(div)+' divergências · impacto '+BRL(divv)+'</div></header>'
   +(lista.length?'<div class="tw"><table><thead><tr><th>Part number</th><th>Descrição</th><th>Local</th><th class="num">Sistema</th><th style="width:120px">Contado</th><th class="num">Diferença</th></tr></thead><tbody>'
     +lista.map(i=>{const c=IV.cont[i.codigo],d=(c==null||c==="")?null:pnum(c)-i.saldo;
       return '<tr><td class="cod">'+esc(pnDe(i))+'</td><td>'+esc(i.descricao)+'</td><td class="mut">'+esc(i.local||"—")+'</td><td class="num">'+NUM(i.saldo,2)+'</td>'
       +'<td><input class="ct" data-c="'+esc(i.codigo)+'" inputmode="decimal" value="'+esc(c==null?"":c)+'" placeholder="—" style="text-align:right;font-family:var(--mono)"'+(podeLancar()?"":" disabled")+'></td>'
       +'<td class="num">'+(d==null?'<span class="mut">—</span>':(Math.abs(d)<1e-6?'<span class="tag t-ok">confere</span>':'<span class="tag '+(d<0?"t-crit":"t-warn")+'">'+(d>0?"+":"")+NUM(d,2)+'</span>'))+'</td></tr>';}).join("")
     +'</tbody></table></div><div class="pad" style="display:flex;gap:8px;justify-content:flex-end;align-items:center"><span class="fine">Só os itens com divergência geram ajuste.</span><button class="btn gh" id="v_clr">Limpar contagem</button>'
     +(podeLancar()?'<button class="btn pri" id="v_ok"'+(div?"":" disabled")+'>Aplicar '+INT(div)+' ajuste(s)</button>':'')+'</div>'
   :'<div class="empty"><b>Nada a contar</b>Nenhum item ativo nesse filtro.</div>')+'</div>';
  if(S.invs.length)h+='<div class="panel" style="margin-top:16px"><header><h3>Inventários aplicados</h3></header><div class="tw"><table><thead><tr><th>Data</th><th>Responsável</th><th>Escopo</th><th class="num">Ajustes</th><th class="num">Impacto</th></tr></thead><tbody>'
   +S.invs.map(v=>'<tr><td>'+dbr(v.data)+'</td><td>'+esc(v.responsavel||"—")+'</td><td class="mut">'+esc([v.local,v.categoria].filter(Boolean).join(" · ")||"geral")+'</td><td class="num">'+INT((v.linhas||[]).length)+'</td><td class="num">'+BRL(v.impacto)+'</td></tr>').join("")+'</tbody></table></div></div>';
  el.innerHTML=h;
  $("#v_loc").onchange=e=>{IV.loc=e.target.value;render();};
  $("#v_cat").onchange=e=>{IV.cat=e.target.value;render();};
  $$(".ct",el).forEach(i=>{i.onchange=()=>{IV.cont[i.dataset.c]=i.value;render();};});
  if($("#expInv"))$("#expInv").onclick=()=>baixar("folha-inventario-"+hoje()+".csv",csvInv(lista));
  if($("#v_clr"))$("#v_clr").onclick=()=>{IV.cont={};render();};
  if($("#v_ok"))$("#v_ok").onclick=()=>aplicarInventario(lista,divv);
}
function aplicarInventario(lista,impacto){
  const linhas=[];
  for(const i of lista){const c=IV.cont[i.codigo];if(c==null||c==="")continue;const cont=pnum(c),d=cont-i.saldo;
    if(Math.abs(d)>1e-6)linhas.push({codigo:i.codigo,descricao:i.descricao,sistema:i.saldo,contado:cont,diferenca:Math.round(d*1e4)/1e4});}
  modal("Aplicar inventário",'<p>Serão lançados <b>'+INT(linhas.length)+' ajustes</b>, com impacto de <b>'+BRL(impacto)+'</b> no valor do estoque.</p>'
   +'<div class="tw" style="max-height:240px;overflow:auto"><table><thead><tr><th>Item</th><th class="num">Sistema</th><th class="num">Contado</th><th class="num">Dif.</th></tr></thead><tbody>'
   +linhas.map(l=>'<tr><td class="cod">'+esc(pnDe(l.codigo))+'</td><td class="num">'+NUM(l.sistema,2)+'</td><td class="num">'+NUM(l.contado,2)+'</td><td class="num">'+(l.diferenca>0?"+":"")+NUM(l.diferenca,2)+'</td></tr>').join("")+'</tbody></table></div>',
   '<button class="btn gh" id="a_x">Cancelar</button><button class="btn pri" id="a_ok">Aplicar ajustes</button>');
  $("#a_x").onclick=fecharModal;
  $("#a_ok").onclick=async()=>{
    const b=$("#a_ok");b.disabled=true;b.textContent="Aplicando…";
    try{
      await rpc("aplicar_inventario",{p_linhas:linhas.map(l=>({codigo:l.codigo,contado:l.contado})),
        p_local:IV.loc||null,p_categoria:IV.cat||null});
      IV.cont={};fecharModal();toast(linhas.length+" ajuste(s) aplicado(s).","s");await carregarTudo();
    }catch(e){b.disabled=false;b.textContent="Aplicar ajustes";toast(erroMsg(e),"e");}
  };
}

/* ---------------------------------------------------------- Relatórios */
const FR={de:"",ate:""};
function vRelatorios(el){
  const movs=S.movs.filter(m=>(!FR.de||m.data>=FR.de)&&(!FR.ate||m.data<=FR.ate));
  const sai=movs.filter(m=>m.tipo==="saida");
  const abc={};for(const m of sai)abc[m.codigo]=(abc[m.codigo]||0)+m.vlrTotal;
  const abcL=Object.entries(abc).sort((a,b)=>b[1]-a[1]);
  const totAbc=abcL.reduce((s,x)=>s+x[1],0)||1;
  let ac=0;const abcC=abcL.map(([c,v])=>{ac+=v;const p=ac/totAbc;return{c,v,cls:p<=.8?"A":p<=.95?"B":"C",part:v/totAbc};});
  const porCat={};for(const m of sai){const it=itemPor(m.codigo);const k=(it&&it.categoria)||"Sem categoria";porCat[k]=(porCat[k]||0)+m.vlrTotal;}
  const catL=Object.entries(porCat).sort((a,b)=>b[1]-a[1]),topCat=Math.max(1,...catL.map(x=>x[1]));
  const porOS={};for(const m of sai){if(!m.os)continue;porOS[m.os]=porOS[m.os]||{v:0,n:0,frota:m.frota};porOS[m.os].v+=m.vlrTotal;porOS[m.os].n++;}
  const osL=Object.entries(porOS).sort((a,b)=>b[1].v-a[1].v).slice(0,20);
  const porEq={};for(const m of sai){if(!m.frota)continue;porEq[m.frota]=porEq[m.frota]||{v:0,n:0};porEq[m.frota].v+=m.vlrTotal;porEq[m.frota].n++;}
  const eqL=Object.entries(porEq).sort((a,b)=>b[1].v-a[1].v);
  const rep=abaixoMin().map(i=>{const alvo=i.estoqueMax>0?i.estoqueMax:i.estoqueMin*2;const q=Math.max(0,alvo-i.saldo);return{i,q,v:q*i.custoMedio};}).sort((a,b)=>b.v-a.v);

  let h=head("Relatórios","Curva ABC, consumo por categoria, custo por equipamento e por ordem de serviço.",
    '<button class="btn" id="rExpAbc">ABC em CSV</button><button class="btn" id="rExpRep">Reposição em CSV</button>');
  h+='<div class="panel" style="margin-bottom:16px"><div class="pad grid g2"><label class="f">De<input id="r_de" type="date" value="'+esc(FR.de)+'"></label><label class="f">Até<input id="r_ate" type="date" value="'+esc(FR.ate)+'"></label><div class="fine" style="align-self:end">Sem datas, considera todo o histórico ('+INT(movs.length)+' lançamentos).</div></div></div>';
  h+='<div class="kpis">'+kpi("Consumo no período",BRL(sai.reduce((s,m)=>s+m.vlrTotal,0)),INT(sai.length)+" saídas")
   +kpi("Itens classe A",INT(abcC.filter(x=>x.cls==="A").length),"80% do valor consumido")
   +kpi("Equipamentos atendidos",INT(eqL.length),"com consumo vinculado")
   +kpi("Compra sugerida",BRL(rep.reduce((s,r)=>s+r.v,0)),INT(rep.length)+" itens no mínimo")+'</div>';
  h+='<div class="cols"><div class="grid" style="gap:16px">';
  h+='<div class="panel"><header><h3>Curva ABC do consumo</h3><div class="r">por valor de saída</div></header>'
   +(abcC.length?'<div class="tw"><table><thead><tr><th>Classe</th><th>Item</th><th class="num">Valor consumido</th><th class="num">% do total</th></tr></thead><tbody>'
     +abcC.slice(0,25).map(x=>{const it=itemPor(x.c);return '<tr><td><span class="tag '+(x.cls==="A"?"t-crit":x.cls==="B"?"t-warn":"t-neu")+'">'+x.cls+'</span></td><td><div class="cod">'+esc(pnDe(x.c))+'</div><div class="mut">'+esc(it?it.descricao:"")+'</div></td><td class="num">'+BRL(x.v)+'</td><td class="num">'+NUM(x.part*100,1)+'%</td></tr>';}).join("")
     +'</tbody></table></div>'+(abcC.length>25?'<div class="pad fine">Mostrando os 25 primeiros de '+abcC.length+'. Exporte o CSV para a lista completa.</div>':'')
   :'<div class="empty"><b>Sem saídas no período</b>A curva ABC usa o valor consumido nas requisições.</div>')+'</div>';
  h+='<div class="panel"><header><h3>Custo por ordem de serviço</h3><div class="r">20 maiores</div></header>'
   +(osL.length?'<div class="tw"><table><thead><tr><th>OS</th><th>Frota</th><th class="num">Itens</th><th class="num">Valor</th></tr></thead><tbody>'
     +osL.map(([k,v])=>'<tr><td class="cod">'+esc(k)+'</td><td class="mut">'+esc(v.frota||"—")+'</td><td class="num">'+INT(v.n)+'</td><td class="num">'+BRL(v.v)+'</td></tr>').join("")+'</tbody></table></div>'
   :'<div class="empty"><b>Sem OS vinculada</b>Informe a ordem de serviço nas saídas para apurar custo por serviço.</div>')+'</div>';
  h+='</div><div class="grid" style="gap:16px">';
  h+='<div class="panel"><header><h3>Consumo por categoria</h3></header><div class="pad">'
   +(catL.length?'<div class="bars">'+catL.map(([k,v])=>bar(k,BRL(v),v/topCat)).join("")+'</div>':'<div class="empty"><b>Sem dados</b>Nenhuma saída no período.</div>')+'</div></div>';
  h+='<div class="panel"><header><h3>Custo por equipamento</h3></header>'
   +(eqL.length?'<div class="tw"><table><thead><tr><th>Frota</th><th class="num">Itens</th><th class="num">Valor</th></tr></thead><tbody>'
     +eqL.map(([k,v])=>'<tr><td><div class="cod">'+esc(k)+'</div><div class="mut">'+esc(nomeFrota(k).replace(k+" · ",""))+'</div></td><td class="num">'+INT(v.n)+'</td><td class="num">'+BRL(v.v)+'</td></tr>').join("")+'</tbody></table></div>'
   :'<div class="empty"><b>Sem frota vinculada</b>Informe o prefixo nas saídas.</div>')+'</div>';
  h+='<div class="panel"><header><h3>Reposição sugerida</h3><div class="r">'+INT(rep.length)+'</div></header>'
   +(rep.length?'<div class="tw"><table><thead><tr><th>Item</th><th class="num">Comprar</th><th class="num">Estimado</th></tr></thead><tbody>'
     +rep.map(r=>'<tr class="low"><td><div class="cod">'+esc(pnDe(r.i))+'</div><div class="mut">'+esc(r.i.descricao)+'</div></td><td class="num">'+NUM(r.q,2)+' <span class="mut">'+esc(r.i.unidade)+'</span></td><td class="num">'+BRL(r.v)+'</td></tr>').join("")+'</tbody></table></div>'
   :'<div class="empty"><b>Nada a comprar</b>Nenhum item no ponto de reposição.</div>')+'</div>';
  h+='</div></div>';
  el.innerHTML=h;
  $("#r_de").onchange=e=>{FR.de=e.target.value;render();};
  $("#r_ate").onchange=e=>{FR.ate=e.target.value;render();};
  $("#rExpAbc").onclick=()=>baixar("curva-abc-"+hoje()+".csv",csv([["Classe","Part number","Descricao","Valor consumido","% do total"]]
    .concat(abcC.map(x=>{const it=itemPor(x.c);return [x.cls,pnDe(x.c),it?it.descricao:"",NUM(x.v,2),NUM(x.part*100,2)];}))));
  $("#rExpRep").onclick=()=>baixar("reposicao-"+hoje()+".csv",csv([["Part number","Descricao","Unidade","Saldo","Minimo","Comprar","Custo medio","Valor estimado","Fornecedor"]]
    .concat(rep.map(r=>[pnDe(r.i),r.i.descricao,r.i.unidade,NUM(r.i.saldo,2),NUM(r.i.estoqueMin,2),NUM(r.q,2),NUM(r.i.custoMedio,2),NUM(r.v,2),r.i.fornecedor]))));
}

/* ------------------------------------------------------------- Ajustes */
function vAjustes(el){
  const c=cfg();
  let h=head("Ajustes","Identificação da obra, usuários do sistema e as listas usadas nos cadastros.")+soLeitura();
  h+='<div class="split">';
  h+='<div class="panel"><header><h3>Identificação</h3></header><div class="pad grid">'
   +'<label class="f">Empresa<input id="c_emp" value="'+esc(c.empresa)+'"'+(podeLancar()?"":" disabled")+'></label>'
   +'<label class="f">Obra / unidade<input id="c_obr" value="'+esc(c.obra)+'"'+(podeLancar()?"":" disabled")+'></label>'
   +(podeLancar()?'<div style="display:flex;justify-content:flex-end"><button class="btn pri" id="c_ok">Salvar identificação</button></div>':'')+'</div></div>';
  h+='<div class="panel"><header><h3>Usuários</h3><div class="r">'+INT(S.perfis.length)+'</div></header>'
   +(ehAdmin()?'<div class="pad" style="padding-bottom:0;display:flex;justify-content:flex-end"><button class="btn pri" id="u_novo">Novo usuário</button></div>':'')
   +'<div class="tw"><table><thead><tr><th>Nome</th><th>Perfil</th><th>Situação</th>'+(ehAdmin()?'<th></th>':'')+'</tr></thead><tbody>'
   +S.perfis.map(u=>'<tr><td>'+esc(u.nome)+(u.id===(S.user&&S.user.id)?' <span class="tag t-pri">você</span>':'')
     +(S.emails[u.id]?'<div class="mut">'+esc(S.emails[u.id])+'</div>':'')+'</td>'
     +'<td>'+(ehAdmin()?'<select data-pu="'+u.id+'">'+Object.entries(PAPEIS).map(([k,v])=>'<option value="'+k+'"'+(u.papel===k?" selected":"")+'>'+v+'</option>').join("")+'</select>':esc(PAPEIS[u.papel]||u.papel))+'</td>'
     +'<td>'+(ehAdmin()?'<select data-au="'+u.id+'"><option value="1"'+(u.ativo?" selected":"")+'>Ativo</option><option value="0"'+(!u.ativo?" selected":"")+'>Bloqueado</option></select>':(u.ativo?'<span class="tag t-ok">ativo</span>':'<span class="tag t-crit">bloqueado</span>'))+'</td>'
     +(ehAdmin()?'<td><button class="btn sm" data-sn="'+u.id+'" data-nm="'+esc(u.nome)+'">Senha</button></td>':'')
     +'</tr>').join("")
   +'</tbody></table></div>'
   +'<div class="pad fine">'+(ehAdmin()
     ?'O usuário nasce já ativo e entra direto com o e-mail e a senha que você definir. Quem sai da equipe você marca como <b>Bloqueado</b> — não apague, senão o histórico perde o nome de quem lançou.'
     :'Só o administrador cria e libera usuários.')+'</div></div>';
  h+=listaCfg("Categorias","categorias",c.categorias)+listaCfg("Unidades","unidades",c.unidades)
    +listaCfg("Localizações","locais",c.locais)+listaCfg("Tipos de equipamento","tiposFrota",c.tiposFrota);
  if(ehAdmin()){
    const c2=cfg(),n=abaixoMin().length;
    h+='<div class="panel"><header><h3>Aviso de estoque mínimo</h3>'
     +'<div class="r">'+(c2.alertaAtivo?'<span class="tag t-ok">ligado</span>':'<span class="tag t-neu">desligado</span>')+'</div></header><div class="pad grid">'
     +'<div class="fine">Resumo por e-mail, uma vez por dia, com tudo que está no mínimo ou abaixo. Hoje seriam <b>'+INT(n)+' item(ns)</b>. Em dia sem nenhum item no mínimo, nada é enviado.</div>'
     +'<label class="f">Quem recebe <span class="mut">(um e-mail por linha)</span>'
     +'<textarea id="al_em" style="min-height:84px;font-family:var(--mono);font-size:12.5px" placeholder="compras@renea.com.br">'+esc((c2.alertaEmails||[]).join("\n"))+'</textarea></label>'
     +'<div class="grid g2"><label class="f">Situação<select id="al_at">'
     +'<option value="1"'+(c2.alertaAtivo?" selected":"")+'>Ligado — envia todo dia</option>'
     +'<option value="0"'+(!c2.alertaAtivo?" selected":"")+'>Desligado</option></select></label>'
     +'<div style="display:flex;align-items:flex-end;gap:8px"><button class="btn pri" id="al_ok">Salvar</button>'
     +'<button class="btn" id="al_teste">Enviar agora</button></div></div>'
     +'<div class="fine" id="al_msg"></div>'
     +'</div></div>';
  }
  h+='<div class="panel"><header><h3>Dados e manutenção</h3></header><div class="pad grid">'
   +'<button class="btn" id="c_bkp">Baixar backup completo (JSON)</button>'
   +(podeLancar()?'<button class="btn" id="c_conf">Conferir saldos com o histórico</button>':'')
   +(ehAdmin()?'<button class="btn dg" id="c_ex">Apagar dados de exemplo</button>':'')
   +'<div class="fine">A conferência recalcula o saldo de cada item a partir das movimentações e mostra as divergências antes de corrigir.</div></div></div>';
  h+='</div>';
  el.innerHTML=h;
  if($("#c_ok"))$("#c_ok").onclick=async()=>{try{await salvarCfg({empresa:$("#c_emp").value.trim(),obra:$("#c_obr").value.trim()});toast("Identificação salva.","s");}catch(e){toast(erroMsg(e),"e");}};
  $$("[data-pu]",el).forEach(s=>s.onchange=async()=>{try{const {error}=await SB.from("perfis").update({papel:s.value}).eq("id",s.dataset.pu);if(error)throw error;toast("Perfil atualizado.","s");await carregarTudo();}catch(e){toast(erroMsg(e),"e");}});
  $$("[data-au]",el).forEach(s=>s.onchange=async()=>{try{const {error}=await SB.from("perfis").update({ativo:s.value==="1"}).eq("id",s.dataset.au);if(error)throw error;toast("Situação atualizada.","s");await carregarTudo();}catch(e){toast(erroMsg(e),"e");}});
  if($("#u_novo"))$("#u_novo").onclick=dlgNovoUsuario;
  $$("[data-sn]",el).forEach(b=>b.onclick=()=>dlgSenha(b.dataset.sn,b.dataset.nm));
  if(ehAdmin()&&!S.emailsOk)carregarEmails();
  $$("[data-lk]",el).forEach(box=>{
    const k=box.dataset.lk;
    const add=$("#add_"+k,box);
    if(add)add.onclick=async()=>{const inp=$("#in_"+k,box),v=inp.value.trim();if(!v)return;
      const arr=(cfg()[k]||[]).slice();if(!arr.includes(v))arr.push(v);
      try{await salvarCfg({[k]:arr});toast("Lista atualizada.","s");}catch(e){toast(erroMsg(e),"e");}};
    $$("[data-dl]",box).forEach(b=>b.onclick=async()=>{try{await salvarCfg({[k]:(cfg()[k]||[]).filter(x=>x!==b.dataset.dl)});}catch(e){toast(erroMsg(e),"e");}});
  });
  if($("#al_ok"))$("#al_ok").onclick=async()=>{
    const lista=$("#al_em").value.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
    const ruim=lista.filter(x=>!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
    if(ruim.length){toast("E-mail inválido: "+ruim[0],"e");return;}
    const lig=$("#al_at").value==="1";
    if(lig&&!lista.length){toast("Informe pelo menos um e-mail para ligar o aviso.","e");return;}
    try{await salvarCfg({alertaEmails:lista,alertaAtivo:lig});toast("Aviso salvo.","s");}
    catch(e){toast(erroMsg(e),"e");}
  };
  if($("#al_teste"))$("#al_teste").onclick=async()=>{
    const b=$("#al_teste");b.disabled=true;b.textContent="Enviando…";
    $("#al_msg").textContent="";
    try{
      const d=await fnEdge("alerta-estoque",{teste:true});
      $("#al_msg").textContent=d.enviado
        ? "Enviado para "+(d.destinatarios||[]).join(", ")+" · "+INT(d.itens)+" item(ns)."
        : (d.mensagem||"Nada a enviar.");
      toast("Aviso disparado.","s");
    }catch(e){$("#al_msg").textContent=erroMsg(e);toast(erroMsg(e),"e");}
    b.disabled=false;b.textContent="Enviar agora";
  };
  $("#c_bkp").onclick=()=>baixar("almoxarifado-backup-"+hoje()+".json",JSON.stringify({geradoEm:new Date().toISOString(),
    config:cfg(),itens:S.itens,frota:S.frota,fornecedores:S.forn,ferramentas:S.ferr,emprestimos:S.emps,
    movimentos:S.movs,inventarios:S.invs},null,1));
  if($("#c_conf"))$("#c_conf").onclick=conferirSaldos;
  if($("#c_ex"))$("#c_ex").onclick=apagarExemplos;
}
/* ------------------------------------------------------------- Manual */
/* O texto mora em assets/manual.js. Aqui só se desenha a tela.
   O conteúdo vem do nosso próprio arquivo, por isso vai sem escape:
   é o que permite negrito e listas dentro dos parágrafos. */
const MN={q:""};
const ESTILO_MN='<style>'
 +'.mn-b{margin:0 0 14px}.mn-b:last-child{margin-bottom:0}'
 +'.mn-b h4{margin:0 0 5px;font-size:13.5px;font-weight:600;color:var(--ink)}'
 +'.mn-b p{margin:0 0 7px;line-height:1.55}'
 +'.mn-b ul{margin:4px 0 8px;padding-left:20px;line-height:1.55}'
 +'.mn-b li{margin-bottom:4px}'
 +'.mn-b .note{margin:8px 0 0}'
 +'.mn-h{font-family:var(--cond,inherit);letter-spacing:.01em}'
 +'@media print{.rail,.topbar,.acts,#toasts,#modal,.mn-nop{display:none!important}'
 +'.wrap{padding:0!important}.panel{break-inside:avoid;box-shadow:none}}'
 +'</style>';
function manualDoc(){return window.MANUAL||{atualizado:"",secoes:[],mudancas:[]};}
function mnTexto(b){return [b.h,(b.p||[]).join(" "),(b.li||[]).join(" "),b.nota||""]
  .join(" ").replace(/<[^>]+>/g," ").toLowerCase();}
function mnBloco(b){
  let h='<div class="mn-b">';
  if(b.h)h+='<h4>'+b.h+'</h4>';
  if(b.p)h+=b.p.map(x=>'<p>'+x+'</p>').join("");
  if(b.li)h+='<ul>'+b.li.map(x=>'<li>'+x+'</li>').join("")+'</ul>';
  if(b.nota)h+='<div class="note">'+b.nota+'</div>';
  return h+'</div>';
}
function vManual(el){
  const M=manualDoc(),q=MN.q.trim().toLowerCase();
  const achadas=M.secoes.map(sec=>{
    if(!q)return {sec,blocos:sec.b};
    const noTitulo=(sec.t+" "+(sec.r||"")).toLowerCase().includes(q);
    const bl=sec.b.filter(b=>mnTexto(b).includes(q));
    if(!noTitulo&&!bl.length)return null;
    return {sec,blocos:bl.length?bl:sec.b};
  }).filter(Boolean);

  let h=ESTILO_MN+head("Manual do sistema",
    "Como usar cada parte do almoxarifado. Atualizado a cada mudança no sistema.",
    '<button class="btn" id="mn_pr">Imprimir / salvar em PDF</button>');
  h+='<div class="panel mn-nop" style="margin-bottom:16px"><div class="pad grid">'
   +'<label class="f">Procurar no manual<input id="mn_q" value="'+esc(MN.q)+'" placeholder="custo médio, inventário, part number, e-mail…" autocomplete="off"></label>'
   +'<div class="fine">Última atualização em <b>'+dbr(M.atualizado)+'</b>'
   +(q?' · '+INT(achadas.length)+' seção(ões) com “'+esc(MN.q)+'”':' · '+INT(M.secoes.length)+' seções')+'</div>'
   +'</div></div>';

  if(!q){
    h+='<div class="pillrow mn-nop" style="margin-bottom:16px">'
     +M.secoes.map(sec=>'<button class="pill" data-mns="'+esc(sec.id)+'"><span class="ic" aria-hidden="true">'+sec.ic+'</span> '+esc(sec.t)+'</button>').join("")
     +'</div>';
  }

  if(!achadas.length){
    h+='<div class="panel"><div class="empty"><b>Nada encontrado</b>Nenhuma seção do manual fala em “'+esc(MN.q)+'”. Tente outra palavra.</div></div>';
  }
  for(const a of achadas){
    h+='<div class="panel" id="mn-'+esc(a.sec.id)+'" style="margin-bottom:16px">'
     +'<header><h3 class="mn-h">'+esc(a.sec.ic)+' '+esc(a.sec.t)+'</h3>'
     +(a.sec.r?'<div class="r">'+esc(a.sec.r)+'</div>':'')+'</header>'
     +'<div class="pad">'+a.blocos.map(mnBloco).join("")+'</div></div>';
  }

  if(!q&&(M.mudancas||[]).length){
    h+='<div class="panel" id="mn-mudancas"><header><h3 class="mn-h">↻ O que mudou no sistema</h3>'
     +'<div class="r">'+INT(M.mudancas.length)+' alterações</div></header><div class="pad">'
     +M.mudancas.map(m=>'<div class="mn-b"><h4>'+esc(m.t)+' <span class="mut" style="font-weight:400">· '+dbr(m.d)+'</span></h4><p>'+m.p+'</p></div>').join("")
     +'</div></div>';
  }

  el.innerHTML=h;
  const inp=$("#mn_q");
  inp.oninput=()=>{MN.q=inp.value;render();const x=$("#mn_q");x.focus();x.setSelectionRange(x.value.length,x.value.length);};
  $("#mn_pr").onclick=()=>window.print();
  $$("[data-mns]",el).forEach(b=>b.onclick=()=>{
    const alvo=$("#mn-"+b.dataset.mns);
    if(alvo)alvo.scrollIntoView({behavior:"smooth",block:"start"});
  });
}

/* ------------------------------------------ usuários (só admin) */
/* Fala com a Edge Function "usuarios", que roda no servidor do Supabase.
   A chave de administrador fica lá, nunca aqui no navegador. */
async function fnEdge(nome,body){
  const {data,error}=await SB.functions.invoke(nome,{body:body});
  if(error){
    let msg="";
    try{msg=(await error.context.json()).erro||"";}catch(x){}
    throw new Error(msg||error.message||"Não foi possível falar com o servidor.");
  }
  if(data&&data.erro)throw new Error(data.erro);
  return data||{};
}
async function fnUsuarios(body){
  const {data,error}=await SB.functions.invoke("usuarios",{body:body});
  if(error){
    let msg="";
    try{msg=(await error.context.json()).erro||"";}catch(x){}
    throw new Error(msg||error.message||"Não foi possível falar com o servidor.");
  }
  if(data&&data.erro)throw new Error(data.erro);
  return data||{};
}
async function carregarEmails(){
  S.emailsOk=true;
  try{
    const d=await fnUsuarios({acao:"listar"});
    const m={};(d.usuarios||[]).forEach(u=>{if(u.email)m[u.id]=u.email;});
    S.emails=m;
    if(S.view==="ajustes")render();
  }catch(e){}
}
function senhaSugerida(){
  const a="abcdefghijkmnopqrstuvwxyz",n="23456789",p=x=>x[Math.floor(Math.random()*x.length)];
  return p(a).toUpperCase()+p(a)+p(a)+p(a)+p(a)+"-"+p(n)+p(n)+p(n)+p(n);
}
function dlgNovoUsuario(){
  modal("Novo usuário",'<div class="grid">'
   +'<label class="f">Nome<input id="u_nome" placeholder="Nome de quem vai usar o sistema" autocomplete="off"></label>'
   +'<label class="f">E-mail<input id="u_mail" type="email" placeholder="pessoa@renea.com.br" autocomplete="off"></label>'
   +'<label class="f">Senha provisória<input id="u_pw" type="text" value="'+senhaSugerida()+'" autocomplete="off"></label>'
   +'<label class="f">Perfil<select id="u_papel">'+Object.entries(PAPEIS).map(([k,v])=>'<option value="'+k+'"'+(k==="mecanico"?" selected":"")+'>'+v+'</option>').join("")+'</select></label>'
   +'<div class="fine">Anote a senha e entregue para a pessoa: ela não é enviada por e-mail. Depois de entrar, a pessoa troca em <b>Minha conta</b>.</div>'
   +'</div>','<button class="btn gh" id="u_x">Cancelar</button><button class="btn pri" id="u_ok">Criar usuário</button>');
  $("#u_x").onclick=fecharModal;
  $("#u_ok").onclick=async()=>{
    const b=$("#u_ok");b.disabled=true;b.textContent="Criando…";
    try{
      await fnUsuarios({acao:"criar",nome:$("#u_nome").value.trim(),email:$("#u_mail").value.trim(),
        senha:$("#u_pw").value,papel:$("#u_papel").value});
      fecharModal();toast("Usuário criado.","s");
      S.emailsOk=false;await carregarTudo();carregarEmails();
    }catch(e){b.disabled=false;b.textContent="Criar usuário";toast(erroMsg(e),"e");}
  };
}
function dlgSenha(id,nome){
  modal("Redefinir senha",'<p>Nova senha de <b>'+esc(nome)+'</b>. Anote e entregue para a pessoa.</p>'
   +'<label class="f">Senha<input id="s_pw" type="text" value="'+senhaSugerida()+'" autocomplete="off"></label>',
   '<button class="btn gh" id="s_x">Cancelar</button><button class="btn pri" id="s_ok">Redefinir</button>');
  $("#s_x").onclick=fecharModal;
  $("#s_ok").onclick=async()=>{
    const b=$("#s_ok");b.disabled=true;b.textContent="Salvando…";
    try{await fnUsuarios({acao:"senha",id:id,senha:$("#s_pw").value});fecharModal();toast("Senha redefinida.","s");}
    catch(e){b.disabled=false;b.textContent="Redefinir";toast(erroMsg(e),"e");}
  };
}
function listaCfg(titulo,k,arr){
  return '<div class="panel" data-lk="'+k+'"><header><h3>'+esc(titulo)+'</h3><div class="r">'+INT((arr||[]).length)+'</div></header><div class="pad grid">'
   +'<div class="chiplist">'+(arr||[]).map(x=>'<span class="chip">'+esc(x)+(podeLancar()?'<button data-dl="'+esc(x)+'" aria-label="Remover '+esc(x)+'">&times;</button>':'')+'</span>').join("")+'</div>'
   +(podeLancar()?'<div style="display:flex;gap:8px"><input id="in_'+k+'" placeholder="Adicionar"><button class="btn" id="add_'+k+'">Adicionar</button></div>':'')+'</div></div>';
}
function conferirSaldos(){
  const movs=S.movs.slice().sort((a,b)=>String(a.data).localeCompare(String(b.data))||a.id-b.id);
  const calc={};
  for(const m of movs){
    const c=m.codigo;if(!(c in calc))calc[c]={s:0,cm:0};
    const st=calc[c],q=m.qtd;
    if(m.tipo==="entrada"){const ns=st.s+q;st.cm=ns>0?((st.s*st.cm)+(q*m.vlrUnit))/ns:m.vlrUnit;st.s=ns;}
    else if(m.tipo==="devolucao")st.s+=q;
    else if(m.tipo==="saida")st.s-=q;
    else{st.s=q;if(m.tipo==="inicial"&&m.vlrUnit)st.cm=m.vlrUnit;}
  }
  const div=S.itens.filter(i=>Math.abs((calc[i.codigo]?calc[i.codigo].s:0)-i.saldo)>1e-4)
    .map(i=>({i,esp:calc[i.codigo]?Math.round(calc[i.codigo].s*1e4)/1e4:0}));
  modal("Conferência de saldos",div.length?'<p><b>'+INT(div.length)+'</b> item(ns) com saldo diferente do apurado no histórico:</p>'
   +'<div class="tw" style="max-height:280px;overflow:auto"><table><thead><tr><th>Item</th><th class="num">No sistema</th><th class="num">Pelo histórico</th><th class="num">Dif.</th></tr></thead><tbody>'
   +div.map(d=>'<tr><td class="cod">'+esc(pnDe(d.i))+'<div class="mut">'+esc(d.i.descricao)+'</div></td><td class="num">'+NUM(d.i.saldo,2)+'</td><td class="num">'+NUM(d.esp,2)+'</td><td class="num">'+NUM(d.esp-d.i.saldo,2)+'</td></tr>').join("")+'</tbody></table></div>'
   +'<div class="fine" style="margin-top:10px">A conferência usa os '+INT(S.movs.length)+' lançamentos carregados. Itens importados com saldo direto, sem histórico, aparecem aqui — é esperado.</div>'
   :'<p>Todos os saldos conferem com o histórico carregado.</p>',
   '<button class="btn gh" id="k_x">Fechar</button>'+(div.length?'<button class="btn pri" id="k_ok">Recalcular pelo histórico</button>':''));
  $("#k_x").onclick=fecharModal;
  if(div.length)$("#k_ok").onclick=async()=>{
    const b=$("#k_ok");b.disabled=true;b.textContent="Recalculando…";
    try{for(const d of div)await rpc("recalcular_item",{p_codigo:d.i.codigo});
      fecharModal();toast("Saldos recalculados.","s");await carregarTudo();}catch(e){toast(erroMsg(e),"e");}
  };
}
function apagarExemplos(){
  modal("Apagar dados de exemplo",'<p>Serão removidos todos os itens, ferramentas, equipamentos, fornecedores e lançamentos marcados como exemplo. Os cadastros que você criou não são afetados.</p>',
   '<button class="btn gh" id="e_x">Fechar</button><button class="btn dg" id="e_ok">Apagar exemplos</button>');
  $("#e_x").onclick=fecharModal;
  $("#e_ok").onclick=async()=>{
    const b=$("#e_ok");b.disabled=true;b.textContent="Apagando…";
    try{const r=await rpc("apagar_exemplos",{});fecharModal();toast(r||"Exemplos removidos.","s");await carregarTudo();}
    catch(e){b.disabled=false;b.textContent="Apagar exemplos";toast(erroMsg(e),"e");}
  };
}

/* ------------------------------------------------------- CSV / arquivos */
function csv(rows){return rows.map(r=>r.map(c=>{const s=String(c==null?"":c);return /[";\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}).join(";")).join("\r\n");}
/* Mesma ordem de colunas que o importador espera, para a planilha voltar inteira. */
function csvItens(l){return csv([["Part number","Descricao","Categoria","Unidade","Local","Minimo","Maximo","Saldo","Custo medio","Valor em estoque","Aplicacao","Fornecedor","Situacao","Codigo interno"]]
  .concat(l.map(i=>[pnDe(i),i.descricao,i.categoria,i.unidade,i.local,NUM(i.estoqueMin,2),NUM(i.estoqueMax,2),NUM(i.saldo,2),NUM(i.custoMedio,2),NUM(i.saldo*i.custoMedio,2),i.aplicacao,i.fornecedor,i.ativo?"Ativo":"Inativo",i.codigo])));}
function csvMovs(l){return csv([["Data","Tipo","Part number","Descricao","Unidade","Quantidade","Valor unitario","Valor total","Saldo posterior","OS","Frota","Solicitante","Fornecedor","NF","Observacao","Operador"]]
  .concat(l.map(m=>[dbr(m.data),TIPOS[m.tipo]||m.tipo,pnDe(m.codigo),m.descricao,m.un,NUM(m.qtd,2),NUM(m.vlrUnit,2),NUM(m.vlrTotal,2),m.saldoPosterior!=null?NUM(m.saldoPosterior,2):"",m.os,m.frota,m.solicitante,m.fornecedor,m.nf,m.obs,m.usuario])));}
function csvEmp(l){return csv([["Codigo","Ferramenta","Quantidade","Retirada em","Retirada por","Devolver ate","OS","Frota","Situacao","Devolvida em","Recebida por","Motivo da baixa","Entregue por","Observacao"]]
  .concat(l.map(e=>[e.codigo,e.descricao,NUM(e.qtd,0),dbr(e.retiradoEm),e.retiradoPor,e.previsao?dbr(e.previsao):"",e.os,e.frota,
    e.situacao==="aberto"?"Em aberto":(e.situacao==="devolvido"?"Devolvida":"Baixada"),e.devolvidoEm?dbr(e.devolvidoEm):"",e.recebidoPor,e.motivo,e.usuario,[e.obs,e.obsDevolucao].filter(Boolean).join(" | ")])));}
function csvInv(l){return csv([["Part number","Descricao","Local","Unidade","Saldo sistema","Contado"]].concat(l.map(i=>[pnDe(i),i.descricao,i.local,i.unidade,NUM(i.saldo,2),""])));}
function baixar(nome,texto){
  const tipo=nome.endsWith(".json")?"application/json":"text/csv";
  const blob=new Blob(["﻿"+texto],{type:tipo+";charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=nome;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
}
function importarItens(){
  modal("Importar itens por CSV",'<p class="fine">Uma linha por item, separada por <b>;</b> ou <b>,</b>. A primeira linha pode ser o cabeçalho. Ordem das colunas:</p>'
   +'<div class="note" style="font-family:var(--mono);font-size:12px">part number ; descricao ; categoria ; unidade ; local ; minimo ; maximo ; saldo ; custo unitario</div>'
   +'<p class="fine">Item sem part number: deixe a primeira coluna vazia que o sistema gera um código interno.</p>'
   +'<textarea id="ip" style="min-height:200px;font-family:var(--mono);font-size:12px" placeholder="LF3000;Filtro de óleo Axor 2831;Filtros;PC;Estante A;4;12;6;78,50"></textarea>'
   +'<div class="fine" id="ipmsg" style="margin-top:8px"></div>',
   '<button class="btn gh" id="ip_x">Cancelar</button><button class="btn pri" id="ip_ok">Importar</button>');
  $("#ip_x").onclick=fecharModal;
  $("#ip_ok").onclick=async()=>{
    const linhas=$("#ip").value.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    if(!linhas.length){toast("Cole as linhas do CSV.","e");return;}
    const sep=linhas[0].includes(";")?";":",";
    let ok=0,pulou=0;const criados=[];const b=$("#ip_ok");b.disabled=true;b.textContent="Importando…";
    for(let n=0;n<linhas.length;n++){
      const col=linhas[n].split(sep).map(s=>s.trim().replace(/^"|"$/g,""));
      const c0=(col[0]||"").toUpperCase();
      if(/^(part ?number|c[óo]digo)$/i.test(c0)||!col[1]){pulou++;continue;}
      /* A 1a coluna e o part number. Planilha antiga com codigo ali:
         o codigo vira o part number e pode ser corrigido depois no cadastro. */
      const pn=c0;
      if(pn&&(S.itens.some(x=>(x.partNumber||"").toUpperCase()===pn)||criados.includes(pn))){pulou++;continue;}
      const cod=(c0&&!S.itens.some(x=>x.codigo===c0)&&!criados.includes(c0))?c0:proximoCodigo(criados);
      criados.push(cod);if(pn&&pn!==cod)criados.push(pn);
      try{
        const {error}=await SB.from("itens").insert({codigo:cod,descricao:col[1],categoria:col[2]||null,
          unidade:(col[3]||"UN").toUpperCase(),local:col[4]||null,estoque_min:pnum(col[5]),estoque_max:pnum(col[6]),
          part_number:pn||null});
        if(error)throw error;
        const s0=pnum(col[7]);
        if(s0!==0)await gravarMov({codigo:cod,tipo:"inicial",qtd:s0,vlrUnit:pnum(col[8]),data:hoje(),obs:"Importação CSV"});
        ok++;
      }catch(e){$("#ipmsg").textContent="Erro na linha "+(n+1)+": "+erroMsg(e);}
      if(n%10===0)$("#ipmsg").textContent=ok+" importados…";
    }
    fecharModal();toast(ok+" item(ns) importado(s)"+(pulou?", "+pulou+" linha(s) ignorada(s)":"")+".","s");
    await carregarTudo();
  };
}

/* ------------------------------------------------- leitor de código de barras */
let leitorStream=null,leitorLoop=null;
function pararLeitor(){
  if(leitorLoop){cancelAnimationFrame(leitorLoop);leitorLoop=null;}
  if(leitorStream){leitorStream.getTracks().forEach(t=>t.stop());leitorStream=null;}
}
async function lerCodigo(cb){
  if(!("BarcodeDetector" in window)){
    toast("Este navegador não lê código de barras. Use o Chrome no Android ou digite o código.","e");return;
  }
  modal("Ler código","<video id=\"leitor\" playsinline muted autoplay></video><div class=\"fine\" style=\"margin-top:8px\">Aponte a câmera para a etiqueta da prateleira ou da peça.</div>",
    '<button class="btn gh" id="lc_x">Cancelar</button>');
  $("#lc_x").onclick=fecharModal;
  try{
    const det=new window.BarcodeDetector({formats:["qr_code","code_128","code_39","ean_13","ean_8","itf"]});
    leitorStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
    const v=$("#leitor");v.srcObject=leitorStream;await v.play();
    const passo=async()=>{
      if(!leitorStream)return;
      try{
        const cods=await det.detect(v);
        if(cods&&cods.length){const val=String(cods[0].rawValue||"").trim();
          if(val){fecharModal();cb(val);toast("Código lido: "+val,"s");return;}}
      }catch(e){}
      leitorLoop=requestAnimationFrame(passo);
    };
    passo();
  }catch(e){fecharModal();toast("Não foi possível abrir a câmera: "+erroMsg(e),"e");}
}

/* ---------------------------------------------------------------- boot */
async function carregarPerfil(){
  const {data,error}=await SB.from("perfis").select("*").eq("id",S.user.id).maybeSingle();
  if(error)throw error;
  S.perfil=data;
}
async function iniciar(){
  const {data:{session}}=await SB.auth.getSession();
  if(!session){telaLogin();return;}
  S.user=session.user;
  try{
    await carregarPerfil();
  }catch(e){telaLogin(erroMsg(e));return;}
  if(!S.perfil){telaLogin("Seu usuário existe, mas ainda não tem perfil no almoxarifado. Peça ao administrador.");return;}
  if(!S.perfil.ativo){await SB.auth.signOut();telaLogin("Seu acesso está bloqueado. Procure o administrador.");return;}
  montarShell();render();
  await carregarTudo();
  ligarRealtime();
}
if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
iniciar();
