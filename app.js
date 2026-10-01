/* Work on Pan — código partilhado por todas as páginas.
 * Carregar depois do supabase-js e do supabase-config.js. */

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA);

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

function dataCurta(valor) {
  if (!valor) return "agora mesmo";
  const d = new Date(valor);
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return d.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
}

function horaCurta(valor) {
  if (!valor) return "";
  const d = new Date(valor);
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

// Nome a mostrar de um cliente: a empresa, se tiver, senão o nome.
function nomeCliente(p) {
  return p?.empresa || nomeCompleto(p);
}

function listaCompetencias(texto, maximo) {
  return texto.split(",").map((s) => s.trim()).filter(Boolean).slice(0, maximo);
}

// Mensagem curta no fundo do ecrã. tipo: "ok" | "erro"
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
  if (!e) return "Algo correu mal. Tenta outra vez.";
  // Erros lançados pelas nossas funções na base de dados já vêm em português.
  if (e.code === "P0001") return e.message;
  const mapa = {
    invalid_credentials: "E-mail ou palavra-passe incorretos.",
    email_not_confirmed: "Ainda não confirmaste o e-mail. Abre o link que te enviámos.",
    user_already_exists: "Já existe uma conta com este e-mail. Experimenta entrar.",
    email_exists: "Já existe uma conta com este e-mail. Experimenta entrar.",
    weak_password: "A palavra-passe é demasiado fraca. Usa pelo menos 8 caracteres.",
    over_request_rate_limit: "Muitas tentativas seguidas. Espera um pouco e tenta de novo.",
    over_email_send_rate_limit: "Já enviámos vários e-mails. Espera uns minutos e tenta de novo.",
    same_password: "A nova palavra-passe tem de ser diferente da atual.",
    validation_failed: "Há um campo com um valor inválido.",
    "23514": "Há um campo com um valor fora dos limites permitidos.",
    "23505": "Isto já existe.",
    "42501": "Não tens permissão para esta ação.",
  };
  if (mapa[e.code]) return mapa[e.code];
  if (/fetch|network/i.test(e.message || "")) return "Sem ligação ao servidor. Verifica a internet.";
  return "Algo correu mal. Tenta outra vez.";
}

// Lança o erro de uma resposta do Supabase, para usar com async/await.
function ok({ data, error }) {
  if (error) throw error;
  return data;
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

function temaEscuroAtivo() {
  const t = document.documentElement.dataset.theme;
  if (t) return t === "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

// Botão do cabeçalho: troca entre claro e escuro (em «A minha conta» dá para voltar a seguir o sistema).
function alternarTema() {
  aplicarTema(temaEscuroAtivo() ? "claro" : "escuro");
}

/* ── Logótipo e animações ────────────────────────────────────── */

function logo(tamanho = 30) {
  const id = "g" + Math.random().toString(36).slice(2, 7);
  return `<svg width="${tamanho}" height="${tamanho}" viewBox="0 0 32 32" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#14b8a6"/><stop offset="1" stop-color="#0f766e"/></linearGradient></defs>
    <rect width="32" height="32" rx="9" fill="url(#${id})"/>
    <path d="M7.5 11 11.8 22 16 13.5 20.2 22 24.5 11" fill="none" stroke="#fff" stroke-width="2.8"
      stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="24.5" cy="11" r="1.9" fill="#fef3c7"/>
  </svg>`;
}

// Anima a entrada dos cartões só na primeira vez que a lista aparece
// (as atualizações em tempo real depois não voltam a animar).
function animarEntrada(el) {
  if (!el || el.dataset.animado) return;
  el.dataset.animado = "1";
  el.classList.add("entrar");
  setTimeout(() => el.classList.remove("entrar"), 1000);
}

function esqueletos(n, classe = "") {
  return Array.from({ length: n }, () => `<div class="esqueleto ${classe}" aria-hidden="true"></div>`).join("");
}

/* ── Sessão e perfil ─────────────────────────────────────────── */

let wopUser = null;   // utilizador do Supabase Auth
let wopPerfil = null; // linha de public.perfis (inclui o tipo: cliente | freelancer)

async function carregarSessao() {
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  const perfil = ok(await sb.from("perfis").select("*").eq("id", user.id).maybeSingle());
  if (!perfil) return null;
  wopUser = user;
  wopPerfil = perfil;
  return perfil;
}

// Páginas privadas: sem sessão → login. `pronto(user, perfil)`
function exigirSessao(pronto) {
  carregarSessao()
    .then((perfil) => {
      if (!perfil) {
        const volta = encodeURIComponent(location.pathname.replace(/^\//, "") + location.search);
        location.href = "login.html?volta=" + volta;
        return;
      }
      montarTopo();
      pronto(wopUser, wopPerfil);
    })
    .catch(erroFatal);
}

// Páginas públicas: funcionam com ou sem sessão.
function sessaoOpcional(pronto) {
  carregarSessao()
    .catch((e) => console.error("[Work on Pan]", e))
    .finally(() => {
      montarTopo();
      pronto(wopUser, wopPerfil);
    });
}

async function sair() {
  await sb.auth.signOut();
  location.href = "login.html";
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

/* ── Tempo real ──────────────────────────────────────────────── */

// Chama `callback` (agrupado, no máximo 1x a cada 300ms) quando alguma das tabelas muda.
function aoMudar(tabelas, callback, filtro) {
  let espera;
  const agrupado = () => {
    clearTimeout(espera);
    espera = setTimeout(callback, 300);
  };
  const canal = sb.channel("wop-" + tabelas.join("-") + "-" + Math.random().toString(36).slice(2));
  tabelas.forEach((table) =>
    canal.on("postgres_changes", { event: "*", schema: "public", table, ...(filtro ? { filter: filtro } : {}) }, agrupado)
  );
  canal.subscribe();
  return canal;
}

/* ── Conversas ───────────────────────────────────────────────── */

// Abre (ou cria) a conversa com outra pessoa e vai para a caixa de mensagens.
async function irParaConversa(outroId, projetoId = null) {
  try {
    const id = ok(await sb.rpc("abrir_conversa", { p_outro: outroId, p_projeto: projetoId }));
    location.href = "chat.html?c=" + encodeURIComponent(id);
  } catch (e) {
    avisar(traduzirErro(e), "erro");
  }
}

function conversaPorLer(c, uid) {
  if (c.ultimo_autor_id === uid) return false;
  const lida = uid === c.cliente_id ? c.lido_cliente_em : c.lido_freelancer_em;
  return !lida || new Date(lida) < new Date(c.ultima_mensagem_em);
}

async function atualizarContadorMensagens() {
  const el = $("contadorMensagens");
  if (!el || !wopUser) return;
  const { data } = await sb
    .from("conversas")
    .select("cliente_id, freelancer_id, ultimo_autor_id, ultima_mensagem_em, lido_cliente_em, lido_freelancer_em");
  const n = (data || []).filter((c) => conversaPorLer(c, wopUser.id)).length;
  el.hidden = n === 0;
  el.textContent = n;
  el.setAttribute("aria-label", `${n} conversa${n === 1 ? "" : "s"} por ler`);
}

/* ── Cabeçalho, rodapé e aviso de cookies ────────────────────── */

let vigiaMensagens = null;

function montarTopo() {
  const topo = $("topo");
  if (!topo) return;
  const pagina = location.pathname.split("/").pop().replace(".html", "") || "index";
  const ativo = (p) => (p === pagina ? ' aria-current="page"' : "");

  let links;
  if (wopPerfil) {
    const cliente = wopPerfil.tipo === "cliente";
    links = `
      <a href="index.html"${ativo("index")}>${cliente ? "Os meus projetos" : "As minhas propostas"}</a>
      <a href="projetos.html"${ativo("projetos")}>${cliente ? "Ver projetos publicados" : "Procurar projetos"}</a>
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
      <a href="${wopPerfil ? "index.html" : "projetos.html"}" class="marca">
        ${logo()} Work on Pan
      </a>
      <button type="button" class="botao-icone botao-tema" onclick="alternarTema()"
        title="Mudar entre tema claro e escuro" aria-label="Mudar entre tema claro e escuro">
        <svg class="icone-sol" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
        </svg>
        <svg class="icone-lua" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>
        </svg>
      </button>
      <button type="button" class="botao-menu" aria-expanded="false" aria-controls="menuPrincipal" aria-label="Abrir menu"
        onclick="this.setAttribute('aria-expanded', this.getAttribute('aria-expanded') !== 'true')">
        <span class="barras"></span>
      </button>
      <nav id="menuPrincipal" class="menu" aria-label="Principal">${links}</nav>
    </div>`;

  if (wopUser) {
    atualizarContadorMensagens();
    if (!vigiaMensagens) vigiaMensagens = aoMudar(["conversas"], atualizarContadorMensagens);
  }
}

function montarRodape() {
  const rodape = $("rodape");
  if (!rodape) return;
  rodape.innerHTML = `
    <div class="rodape-interior">
      <div class="rodape-sobre">
        <a href="projetos.html" class="marca">${logo(26)} Work on Pan</a>
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

/* ── Arranque comum ──────────────────────────────────────────── */

aplicarTema();
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-logo]").forEach((el) => (el.innerHTML = logo(Number(el.dataset.logo))));
  montarRodape();
  avisoCookies();
});
// Sombra no cabeçalho quando a página desce.
addEventListener("scroll", () => $("topo")?.classList.toggle("rolado", scrollY > 4), { passive: true });
