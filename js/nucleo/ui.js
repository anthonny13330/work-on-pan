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
const COR_BARRA = { light: "#f4f1ec", dark: "#141210" };

function atualizarCorDoNavegador() {
  const escolhido = document.documentElement.dataset.theme; // undefined = segue o sistema
  for (const meta of $$('meta[name="theme-color"]')) {
    const doSistema = meta.media.includes("dark") ? COR_BARRA.dark : COR_BARRA.light;
    meta.content = escolhido ? COR_BARRA[escolhido] : doSistema;
  }
}

/* ── Avisos rápidos ──────────────────────────────────────────── */

let caixaAviso;

export function avisar(texto, tipo = "ok", { vapor = false } = {}) {
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
  if (vapor) setTimeout(() => vaporar(caixaAviso), 380);
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

// Panela no carregamento: o aro de latão gira e o vapor desenha o W.
// Só aparece se a espera passar de 400 ms (atraso feito em CSS).
const SETA = "M4 4L22 9.6L15.2 12.6L12.6 15.2L9.6 22Z";
const W = "M29 32.5C30.6 37.4 32 41 33.5 43.5C35 41 36.5 37.8 38 35.5C39.5 37.8 41 41 42.5 43.5C44 41 45.4 37.4 47 32.5";

export const carregador = (texto = "A pôr ao lume…") => html`
  <div class="carregador" role="status">
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M13 13L25 25" stroke="currentColor" stroke-width="6.4" stroke-linecap="round" />
      <path d=${SETA} fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
      <circle cx="38" cy="38" r="21" class="carregador-corpo" />
      <circle cx="38" cy="38" r="15.5" class="carregador-fundo" />
      <circle class="carregador-aro" cx="38" cy="38" r="24.6" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="26 129" />
      <path class="carregador-vapor" pathLength="100" d=${W} fill="none" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span>${texto}</span>
  </div>
`;

export const esqueletos = (n, curto = false) => [
  carregador(),
  ...Array.from({ length: n }, () => html`<div class="esqueleto ${curto ? "curto" : ""}" aria-hidden="true"></div>`),
];

// Vapor ao publicar: três fios sobem do botão. Só em momentos raros
// (publicar, proposta aceite, conta criada). Sem efeito com «reduzir movimento».
export function vaporar(origem) {
  if (!origem || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = origem.getBoundingClientRect();
  if (!r.width) return;
  const caixa = document.createElement("div");
  caixa.className = "fumos";
  caixa.setAttribute("aria-hidden", "true");
  caixa.style.left = `${r.left}px`;
  caixa.style.top = `${r.top}px`;
  caixa.style.width = `${r.width}px`;
  caixa.innerHTML = [
    [30, 52],
    [48, 64],
    [66, 46],
  ]
    .map(
      ([x, h]) => `<svg class="fumo" style="left:${x}%" width="16" height="${h}" viewBox="0 0 16 ${h}"><path pathLength="100" d="M8 ${h - 2}C3 ${h * 0.75} 13 ${h * 0.55} 8 ${h * 0.35}S5 ${h * 0.1} 9 2" fill="none" stroke-width="2.2" stroke-linecap="round"/></svg>`
    )
    .join("");
  document.body.append(caixa);
  setTimeout(() => caixa.remove(), 1600);
}

export const etiqueta = (mapa, estado) => {
  const e = mapa[estado] || { texto: estado, classe: "etiqueta-neutra" };
  return html`<span class="etiqueta ${e.classe}">${e.texto}</span>`;
};

export const etiquetaProjeto = (estado) => etiqueta(ESTADOS_PROJETO, estado);
export const etiquetaProposta = (estado) => etiqueta(ESTADOS_PROPOSTA, estado);

// Pequena ilustração para estados vazios (linhas simples, segue a cor do tema).
// Estados vazios: a panela vazia, vista de cima.
export const ilustracaoVazio = html`<wop-logo class="ilustracao" tamanho="72"></wop-logo>`;

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
  botao.classList.add("a-carregar");
  try {
    return await acao();
  } finally {
    botao.disabled = false;
    botao.textContent = original;
    botao.classList.remove("a-carregar");
  }
}
