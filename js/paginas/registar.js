import "../arranque.js";
import { html, pintar } from "../nucleo/html.js";
import { sb } from "../nucleo/supabase.js";
import { sessao, sessaoPronta } from "../nucleo/sessao.js";
import { $, aCarregar, mostrarMensagem, vaporar } from "../nucleo/ui.js";
import { CATEGORIAS, MOEDAS, iniciais, listaCompetencias, traduzirErro } from "../nucleo/formato.js";
import { forcaSenha, ligarSenhas } from "../nucleo/senha.js";

const form = $("#formRegisto");
const caixa = $("#mensagem");

$("#area").innerHTML =
  '<option value="">Escolhe a tua área principal</option>' +
  Object.entries(CATEGORIAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
$("#moeda").innerHTML = Object.entries(MOEDAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");

const tipoPedido = new URLSearchParams(location.search).get("tipo");
if (tipoPedido === "cliente" || tipoPedido === "freelancer") {
  form.elements.tipo.value = tipoPedido;
}

ligarSenhas();

/* ── Pré-visualização ao vivo do cartão (só texto: nada de HTML vindo do formulário) ── */

function atualizarPrevia() {
  const d = Object.fromEntries(new FormData(form));
  const nome = [d.nome, d.sobrenome].map((x) => (x || "").trim()).filter(Boolean).join(" ");
  const freelancer = d.tipo === "freelancer";
  $("#previaNome").textContent = nome || "O teu nome";
  $("#previaIniciais").textContent = nome ? iniciais(nome) : "?";
  $("#montraTitulo").textContent = freelancer ? "Assim te veem os clientes" : d.tipo === "cliente" ? "Assim te veem os freelancers" : "Assim te vão ver";
  $("#previaPapel").textContent = !d.tipo
    ? "Escolhe cliente ou freelancer"
    : freelancer
      ? `Freelancer${d.area ? " · " + CATEGORIAS[d.area] : ""}`
      : `Cliente${d.empresa?.trim() ? " · " + d.empresa.trim() : ""}`;
  $("#previaTexto").textContent = freelancer
    ? d.bio?.trim() || "A tua apresentação aparece aqui."
    : d.segmento || "Os freelancers veem o teu nome (ou o da empresa) em cada projeto.";
  const lista = $("#previaCompetencias");
  lista.replaceChildren(
    ...(freelancer ? listaCompetencias(d.competencias || "", 6) : []).map((c) => Object.assign(document.createElement("li"), { textContent: c }))
  );
  $("#proximoPapel span").textContent = freelancer
    ? "Escolhes um projeto e envias a primeira proposta."
    : "Publicas o primeiro projeto e recebes propostas.";
}

form.addEventListener("input", atualizarPrevia);
form.addEventListener("change", atualizarPrevia);
atualizarPrevia();

function erro(texto) {
  mostrarMensagem(caixa, texto);
  caixa.scrollIntoView({ behavior: "smooth", block: "center" });
}

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const d = Object.fromEntries(new FormData(form));
  const email = (d.email || "").trim();

  if (!d.tipo) return erro("Escolhe primeiro se és cliente ou freelancer.");
  if (!d.nome?.trim()) return erro("Escreve o teu nome.");
  if (!email || !form.elements.email.checkValidity()) return erro("Esse e-mail não parece válido.");
  if ((d.senha || "").length < 8) return erro("A palavra-passe tem de ter pelo menos 8 caracteres.");
  if (forcaSenha(d.senha).nivel < 2) return erro("Essa palavra-passe é fácil de adivinhar. Junta maiúsculas, números ou símbolos.");
  if (d.senha !== d.repetir) return erro("As duas palavras-passe não são iguais.");
  if (!d.aceito) return erro("Para criar conta tens de aceitar os termos e a política de privacidade.");

  // Estes dados seguem no registo; um gatilho na base de dados cria o perfil e a conta.
  const dados = {
    tipo: d.tipo,
    nome: d.nome.trim(),
    sobrenome: d.sobrenome.trim(),
    consentimento: { termos: true, privacidade: true, versao: "2026-09", data: new Date().toISOString() },
    ...(d.tipo === "freelancer"
      ? {
          area: d.area,
          bio: d.bio.trim(),
          valor_hora: d.valor_hora || "",
          moeda: d.moeda,
          competencias: listaCompetencias(d.competencias, 15),
        }
      : { empresa: d.empresa.trim(), segmento: d.segmento }),
  };

  const resposta = await aCarregar(form.querySelector('[type="submit"]'), "A criar a conta…", () =>
    sb.auth.signUp({
      email,
      password: d.senha,
      options: { data: dados, emailRedirectTo: new URL("/entrar?confirmado=1", location.origin).href },
    })
  );

  if (resposta.error) return erro(traduzirErro(resposta.error));
  if (resposta.data.session) return location.assign("/painel");

  // Confirmação por e-mail ativa: ainda não há sessão.
  pintar(
    html`
      <div class="cartao vazio">
        <wop-logo tamanho="56" style="margin: 0 auto 1rem"></wop-logo>
        <h2>Falta só confirmar o e-mail</h2>
        <p>Enviámos um link para <strong>${email}</strong>. Abre-o para ativar a conta e depois entra.
          Se não aparecer em alguns minutos, vê na pasta de spam.</p>
        <a class="botao botao-secundario" href="/entrar">Ir para a página de entrada</a>
      </div>
    `,
    form
  );
  vaporar(form.querySelector("wop-logo"));
});

await sessaoPronta;
if (sessao.perfil) location.replace("/painel");
