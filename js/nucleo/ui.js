// Peças de interface partilhadas: tema, avisos, janelas de confirmação e animações.
import { html, render, nothing } from "./html.js";
import { ESTADOS_PROJETO, ESTADOS_PROPOSTA } from "./formato.js";

export const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
export const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

/* ── Tema ────────────────────────────────────────────────────── */

const CHAVE_TEMA = "wop_tema";

export function temaGuardado() {
  try {
    return localStorage.getItem(CHAVE_TEMA) || "sistema";
  } catch {
    return "sistema";
  }
}

export function aplicarTema(tema = temaGuardado()) {
  try {
    localStorage.setItem(CHAVE_TEMA, tema);
  } catch {}
  const raiz = document.documentElement;
  if (tema === "claro") raiz.dataset.theme = "light";
  else if (tema === "escuro") raiz.dataset.theme = "dark";
  else delete raiz.dataset.theme;
  atualizarCorDoNavegador();
}

export function temaEscuroAtivo() {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}

export function alternarTema() {
  const trocar = () => aplicarTema(temaEscuroAtivo() ? "claro" : "escuro");
  // Transição suave entre temas onde o browser suporta.
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.startViewTransition(trocar);
  } else {
    trocar();
  }
}

// A barra do browser no telemóvel acompanha o tema escolhido.
const COR_BARRA = { light: "#f7f8fa", dark: "#0a0d12" };

function atualizarCorDoNavegador() {
  const escolhido = document.documentElement.dataset.theme; // undefined = segue o sistema
  for (const meta of $$('meta[name="theme-color"]')) {
    const doSistema = meta.media.includes("dark") ? COR_BARRA.dark : COR_BARRA.light;
    meta.content = escolhido ? COR_BARRA[escolhido] : doSistema;
  }
}

/* ── Avisos rápidos ──────────────────────────────────────────── */

let caixaAviso;

export function avisar(texto, tipo = "ok") {
  if (!caixaAviso) {
    caixaAviso = document.createElement("div");
    caixaAviso.setAttribute("role", "status");
    caixaAviso.setAttribute("aria-live", "polite");
    document.body.append(caixaAviso);
  }
  caixaAviso.textContent = texto;
  caixaAviso.className = `aviso-flutuante ${tipo === "erro" ? "erro" : ""}`;
  requestAnimationFrame(() => caixaAviso.classList.add("visivel"));
  clearTimeout(caixaAviso.temporizador);
  caixaAviso.temporizador = setTimeout(() => caixaAviso.classList.remove("visivel"), 4200);
}

/* ── Janelas (substituem confirm() e prompt()) ───────────────── */

function abrirJanela(conteudo, aoFechar) {
  const janela = document.createElement("dialog");
  document.body.append(janela);
  render(conteudo(() => janela.close()), janela);
  janela.addEventListener("close", () => {
    aoFechar(janela.returnValue, janela);
    janela.remove();
  });
  // Clicar fora da janela fecha-a.
  janela.addEventListener("click", (ev) => {
    if (ev.target === janela) janela.close("cancelar");
  });
  janela.showModal();
  return janela;
}

/**
 * Pergunta e espera pela resposta.
 * @returns {Promise<boolean>}
 */
export function confirmar({ titulo, texto, sim = "Confirmar", nao = "Cancelar", perigo = false }) {
  return new Promise((resolver) => {
    abrirJanela(
      () => html`
        <form method="dialog" class="dialog-corpo">
          <h2>${titulo}</h2>
          ${texto ? html`<p class="texto-suave" style="white-space: pre-line">${texto}</p>` : nothing}
          <div class="dialog-acoes">
            <button class="botao botao-secundario" value="cancelar">${nao}</button>
            <button class="botao ${perigo ? "botao-perigo-cheio" : "botao-principal"}" value="sim" autofocus>${sim}</button>
          </div>
        </form>
      `,
      (resposta) => resolver(resposta === "sim")
    );
  });
}

/**
 * Pede a palavra-passe para confirmar uma ação sensível.
 * @returns {Promise<string|null>}
 */
export function pedirSenha({ titulo, texto, sim = "Confirmar", perigo = false }) {
  return new Promise((resolver) => {
    let valor = "";
    abrirJanela(
      () => html`
        <form method="dialog" class="dialog-corpo">
          <h2>${titulo}</h2>
          ${texto ? html`<p class="texto-suave">${texto}</p>` : nothing}
          <div class="campo" style="margin-top: 1rem">
            <label for="senhaJanela">Palavra-passe</label>
            <input id="senhaJanela" type="password" autocomplete="current-password" required autofocus
              @input=${(e) => (valor = e.target.value)}>
          </div>
          <div class="dialog-acoes">
            <button class="botao botao-secundario" value="cancelar" formnovalidate>Cancelar</button>
            <button class="botao ${perigo ? "botao-perigo-cheio" : "botao-principal"}" value="sim">${sim}</button>
          </div>
        </form>
      `,
      (resposta) => resolver(resposta === "sim" && valor ? valor : null)
    );
  });
}

/* ── Animações e estados de carregamento ─────────────────────── */

// Os cartões de uma lista entram em cascata só da primeira vez
// (as atualizações em tempo real depois não voltam a animar).
export function animarEntrada(el) {
  if (!el || el.dataset.animado) return;
  el.dataset.animado = "1";
  el.classList.add("entrar");
  setTimeout(() => el.classList.remove("entrar"), 1000);
}

export const esqueletos = (n, curto = false) =>
  Array.from({ length: n }, () => html`<div class="esqueleto ${curto ? "curto" : ""}" aria-hidden="true"></div>`);

export const etiqueta = (mapa, estado) => {
  const e = mapa[estado] || { texto: estado, classe: "etiqueta-neutra" };
  return html`<span class="etiqueta ${e.classe}">${e.texto}</span>`;
};

export const etiquetaProjeto = (estado) => etiqueta(ESTADOS_PROJETO, estado);
export const etiquetaProposta = (estado) => etiqueta(ESTADOS_PROPOSTA, estado);

// Pequena ilustração para estados vazios (linhas simples, segue a cor do tema).
export const ilustracaoVazio = html`
  <svg class="ilustracao" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="10" y="14" width="44" height="36" rx="8" />
    <path d="M10 26h44M22 38h20" />
    <circle cx="50" cy="14" r="6" fill="currentColor" stroke="none" opacity="0.25" />
  </svg>
`;

export function estadoVazio({ titulo, texto, acao }) {
  return html`
    <div class="cartao vazio">
      ${ilustracaoVazio}
      ${titulo ? html`<h2>${titulo}</h2>` : nothing}
      ${texto ? html`<p>${texto}</p>` : nothing}
      ${acao ?? nothing}
    </div>
  `;
}

/* ── Formulários ─────────────────────────────────────────────── */

export function mostrarMensagem(alvo, texto, tipo = "erro") {
  alvo.textContent = texto;
  alvo.className = `mensagem-form ${tipo}`;
  alvo.hidden = false;
}

// Desativa o botão e mostra um texto enquanto a ação decorre.
export async function aCarregar(botao, texto, acao) {
  const original = botao.textContent;
  botao.disabled = true;
  botao.textContent = texto;
  try {
    return await acao();
  } finally {
    botao.disabled = false;
    botao.textContent = original;
  }
}
