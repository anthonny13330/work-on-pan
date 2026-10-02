import "../arranque.js";
import { html, pintar, nothing, repeat, live } from "../nucleo/html.js";
import { sb } from "../nucleo/supabase.js";
import { exigirSessao, aoMudar, conversaPorLer } from "../nucleo/sessao.js";
import { $, $$, avisar, animarEntrada, etiquetaProjeto } from "../nucleo/ui.js";
import { dinheiro, horaCurta, iniciais, nomeCliente, nomeCompleto, traduzirErro } from "../nucleo/formato.js";

const { user, perfil } = await exigirSessao();

const CAMPOS = `*,
  cliente:perfis!conversas_cliente_id_fkey(nome, sobrenome, empresa),
  freelancer:perfis!conversas_freelancer_id_fkey(nome, sobrenome),
  projeto:projetos(id, titulo, estado, categoria, orcamento, moeda, prazo_dias)`;

const estado = {
  conversas: [],
  filtro: "todas",
  ativa: new URLSearchParams(location.search).get("c"),
  mensagens: [],
  mostradas: null, // ids já desenhados: só as que chegam depois são animadas
  canal: null,
  rascunho: "",
};

const caixa = $("#caixa");
const outraPessoa = (c) => (c.cliente_id === user.id ? nomeCompleto(c.freelancer) : nomeCliente(c.cliente));

/* ── Lista de conversas ──────────────────────────────────────── */

async function carregarConversas() {
  const { data, error } = await sb.from("conversas").select(CAMPOS).order("ultima_mensagem_em", { ascending: false });
  if (error) {
    console.error("[Work on Pan] conversas:", error);
    pintar(html`<li class="vazio texto-pequeno">Não foi possível carregar as conversas. ${traduzirErro(error)}</li>`, $("#listaConversas"));
    return;
  }
  estado.conversas = data;
  desenharLista();
  if (estado.ativa) {
    if (data.some((c) => c.id === estado.ativa)) abrirConversa(estado.ativa, { historico: false });
    else fecharConversa();
  }
}

function filtrarConversas() {
  const termo = $("#pesquisaConversas").value.trim().toLowerCase();
  return estado.conversas.filter((c) => {
    if (termo && !`${outraPessoa(c)} ${c.projeto?.titulo || ""}`.toLowerCase().includes(termo)) return false;
    if (estado.filtro === "por-ler") return conversaPorLer(c, user.id);
    if (estado.filtro === "projetos") return Boolean(c.projeto_id);
    return true;
  });
}

const itemConversa = (c) => {
  const nome = outraPessoa(c);
  const porLer = conversaPorLer(c, user.id);
  return html`
    <li class=${porLer ? "por-ler" : ""}>
      <button type="button" aria-current=${c.id === estado.ativa ? "true" : nothing} @click=${() => abrirConversa(c.id)}>
        <span class="avatar" aria-hidden="true">${iniciais(nome)}</span>
        <span class="conversa-nome">${nome}${porLer ? html`<span class="so-leitores"> (por ler)</span>` : nothing}</span>
        <span class="conversa-hora">${horaCurta(c.ultima_mensagem_em)}</span>
        <span class="conversa-projeto">${c.projeto?.titulo || "Contacto direto"}</span>
        <span class="conversa-ultima">${c.ultimo_autor_id === user.id ? "Tu: " : ""}${c.ultima_mensagem}</span>
      </button>
    </li>
  `;
};

function desenharLista() {
  const lista = filtrarConversas();
  let conteudo;
  if (!estado.conversas.length) {
    conteudo = html`<li class="vazio texto-pequeno">
      ${perfil.tipo === "cliente"
        ? html`Ainda não tens conversas. Aparecem quando recebes uma proposta ou contactas um freelancer em
            <a href="/painel#freelancers">Procurar freelancers</a>.`
        : html`Ainda não tens conversas. Envia uma proposta num <a href="/projetos">projeto aberto</a>
            e a conversa com o cliente abre-se aqui.`}
    </li>`;
  } else if (!lista.length) {
    conteudo = html`<li class="vazio texto-pequeno">Nenhuma conversa neste filtro.</li>`;
  } else {
    conteudo = repeat(lista, (c) => c.id, itemConversa);
  }
  pintar(conteudo, $("#listaConversas"));
  animarEntrada($("#listaConversas"));
}

for (const botao of $$("[data-filtro]")) {
  botao.addEventListener("click", () => {
    estado.filtro = botao.dataset.filtro;
    for (const b of $$("[data-filtro]")) b.setAttribute("aria-pressed", b === botao);
    desenharLista();
  });
}
$("#pesquisaConversas").addEventListener("input", desenharLista);

/* ── Conversa aberta ─────────────────────────────────────────── */

async function abrirConversa(id, { historico = true } = {}) {
  const c = estado.conversas.find((x) => x.id === id);
  if (!c) return;
  const mudou = estado.ativa !== id || !estado.canal;
  estado.ativa = id;
  if (historico) history.replaceState(null, "", `/mensagens?c=${encodeURIComponent(id)}`);
  caixa.classList.add("com-conversa");
  desenharConversa(c);
  desenharLista();
  marcarComoLida(c);
  if (!mudou) return;

  if (estado.canal) sb.removeChannel(estado.canal);
  estado.mensagens = [];
  estado.mostradas = null;
  desenharMensagens();

  // As mensagens novas chegam em tempo real; o histórico vem de uma consulta.
  estado.canal = sb
    .channel(`mensagens-${id}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens", filter: `conversa_id=eq.${id}` },
      ({ new: m }) => {
        if (m.conversa_id !== estado.ativa || estado.mensagens.some((x) => x.id === m.id)) return;
        estado.mensagens.push(m);
        desenharMensagens();
      })
    .subscribe();

  const { data, error } = await sb.from("mensagens").select("*").eq("conversa_id", id).order("criado_em");
  if (estado.ativa !== id) return;
  if (error) return avisar("Não foi possível carregar as mensagens.", "erro");
  const vistas = new Set(data.map((m) => m.id));
  estado.mensagens = [...data, ...estado.mensagens.filter((m) => !vistas.has(m.id))];
  desenharMensagens(true);
  $("#textoMensagem")?.focus({ preventScroll: true });
}

function desenharConversa(c) {
  const nome = outraPessoa(c);
  const p = c.projeto;
  pintar(
    html`
      <div class="conversa-topo">
        <button type="button" class="voltar-lista" @click=${fecharConversa}><wop-icone nome="voltar"></wop-icone> Conversas</button>
        <div class="pessoa">
          <span class="avatar" aria-hidden="true">${iniciais(nome)}</span>
          <div style="min-width: 0">
            <strong>${nome}</strong>
            <small>${p ? html`<wop-icone nome=${p.categoria || "projetos"}></wop-icone> ${p.titulo}` : "Contacto direto"}</small>
          </div>
        </div>
      </div>
      ${p
        ? html`<div class="contexto-projeto">
            ${etiquetaProjeto(p.estado)}
            <span class="contexto-facto"><wop-icone nome="orcamento"></wop-icone>${dinheiro(p.orcamento, p.moeda)}</span>
            <span class="contexto-facto"><wop-icone nome="prazo"></wop-icone>${p.prazo_dias} dias</span>
            <a href="/painel">${perfil.tipo === "cliente" ? "Ver propostas" : "Ver a minha proposta"} <wop-icone nome="seta"></wop-icone></a>
          </div>`
        : nothing}
      <div class="mensagens" id="mensagens" role="log" aria-live="polite" aria-label="Mensagens com ${nome}"></div>
      <form class="escrever" @submit=${enviar}>
        <label for="textoMensagem" class="so-leitores">Escrever mensagem</label>
        <textarea id="textoMensagem" rows="1" maxlength="4000" placeholder="Escreve uma mensagem…"
          .value=${live(estado.rascunho)}
          @input=${(e) => (estado.rascunho = e.target.value)}
          @keydown=${(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
              e.preventDefault();
              e.target.form.requestSubmit();
            }
          }}></textarea>
        <button type="submit" class="botao botao-principal botao-enviar" aria-label="Enviar mensagem"><wop-icone nome="enviar"></wop-icone><span>Enviar</span></button>
      </form>
      <p class="dica-escrever"><wop-icone nome="escudo"></wop-icone>
        Enter envia · Shift+Enter muda de linha · Nunca partilhes palavras-passe nem dados bancários.</p>
    `,
    $("#painelConversa")
  );
}

function desenharMensagens(forcarFundo = false) {
  const alvo = $("#mensagens");
  if (!alvo) return;
  const noFundo = forcarFundo || alvo.scrollHeight - alvo.scrollTop - alvo.clientHeight < 80;
  const primeira = estado.mostradas === null;
  pintar(
    repeat(estado.mensagens, (m) => m.id, (m) => {
      const classe = m.autor_id === null ? "sistema" : m.autor_id === user.id ? "minha" : "outra";
      const nova = !primeira && !estado.mostradas.has(m.id);
      return html`<div class="msg ${classe} ${nova ? "nova" : ""}">${m.texto}${classe === "sistema"
        ? nothing
        : html`<time datetime=${m.criado_em}>${horaCurta(m.criado_em)}</time>`}</div>`;
    }),
    alvo
  );
  if (estado.mensagens.length) estado.mostradas = new Set(estado.mensagens.map((m) => m.id));
  if (noFundo) alvo.scrollTop = alvo.scrollHeight;
}

let ultimaMarcacao = 0;
async function marcarComoLida(c) {
  if (!conversaPorLer(c, user.id) || document.hidden) return;
  if (Date.now() - ultimaMarcacao < 2000) return;
  ultimaMarcacao = Date.now();
  await sb.rpc("marcar_conversa_lida", { p_conversa: c.id });
  dispatchEvent(new Event("wop:lidas")); // o cabeçalho atualiza o contador
}

function fecharConversa() {
  if (estado.canal) sb.removeChannel(estado.canal);
  estado.canal = null;
  estado.ativa = null;
  history.replaceState(null, "", "/mensagens");
  caixa.classList.remove("com-conversa");
  desenharLista();
}

async function enviar(evento) {
  evento.preventDefault();
  const texto = estado.rascunho.trim();
  if (!texto || !estado.ativa) return;
  estado.rascunho = "";
  desenharConversa(estado.conversas.find((c) => c.id === estado.ativa));
  const { data, error } = await sb
    .from("mensagens")
    .insert({ conversa_id: estado.ativa, autor_id: user.id, texto })
    .select()
    .single();
  if (error) {
    estado.rascunho = texto;
    desenharConversa(estado.conversas.find((c) => c.id === estado.ativa));
    return avisar(`A mensagem não foi enviada. ${traduzirErro(error)}`, "erro");
  }
  if (!estado.mensagens.some((m) => m.id === data.id)) estado.mensagens.push(data);
  desenharMensagens(true);
}

document.addEventListener("visibilitychange", () => {
  const c = estado.conversas.find((x) => x.id === estado.ativa);
  if (c && !document.hidden) marcarComoLida(c);
});

await carregarConversas();
aoMudar(["conversas"], carregarConversas);
