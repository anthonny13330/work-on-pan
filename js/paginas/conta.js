import "../arranque.js";
import { sb, ok } from "../nucleo/supabase.js";
import { exigirSessao } from "../nucleo/sessao.js";
import { $, avatar, avisar, aplicarTema, temaGuardado, pedirSenha, aCarregar, confirmar, etiquetaPagamento } from "../nucleo/ui.js";
import { html, pintar, repeat } from "../nucleo/html.js";
import { PASTAS, apagarImagem, enviarImagem, reduzirImagem, urlImagem } from "../nucleo/imagens.js";
import { CATEGORIAS, MOEDAS, dataCurta, dinheiro, listaCompetencias, nomeCompleto, traduzirErro } from "../nucleo/formato.js";
import { forcaSenha, ligarSenhas } from "../nucleo/senha.js";

const { user, perfil } = await exigirSessao();
const freelancer = perfil.tipo === "freelancer";

// Veio do link «esqueci-me da palavra-passe»: não se pede a atual.
const recuperacao = new URLSearchParams(location.search).has("recuperar");

/* ── Preencher ───────────────────────────────────────────────── */

$("#area").innerHTML =
  '<option value="">Escolhe</option>' + Object.entries(CATEGORIAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
$("#moeda").innerHTML = Object.entries(MOEDAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");

ligarSenhas();
$("#nomeConta").textContent = nomeCompleto(perfil) || "A minha conta";
$("#tipoConta").textContent = freelancer ? "freelancer" : "cliente";
$("#emailConta").textContent = user.email;
$("#email").value = user.email;
$("#perfilExplicacao").textContent = freelancer
  ? "É o que os clientes veem quando recebem uma proposta tua ou procuram freelancers."
  : "É o que os freelancers veem nos teus projetos e nas conversas.";
$("#perfilFreelancer").hidden = !freelancer;
$("#perfilCliente").hidden = freelancer;
$("#textoApagar").textContent =
  (freelancer
    ? "Apaga o teu perfil, as tuas propostas e todas as tuas conversas."
    : "Apaga o teu perfil, todos os teus projetos (com as propostas recebidas) e todas as tuas conversas.") +
  " As conversas desaparecem também para a outra pessoa. Não é possível desfazer.";

const formPerfil = $("#formPerfil");
for (const campo of ["nome", "sobrenome", "area", "bio", "moeda", "empresa", "segmento"]) {
  if (formPerfil.elements[campo]) formPerfil.elements[campo].value = perfil[campo] ?? "";
}
formPerfil.elements.valor_hora.value = perfil.valor_hora ?? "";
formPerfil.elements.competencias.value = perfil.competencias.join(", ");
formPerfil.elements.disponivel.checked = perfil.disponivel;

sb.from("contas").select("telefone, paypal_email").eq("id", user.id).maybeSingle().then(({ data }) => {
  $("#telefone").value = data?.telefone || "";
  $("#paypalEmail").value = data?.paypal_email || "";
});
$("#campoPayPal").hidden = !freelancer;
$("#portfolio").hidden = !freelancer;
$("#ligacaoPortfolio").hidden = !freelancer;

for (const r of document.querySelectorAll("input[name=tema]")) r.checked = r.value === temaGuardado();
$("#tema").addEventListener("change", (e) => {
  aplicarTema(e.target.value);
  avisar("Tema alterado.");
});

if (recuperacao) {
  $("#campoSenhaAtual").hidden = true;
  $("#tituloSenha").textContent = "Escolhe uma nova palavra-passe";
  $("#seguranca").scrollIntoView();
  $("#senhaNova").focus();
} else if (location.hash) {
  document.querySelector(location.hash)?.scrollIntoView();
}

/* ── Guardar ─────────────────────────────────────────────────── */

formPerfil.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const d = Object.fromEntries(new FormData(formPerfil));
  if (!d.nome.trim()) return avisar("O nome não pode ficar vazio.", "erro");

  const dados = { nome: d.nome.trim(), sobrenome: d.sobrenome.trim() };
  if (freelancer) {
    Object.assign(dados, {
      area: d.area || null,
      bio: d.bio.trim(),
      valor_hora: d.valor_hora ? Number(d.valor_hora) : null,
      moeda: d.moeda,
      competencias: listaCompetencias(d.competencias, 15),
      disponivel: formPerfil.elements.disponivel.checked,
    });
  } else {
    Object.assign(dados, { empresa: d.empresa.trim(), segmento: d.segmento.trim() });
  }

  const { error } = await sb.from("perfis").update(dados).eq("id", user.id);
  if (error) return avisar(traduzirErro(error), "erro");
  Object.assign(perfil, dados);
  avisar("Perfil público guardado.");
});

$("#formDados").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const dados = { telefone: $("#telefone").value.trim() };
  if (freelancer) {
    const email = $("#paypalEmail").value.trim();
    if (email && !$("#paypalEmail").checkValidity()) return avisar("Esse e-mail PayPal não parece válido.", "erro");
    dados.paypal_email = email;
  }
  const { error } = await sb.from("contas").update(dados).eq("id", user.id);
  avisar(error ? traduzirErro(error) : "Dados privados guardados.", error ? "erro" : "ok");
});

// Confirma a palavra-passe atual iniciando sessão com ela.
async function confirmarSenha(senha) {
  const { error } = await sb.auth.signInWithPassword({ email: user.email, password: senha });
  if (error) throw Object.assign(new Error("senha"), { code: "senha_errada" });
}

$("#formSenha").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const form = evento.target;
  const { atual, nova, repetir } = Object.fromEntries(new FormData(form));
  if (!recuperacao && !atual) return avisar("Escreve a palavra-passe atual.", "erro");
  if (nova.length < 8) return avisar("A nova palavra-passe tem de ter pelo menos 8 caracteres.", "erro");
  if (forcaSenha(nova).nivel < 2) return avisar("Essa palavra-passe é fácil de adivinhar. Junta maiúsculas, números ou símbolos.", "erro");
  if (nova !== repetir) return avisar("As duas novas palavras-passe não são iguais.", "erro");
  try {
    if (!recuperacao) await confirmarSenha(atual);
    ok(await sb.auth.updateUser({ password: nova }));
    form.reset();
    avisar("Palavra-passe alterada.");
    if (recuperacao) history.replaceState(null, "", "/conta");
  } catch (e) {
    avisar(e.code === "senha_errada" ? "A palavra-passe atual não está certa." : traduzirErro(e), "erro");
  }
});

/* ── RGPD: exportar (art. 15.º e 20.º) e apagar (art. 17.º) ──── */

$("#btnExportar").addEventListener("click", (evento) =>
  aCarregar(evento.currentTarget, "A preparar o ficheiro…", async () => {
    try {
      const dados = ok(await sb.rpc("exportar_os_meus_dados"));
      const ligacao = document.createElement("a");
      ligacao.href = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" }));
      ligacao.download = `work-on-pan-dados-${new Date().toISOString().slice(0, 10)}.json`;
      ligacao.click();
      setTimeout(() => URL.revokeObjectURL(ligacao.href), 1000);
    } catch (e) {
      avisar(`Não foi possível gerar o ficheiro. ${traduzirErro(e)}`, "erro");
    }
  })
);

$("#btnApagar").addEventListener("click", async (evento) => {
  const senha = await pedirSenha({
    titulo: "Apagar a conta de vez?",
    texto: "Escreve a tua palavra-passe para confirmar. Esta ação não pode ser desfeita.",
    sim: "Apagar a minha conta",
    perigo: true,
  });
  if (!senha) return;
  await aCarregar(evento.target, "A apagar…", async () => {
    try {
      await confirmarSenha(senha);
      ok(await sb.rpc("apagar_a_minha_conta"));
      await sb.auth.signOut({ scope: "local" });
      location.href = "/?conta-apagada=1";
    } catch (e) {
      avisar(e.code === "senha_errada" ? "Palavra-passe incorreta. A conta não foi apagada." : traduzirErro(e), "erro");
    }
  });
});

/* ── Fotografia de perfil ────────────────────────────────────── */

function desenharFoto() {
  pintar(avatar(perfil, "avatar-enorme"), $("#fotoAtual"));
  $("#btnRemoverFoto").hidden = !perfil.foto;
  pintar(avatar(perfil, "avatar-grande"), $("#avatarConta"));
}

async function mudarFoto(foto) {
  const antiga = perfil.foto;
  const { error } = await sb.from("perfis").update({ foto }).eq("id", user.id);
  if (error) throw error;
  perfil.foto = foto;
  if (antiga && antiga !== foto) await apagarImagem(PASTAS.avatar, antiga);
  desenharFoto();
}

$("#ficheiroFoto").addEventListener("change", async (evento) => {
  const ficheiro = evento.target.files[0];
  evento.target.value = "";
  if (!ficheiro) return;
  const rotulo = evento.target.closest("label");
  rotulo.classList.add("a-carregar");
  try {
    const blob = await reduzirImagem(ficheiro, { lado: 512, quadrada: true });
    // Nome novo a cada envio: o browser não fica com a fotografia antiga em cache.
    const caminho = await enviarImagem(PASTAS.avatar, user.id, blob, `foto-${Date.now()}`);
    await mudarFoto(caminho);
    avisar("Fotografia atualizada.");
  } catch (e) {
    avisar(e.message?.startsWith("Escolhe") || e.message?.startsWith("A imagem") ? e.message : traduzirErro(e), "erro");
  } finally {
    rotulo.classList.remove("a-carregar");
  }
});

$("#btnRemoverFoto").addEventListener("click", async () => {
  if (!(await confirmar({ titulo: "Remover a fotografia?", texto: "Voltam a aparecer as tuas iniciais.", sim: "Remover", perigo: true }))) return;
  try {
    await mudarFoto("");
    avisar("Fotografia removida.");
  } catch (e) {
    avisar(traduzirErro(e), "erro");
  }
});

desenharFoto();

/* ── Portfólio (freelancers) ─────────────────────────────────── */

let trabalhos = [];

async function carregarPortfolio() {
  const { data, error } = await sb.from("portfolio").select("*").eq("perfil_id", user.id).order("criado_em", { ascending: false });
  if (error) return avisar(traduzirErro(error), "erro");
  trabalhos = data;
  desenharPortfolio();
}

function desenharPortfolio() {
  $("#contagemPortfolio").textContent = `${trabalhos.length} de 12`;
  $("#formPortfolio").hidden = trabalhos.length >= 12;
  pintar(
    trabalhos.length
      ? repeat(trabalhos, (t) => t.id, (t) => html`
          <li class="trabalho">
            <img src=${urlImagem(PASTAS.portfolio, t.caminho)} alt=${t.titulo || "Trabalho do portfólio"} loading="lazy" decoding="async">
            <div class="trabalho-texto">
              <strong>${t.titulo || "Sem título"}</strong>
              <button type="button" class="botao-icone" title="Apagar este trabalho" aria-label="Apagar ${t.titulo || "este trabalho"}"
                @click=${() => apagarTrabalho(t)}><wop-icone nome="lixo"></wop-icone></button>
            </div>
          </li>`)
      : html`<li class="portfolio-vazio">Ainda não tens trabalhos. Começa pelo de que mais te orgulhas.</li>`,
    $("#listaPortfolio")
  );
}

async function apagarTrabalho(t) {
  if (!(await confirmar({ titulo: "Apagar este trabalho?", texto: t.titulo, sim: "Apagar", perigo: true }))) return;
  const { error } = await sb.from("portfolio").delete().eq("id", t.id);
  if (error) return avisar(traduzirErro(error), "erro");
  await apagarImagem(PASTAS.portfolio, t.caminho);
  trabalhos = trabalhos.filter((x) => x.id !== t.id);
  desenharPortfolio();
  avisar("Trabalho apagado.");
}

// Pré-visualização da imagem escolhida antes de enviar.
$("#ficheiroTrabalho").addEventListener("change", (evento) => {
  const ficheiro = evento.target.files[0];
  const previa = $("#previaTrabalho");
  if (previa.src) URL.revokeObjectURL(previa.src);
  previa.hidden = !ficheiro;
  $("#zonaFicheiro").classList.toggle("com-imagem", Boolean(ficheiro));
  if (ficheiro) previa.src = URL.createObjectURL(ficheiro);
});

$("#formPortfolio").addEventListener("submit", (evento) => {
  evento.preventDefault();
  const form = evento.currentTarget;
  const ficheiro = $("#ficheiroTrabalho").files[0];
  if (!ficheiro) return avisar("Escolhe primeiro uma imagem.", "erro");
  aCarregar(form.querySelector("[type=submit]"), "A enviar…", async () => {
    try {
      const blob = await reduzirImagem(ficheiro, { lado: 1600 });
      const caminho = await enviarImagem(PASTAS.portfolio, user.id, blob, crypto.randomUUID());
      const { data, error } = await sb.from("portfolio").insert({
        perfil_id: user.id,
        caminho,
        titulo: form.elements.titulo.value.trim(),
        descricao: form.elements.descricao.value.trim(),
      }).select().single();
      if (error) {
        await apagarImagem(PASTAS.portfolio, caminho);
        throw error;
      }
      trabalhos.unshift(data);
      form.reset();
      $("#ficheiroTrabalho").dispatchEvent(new Event("change"));
      desenharPortfolio();
      avisar("Trabalho acrescentado ao portfólio.");
    } catch (e) {
      avisar(e.code === "P0001" || e.message?.startsWith("Escolhe") || e.message?.startsWith("A imagem") ? e.message : traduzirErro(e), "erro");
    }
  });
});

if (freelancer) carregarPortfolio();

/* ── Pagamentos ──────────────────────────────────────────────── */

$("#explicacaoPagamentos").textContent = freelancer
  ? "Os pagamentos dos teus projetos. O dinheiro fica retido até o cliente confirmar a entrega; depois enviamos-te o valor menos 5 % de comissão."
  : "O que pagaste pela plataforma. O dinheiro fica retido até confirmares a entrega e só depois é enviado ao freelancer.";

sb.from("pagamentos")
  .select("id, estado, valor, moeda, valor_freelancer, criado_em, projeto:projetos(titulo)")
  .in("estado", ["retido", "libertado", "reembolsado"])
  .order("criado_em", { ascending: false })
  .then(({ data, error }) => {
    if (error) return;
    pintar(
      data.length
        ? data.map((g) => html`<li>
            <span class="pagamento-titulo"><strong>${g.projeto?.titulo || "Projeto apagado"}</strong><small>${dataCurta(g.criado_em)}</small></span>
            <span class="valor">${dinheiro(freelancer ? g.valor_freelancer : g.valor, g.moeda)}</span>
            ${etiquetaPagamento(g.estado)}
          </li>`)
        : html`<li class="portfolio-vazio">Ainda não há pagamentos.</li>`,
      $("#listaPagamentos")
    );
  });
