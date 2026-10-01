import "../arranque.js";
import { sb, ok } from "../nucleo/supabase.js";
import { exigirSessao } from "../nucleo/sessao.js";
import { $, avisar, aplicarTema, temaGuardado, pedirSenha, aCarregar } from "../nucleo/ui.js";
import { CATEGORIAS, MOEDAS, listaCompetencias, traduzirErro } from "../nucleo/formato.js";

const { user, perfil } = await exigirSessao();
const freelancer = perfil.tipo === "freelancer";

// Veio do link «esqueci-me da palavra-passe»: não se pede a atual.
const recuperacao = new URLSearchParams(location.search).has("recuperar");

/* ── Preencher ───────────────────────────────────────────────── */

$("#area").innerHTML =
  '<option value="">Escolhe</option>' + Object.entries(CATEGORIAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
$("#moeda").innerHTML = Object.entries(MOEDAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");

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

sb.from("contas").select("telefone").eq("id", user.id).maybeSingle()
  .then(({ data }) => ($("#telefone").value = data?.telefone || ""));

$("#tema").value = temaGuardado();
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
  const { error } = await sb.from("contas").update({ telefone: $("#telefone").value.trim() }).eq("id", user.id);
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
