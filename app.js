/* Work on Pan — código partilhado por todas as páginas.
 * Carregar depois do Firebase e do firebase-config.js. */

const auth = firebase.auth();
const db = firebase.firestore();
const agora = () => firebase.firestore.FieldValue.serverTimestamp();

// Preencher antes de publicar o site (aparecem na política de privacidade e no rodapé).
const RESPONSAVEL_DADOS = "[Nome do responsável pelo Work on Pan]";
const CONTACTO_PRIVACIDADE = "[email-de-contacto@dominio.pt]";

const CATEGORIAS = {
  design: "Design e UI/UX",
  dev: "Desenvolvimento web e apps",
  marketing: "Marketing digital",
  redacao: "Redação e conteúdo",
  video: "Vídeo e animação",
  dados: "Dados e análise",
  outro: "Outro",
};

const MOEDAS = { EUR: "Euro (€)", BRL: "Real (R$)", USD: "Dólar (US$)", GBP: "Libra (£)" };

const ESTADOS_PROJETO = {
  aberto: { texto: "A receber propostas", classe: "etiqueta-ok" },
  em_andamento: { texto: "Em andamento", classe: "etiqueta-aviso" },
  concluido: { texto: "Concluído", classe: "etiqueta-neutra" },
  fechado: { texto: "Fechado", classe: "etiqueta-neutra" },
};

const ESTADOS_PROPOSTA = {
  pendente: { texto: "À espera de resposta", classe: "etiqueta-aviso" },
  aceite: { texto: "Aceite", classe: "etiqueta-ok" },
  recusada: { texto: "Recusada", classe: "etiqueta-perigo" },
  retirada: { texto: "Retirada por ti", classe: "etiqueta-neutra" },
  fechada: { texto: "Projeto fechado", classe: "etiqueta-neutra" },
};

/* ── Utilitários ─────────────────────────────────────────────── */

// Tudo o que vem do utilizador passa por aqui antes de ir para innerHTML.
function esc(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function $(id) {
  return document.getElementById(id);
}

function dinheiro(valor, moeda = "EUR") {
  if (valor === undefined || valor === null || valor === "") return "A combinar";
  try {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: moeda,
      maximumFractionDigits: 0,
    }).format(valor);
  } catch {
    return `${valor} ${moeda}`;
  }
}

function nomeCategoria(chave) {
  return CATEGORIAS[chave] || chave || "Outro";
}

function etiqueta(mapa, estado) {
  const e = mapa[estado] || { texto: estado, classe: "etiqueta-neutra" };
  return `<span class="etiqueta ${e.classe}">${esc(e.texto)}</span>`;
}

function paraData(ts) {
  if (!ts) return null;
  return typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
}

function dataCurta(ts) {
  const d = paraData(ts);
  if (!d) return "agora mesmo";
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return d.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
}

function horaCurta(ts) {
  const d = paraData(ts);
  if (!d) return "";
  const hoje = new Date().toDateString() === d.toDateString();
  return hoje
    ? d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
}

function iniciais(nome) {
  return (nome || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function nomeCompleto(p) {
  return [p?.nome, p?.sobrenome].filter(Boolean).join(" ") || "Utilizador";
}

function ordenarPorData(lista, campo = "createdAt") {
  return lista.sort((a, b) => (paraData(b[campo])?.getTime() || Date.now()) - (paraData(a[campo])?.getTime() || Date.now()));
}

// Mensagem curta no canto do ecrã. tipo: "ok" | "erro"
function avisar(texto, tipo = "ok") {
  let caixa = $("avisoFlutuante");
  if (!caixa) {
    caixa = document.createElement("div");
    caixa.id = "avisoFlutuante";
    caixa.setAttribute("role", "status");
    document.body.appendChild(caixa);
  }
  caixa.textContent = texto;
  caixa.className = "aviso-flutuante visivel " + (tipo === "erro" ? "erro" : "");
  clearTimeout(caixa._t);
  caixa._t = setTimeout(() => caixa.classList.remove("visivel"), 4000);
}

function traduzirErro(e) {
  const code = e?.code || "";
  const mapa = {
    "auth/invalid-email": "Esse e-mail não parece válido.",
    "auth/user-disabled": "Esta conta foi desativada.",
    "auth/user-not-found": "E-mail ou palavra-passe incorretos.",
    "auth/wrong-password": "E-mail ou palavra-passe incorretos.",
    "auth/invalid-credential": "E-mail ou palavra-passe incorretos.",
    "auth/email-already-in-use": "Já existe uma conta com este e-mail. Experimenta entrar.",
    "auth/weak-password": "A palavra-passe tem de ter pelo menos 8 caracteres.",
    "auth/too-many-requests": "Muitas tentativas seguidas. Espera um pouco e tenta de novo.",
    "auth/network-request-failed": "Sem ligação à internet. Verifica a rede.",
    "auth/requires-recent-login": "Por segurança, sai e volta a entrar antes de fazer isto.",
    "permission-denied": "Não tens permissão para esta ação.",
    unavailable: "O servidor não respondeu. Tenta daqui a pouco.",
  };
  return mapa[code] || mapa[code.replace("firestore/", "")] || "Algo correu mal. Tenta outra vez.";
}

/* ── Tema ────────────────────────────────────────────────────── */

function temaGuardado() {
  try {
    return localStorage.getItem("wop_tema") || "sistema";
  } catch {
    return "sistema";
  }
}

function aplicarTema(tema) {
  try {
    if (tema) localStorage.setItem("wop_tema", tema);
  } catch {}
  const t = tema || temaGuardado();
  if (t === "claro") document.documentElement.dataset.theme = "light";
  else if (t === "escuro") document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
}

/* ── Sessão e perfil ─────────────────────────────────────────── */

let wopUser = null;   // utilizador do Firebase Auth
let wopConta = null;  // documento privado users/{uid}
let wopPerfil = null; // documento público perfis/{uid}

function carregarConta(user) {
  const refConta = db.collection("users").doc(user.uid);
  const refPerfil = db.collection("perfis").doc(user.uid);
  return Promise.all([refConta.get(), refPerfil.get()]).then(([c, p]) => {
    if (!c.exists) return null;
    const conta = { id: user.uid, ...c.data() };
    if (p.exists) return { conta, perfil: { id: user.uid, ...p.data() } };
    // Contas antigas não têm perfil público: cria-se a partir da conta.
    const perfil = perfilPublicoDe(conta);
    return refPerfil.set(perfil).then(() => ({ conta, perfil: { id: user.uid, ...perfil } }));
  });
}

function perfilPublicoDe(conta) {
  const base = {
    nome: conta.nome || "",
    sobrenome: conta.sobrenome || "",
    tipo: conta.tipo,
    atualizadoEm: agora(),
  };
  if (conta.tipo === "freelancer") {
    return {
      ...base,
      area: conta.area || "",
      bio: conta.bio || "",
      valorHora: conta.valorHora ?? null,
      moeda: conta.moeda || "EUR",
      competencias: conta.competencias || [],
      disponivel: conta.disponivel !== false,
    };
  }
  return { ...base, empresa: conta.empresa || "", segmento: conta.segmento || "" };
}

// Páginas privadas: sem sessão → login. `pronto(user, conta, perfil)`
function exigirSessao(pronto) {
  auth.onAuthStateChanged(
    (user) => {
      if (!user) {
        const volta = encodeURIComponent(location.pathname.replace(/^\//, "") + location.search);
        location.href = "login.html?volta=" + volta;
        return;
      }
      carregarConta(user)
        .then((r) => {
          if (!r) return auth.signOut().then(() => (location.href = "cadastro.html?sem-perfil=1"));
          wopUser = user;
          wopConta = r.conta;
          wopPerfil = r.perfil;
          montarTopo();
          pronto(user, r.conta, r.perfil);
        })
        .catch((e) => erroFatal(e));
    },
    (e) => erroFatal(e)
  );
}

// Páginas públicas: funcionam com ou sem sessão.
function sessaoOpcional(pronto) {
  let feito = false;
  auth.onAuthStateChanged((user) => {
    if (feito) return;
    feito = true;
    if (!user) {
      montarTopo();
      return pronto(null, null, null);
    }
    carregarConta(user)
      .then((r) => {
        if (r) {
          wopUser = user;
          wopConta = r.conta;
          wopPerfil = r.perfil;
        }
        montarTopo();
        pronto(r ? user : null, r?.conta || null, r?.perfil || null);
      })
      .catch((e) => {
        console.error("[Work on Pan]", e);
        montarTopo();
        pronto(null, null, null);
      });
  });
}

function sair() {
  auth.signOut().then(() => (location.href = "login.html"));
}

function erroFatal(e) {
  console.error("[Work on Pan]", e);
  const main = document.querySelector("main");
  if (main) {
    main.innerHTML = `
      <section class="cartao vazio">
        <h2>Não foi possível carregar a página</h2>
        <p>${esc(traduzirErro(e))}</p>
        <button class="botao botao-secundario" onclick="location.reload()">Tentar outra vez</button>
      </section>`;
  }
}

/* ── Cabeçalho, rodapé e aviso de cookies ────────────────────── */

function montarTopo() {
  const topo = $("topo");
  if (!topo) return;
  const pagina = location.pathname.split("/").pop().replace(".html", "") || "index";
  const ativo = (p) => (p === pagina ? ' aria-current="page"' : "");

  let links;
  if (wopConta) {
    const painel = wopConta.tipo === "cliente" ? "Os meus projetos" : "As minhas propostas";
    links = `
      <a href="index.html"${ativo("index")}>${painel}</a>
      <a href="projetos.html"${ativo("projetos")}>${wopConta.tipo === "cliente" ? "Ver projetos publicados" : "Procurar projetos"}</a>
      <a href="chat.html"${ativo("chat")}>Mensagens <span class="contador" id="contadorMensagens" hidden></span></a>
      <a href="definicoes.html"${ativo("definicoes")}>A minha conta</a>
      <button type="button" class="botao-texto" onclick="sair()">Sair</button>`;
  } else {
    links = `
      <a href="projetos.html"${ativo("projetos")}>Projetos abertos</a>
      <a href="login.html"${ativo("login")}>Entrar</a>
      <a href="cadastro.html" class="botao botao-principal botao-pequeno">Criar conta</a>`;
  }

  topo.innerHTML = `
    <div class="topo-interior">
      <a href="${wopConta ? "index.html" : "projetos.html"}" class="marca">
        <img src="pan.png" alt="" width="28" height="28"> Work on Pan
      </a>
      <button type="button" class="botao-menu" aria-expanded="false" aria-controls="menuPrincipal"
        onclick="this.setAttribute('aria-expanded', this.getAttribute('aria-expanded') !== 'true')">
        Menu
      </button>
      <nav id="menuPrincipal" class="menu" aria-label="Principal">${links}</nav>
    </div>`;

  if (wopUser) vigiarMensagensPorLer();
}

function montarRodape() {
  const rodape = $("rodape");
  if (!rodape) return;
  rodape.innerHTML = `
    <div class="rodape-interior">
      <div class="rodape-sobre">
        <a href="projetos.html" class="marca"><img src="pan.png" alt="" width="24" height="24"> Work on Pan</a>
        <p>Um sítio simples para quem precisa de um trabalho feito encontrar quem o saiba fazer.
          Os pagamentos e acordos são combinados entre cliente e freelancer.</p>
      </div>
      <nav aria-label="Plataforma">
        <h2>Plataforma</h2>
        <a href="projetos.html">Projetos abertos</a>
        <a href="cadastro.html?tipo=cliente">Publicar um projeto</a>
        <a href="cadastro.html?tipo=freelancer">Trabalhar como freelancer</a>
        <a href="chat.html">Mensagens</a>
      </nav>
      <nav aria-label="Legal">
        <h2>Privacidade e termos</h2>
        <a href="privacidade.html">Política de privacidade (RGPD)</a>
        <a href="privacidade.html#direitos">Os teus direitos sobre os dados</a>
        <a href="privacidade.html#cookies">Cookies e armazenamento local</a>
        <a href="termos.html">Termos de utilização</a>
      </nav>
      <div>
        <h2>Contacto</h2>
        <p>Pedidos sobre dados pessoais:<br><a href="mailto:${esc(CONTACTO_PRIVACIDADE)}">${esc(CONTACTO_PRIVACIDADE)}</a></p>
      </div>
    </div>
    <p class="rodape-base">© ${new Date().getFullYear()} Work on Pan. Os teus dados são tratados de acordo com o RGPD (Regulamento UE 2016/679).</p>`;
}

function avisoCookies() {
  try {
    if (localStorage.getItem("wop_aviso_cookies")) return;
  } catch {
    return;
  }
  const barra = document.createElement("div");
  barra.className = "aviso-cookies";
  barra.setAttribute("role", "region");
  barra.setAttribute("aria-label", "Aviso de cookies");
  barra.innerHTML = `
    <p>Não usamos cookies de publicidade nem de estatística. Guardamos apenas o necessário para
      manter a tua sessão iniciada e lembrar o tema escolhido.
      <a href="privacidade.html#cookies">Saber mais</a></p>
    <button type="button" class="botao botao-secundario botao-pequeno">Entendido</button>`;
  barra.querySelector("button").onclick = () => {
    try {
      localStorage.setItem("wop_aviso_cookies", "1");
    } catch {}
    barra.remove();
  };
  document.body.appendChild(barra);
}

/* ── Mensagens por ler (contador no menu) ────────────────────── */

let pararVigiaMensagens = null;

function conversaPorLer(chat, uid) {
  if (!chat.ultimoAutor || chat.ultimoAutor === uid) return false;
  const lida = paraData(chat.lidoEm?.[uid]);
  const ultima = paraData(chat.ultimaMensagemHora);
  if (!ultima) return false;
  return !lida || lida < ultima;
}

function vigiarMensagensPorLer() {
  if (pararVigiaMensagens) return;
  pararVigiaMensagens = db
    .collection("chats")
    .where("participantes", "array-contains", wopUser.uid)
    .onSnapshot(
      (snap) => {
        const n = snap.docs.filter((d) => conversaPorLer(d.data({ serverTimestamps: "estimate" }), wopUser.uid)).length;
        const el = $("contadorMensagens");
        if (!el) return;
        el.hidden = n === 0;
        el.textContent = n;
        el.setAttribute("aria-label", `${n} conversa${n === 1 ? "" : "s"} por ler`);
      },
      (e) => console.error("[Work on Pan] mensagens:", e)
    );
}

/* ── Conversas: criar/abrir ──────────────────────────────────── */

// Abre (ou cria) a conversa sobre um projeto entre o cliente e o freelancer.
function garantirConversa({ clienteId, clienteNome, freelancerId, freelancerNome, projetoId, projetoTitulo }) {
  const id = projetoId
    ? `p_${projetoId}_${freelancerId}`
    : "d_" + [clienteId, freelancerId].sort().join("_");
  const ref = db.collection("chats").doc(id);
  return ref.get().then((doc) => {
    if (doc.exists) return id;
    const aviso = projetoId
      ? `Conversa aberta sobre o projeto "${projetoTitulo}".`
      : "Conversa direta aberta.";
    return ref
      .set({
        participantes: [clienteId, freelancerId],
        nomes: { [clienteId]: clienteNome || "Cliente", [freelancerId]: freelancerNome || "Freelancer" },
        clienteId,
        freelancerId,
        projetoId: projetoId || null,
        projetoTitulo: projetoTitulo || "Contacto direto",
        criadoEm: agora(),
        ultimaMensagem: aviso,
        ultimaMensagemHora: agora(),
        ultimoAutor: "sistema",
        lidoEm: { [wopUser.uid]: agora() },
      })
      .then(() => ref.collection("mensagens").add({ autor: "sistema", texto: aviso, hora: agora() }))
      .then(() => id);
  });
}

function enviarMensagem(chatId, texto, autor = wopUser.uid) {
  const limpo = String(texto || "").trim();
  if (!limpo) return Promise.resolve();
  const ref = db.collection("chats").doc(chatId);
  return ref
    .collection("mensagens")
    .add({ autor, texto: limpo, hora: agora() })
    .then(() =>
      ref.update({
        ultimaMensagem: limpo.slice(0, 140),
        ultimaMensagemHora: agora(),
        ultimoAutor: autor,
        ["lidoEm." + wopUser.uid]: agora(),
      })
    );
}

/* ── Arranque comum ──────────────────────────────────────────── */

aplicarTema();
document.addEventListener("DOMContentLoaded", () => {
  montarRodape();
  avisoCookies();
});
