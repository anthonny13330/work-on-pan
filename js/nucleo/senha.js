// Palavras-passe: botão de mostrar/esconder, medidor de força e confirmação.
// Funciona com HTML estático: procura os elementos pelos atributos data-*.
//
//   <div class="entrada-icone campo-senha"> <input type="password"> </div>
//   <div class="forca" data-forca-de="idDoCampo"></div>
//   <p class="confere" data-confere-com="idDoCampo" data-confere-campo="idDaRepeticao"></p>

const COMUNS = ["password", "palavrapasse", "12345678", "123456789", "qwerty", "workonpan", "abcdefgh", "11111111", "iloveyou", "benfica", "sporting", "portugal", "brasil"];

const ROTULOS = ["", "Fraca", "Razoável", "Boa", "Forte"];

/** Força de 0 (vazia) a 4 (forte) e as regras cumpridas. */
export function forcaSenha(senha = "") {
  const regras = {
    tamanho: senha.length >= 8,
    letras: /[a-zà-ÿ]/.test(senha) && /[A-ZÀ-Ý]/.test(senha),
    numero: /\d/.test(senha),
    simbolo: /[^\p{L}\p{N}]/u.test(senha),
  };
  if (!senha) return { nivel: 0, rotulo: "", regras };

  let pontos = Object.values(regras).filter(Boolean).length;
  if (senha.length >= 12) pontos += 1;
  const baixa = senha.toLowerCase();
  const repetida = /^(.)\1+$/.test(senha) || /^(.{1,3})\1+$/.test(senha);
  if (COMUNS.some((c) => baixa.includes(c)) || repetida) pontos = Math.min(pontos, 1);
  if (!regras.tamanho) pontos = Math.min(pontos, 1);

  const nivel = Math.max(1, Math.min(4, pontos));
  return { nivel, rotulo: ROTULOS[nivel], regras };
}

const DICAS = [
  ["tamanho", "8 ou mais caracteres"],
  ["letras", "maiúsculas e minúsculas"],
  ["numero", "um número"],
  ["simbolo", "um símbolo (! ? # …)"],
];

function prepararMedidor(caixa, campo) {
  caixa.innerHTML = `
    <div class="forca-barras" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
    <p class="forca-texto" aria-live="polite"></p>
    <ul class="forca-dicas">${DICAS.map(([k, t]) => `<li data-regra="${k}"><wop-icone nome="visto"></wop-icone>${t}</li>`).join("")}</ul>`;
  const texto = caixa.querySelector(".forca-texto");
  const atualizar = () => {
    const { nivel, rotulo, regras } = forcaSenha(campo.value);
    caixa.dataset.nivel = nivel;
    texto.textContent = nivel ? `Força: ${rotulo}` : "Escolhe uma palavra-passe que não uses noutros sítios.";
    for (const li of caixa.querySelectorAll("[data-regra]")) li.classList.toggle("cumprida", regras[li.dataset.regra]);
  };
  campo.addEventListener("input", atualizar);
  atualizar();
}

function prepararConfirmacao(caixa, original, repeticao) {
  const atualizar = () => {
    if (!repeticao.value) {
      caixa.dataset.estado = "";
      caixa.textContent = "";
      return;
    }
    const iguais = repeticao.value === original.value;
    caixa.dataset.estado = iguais ? "ok" : "erro";
    caixa.innerHTML = iguais
      ? '<wop-icone nome="visto"></wop-icone> As palavras-passe coincidem.'
      : '<wop-icone nome="recusar"></wop-icone> Ainda não são iguais.';
    repeticao.setCustomValidity(iguais ? "" : "As palavras-passe não coincidem.");
  };
  original.addEventListener("input", atualizar);
  repeticao.addEventListener("input", atualizar);
}

function prepararOlho(caixa) {
  const campo = caixa.querySelector("input");
  if (!campo || caixa.querySelector(".mostrar-senha")) return;
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "mostrar-senha";
  const pintar = () => {
    const visivel = campo.type === "text";
    botao.innerHTML = `<wop-icone nome="${visivel ? "olho-fechado" : "olho"}"></wop-icone>`;
    botao.setAttribute("aria-label", visivel ? "Esconder a palavra-passe" : "Mostrar a palavra-passe");
    botao.setAttribute("aria-pressed", String(visivel));
  };
  botao.addEventListener("click", () => {
    campo.type = campo.type === "password" ? "text" : "password";
    pintar();
    campo.focus();
  });
  pintar();
  caixa.append(botao);
}

/** Liga todos os campos de palavra-passe da página (ou de uma parte dela). */
export function ligarSenhas(raiz = document) {
  for (const caixa of raiz.querySelectorAll(".campo-senha")) prepararOlho(caixa);
  for (const caixa of raiz.querySelectorAll("[data-forca-de]")) {
    const campo = document.getElementById(caixa.dataset.forcaDe);
    if (campo) prepararMedidor(caixa, campo);
  }
  for (const caixa of raiz.querySelectorAll("[data-confere-com]")) {
    const original = document.getElementById(caixa.dataset.confereCom);
    const repeticao = document.getElementById(caixa.dataset.confereCampo);
    if (original && repeticao) prepararConfirmacao(caixa, original, repeticao);
  }
}
