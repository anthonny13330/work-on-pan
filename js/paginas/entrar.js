import "../arranque.js";
import { html, pintar } from "../nucleo/html.js";
import { sb } from "../nucleo/supabase.js";
import { sessao, sessaoPronta, destinoDepoisDeEntrar } from "../nucleo/sessao.js";
import { $, aCarregar } from "../nucleo/ui.js";
import { traduzirErro } from "../nucleo/formato.js";

const destino = destinoDepoisDeEntrar();
const caixa = $("#mensagem");
const form = $("#formEntrar");

function mostrar(conteudo, tipo = "erro") {
  caixa.className = `mensagem-form ${tipo}`;
  caixa.hidden = false;
  pintar(conteudo, caixa);
}

const ligacaoConfirmacao = () => new URL("/entrar?confirmado=1", location.origin).href;

async function reenviarConfirmacao(email) {
  const { error } = await sb.auth.resend({ type: "signup", email, options: { emailRedirectTo: ligacaoConfirmacao() } });
  mostrar(error ? traduzirErro(error) : `Enviámos um novo link para ${email}.`, error ? "erro" : "ok");
}

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const { email, senha } = Object.fromEntries(new FormData(form));
  if (!email.trim() || !senha) return mostrar("Escreve o e-mail e a palavra-passe.");

  const erro = await aCarregar(form.querySelector('[type="submit"]'), "A entrar…", async () => {
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha });
    return error;
  });
  if (!erro) return location.assign(destino);

  if (erro.code === "email_not_confirmed") {
    // Conta por confirmar: explica e deixa pedir outro e-mail.
    return mostrar(html`
      Ainda não confirmaste o e-mail ${email.trim()}. Abre o link que te enviámos (vê também o spam).<br>
      <button type="button" class="botao botao-secundario botao-pequeno" style="margin-top: 0.6rem"
        @click=${() => reenviarConfirmacao(email.trim())}>Enviar outra vez o e-mail de confirmação</button>
    `);
  }
  mostrar(traduzirErro(erro));
});

$("#btnRecuperar").addEventListener("click", async () => {
  const email = $("#email").value.trim();
  if (!email) {
    $("#email").focus();
    return mostrar("Escreve primeiro o teu e-mail no campo acima.");
  }
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: new URL("/conta?recuperar=1", location.origin).href,
  });
  if (error) return mostrar(traduzirErro(error));
  mostrar(`Se existir uma conta com ${email}, vais receber um e-mail com o link para criar uma nova palavra-passe.`, "ok");
});

if (new URLSearchParams(location.search).has("confirmado")) {
  mostrar("E-mail confirmado. Já podes entrar.", "ok");
}

await sessaoPronta;
if (sessao.perfil) location.replace(destino);
