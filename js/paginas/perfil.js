// Perfil público (/perfil?id=…): apresentação, competências e portfólio de um freelancer,
// ou os projetos abertos de um cliente. Qualquer visitante pode ver.
import "../arranque.js";
import { html, pintar, nothing } from "../nucleo/html.js";
import { sb } from "../nucleo/supabase.js";
import { sessao, sessaoPronta, irParaConversa } from "../nucleo/sessao.js";
import { $, avatar, avisar, estadoVazio } from "../nucleo/ui.js";
import { PASTAS, urlImagem } from "../nucleo/imagens.js";
import { dinheiro, dataCurta, nomeCategoria, nomeCliente, nomeCompleto } from "../nucleo/formato.js";

const id = new URLSearchParams(location.search).get("id") || "";
const janela = $("#janelaTrabalho");
const estado = { perfil: null, trabalhos: [], projetos: [], aberto: -1 };

const mesAno = (d) => new Date(d).toLocaleDateString("pt-PT", { month: "long", year: "numeric" });

async function carregar() {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return naoEncontrado();
  const { data: perfil } = await sb
    .from("perfis")
    .select("id, tipo, nome, sobrenome, area, bio, valor_hora, moeda, competencias, disponivel, empresa, segmento, foto, criado_em")
    .eq("id", id)
    .maybeSingle();
  if (!perfil) return naoEncontrado();
  estado.perfil = perfil;
  document.title = `${perfil.tipo === "cliente" ? nomeCliente(perfil) : nomeCompleto(perfil)} · Work on Pan`;

  const [trabalhos, projetos] = await Promise.all([
    perfil.tipo === "freelancer"
      ? sb.from("portfolio").select("*").eq("perfil_id", id).order("criado_em", { ascending: false })
      : { data: [] },
    perfil.tipo === "cliente"
      ? sb.from("projetos").select("id, titulo, categoria, orcamento, moeda, prazo_dias, criado_em").eq("cliente_id", id).eq("estado", "aberto").order("criado_em", { ascending: false })
      : { data: [] },
  ]);
  estado.trabalhos = trabalhos.data || [];
  estado.projetos = projetos.data || [];
  await sessaoPronta;
  desenhar();
}

function naoEncontrado() {
  pintar(
    estadoVazio({
      titulo: "Este perfil não existe",
      texto: "Pode ter sido apagado, ou o link está incompleto.",
      acao: html`<a class="botao botao-principal" href="/projetos">Ver projetos abertos</a>`,
    }),
    $("#perfil")
  );
}

/* ── Ações ───────────────────────────────────────────────────── */

async function partilhar() {
  const dados = { title: document.title, url: location.href };
  try {
    if (navigator.share) return await navigator.share(dados);
    await navigator.clipboard.writeText(location.href);
    avisar("Link do perfil copiado.");
  } catch (e) {
    if (e.name !== "AbortError") avisar("Não foi possível partilhar. Copia o endereço da barra.", "erro");
  }
}

function acoes(p) {
  const eu = sessao.user?.id === p.id;
  const podeFalar = sessao.perfil && !eu && sessao.perfil.tipo !== p.tipo;
  return html`
    ${eu ? html`<a class="botao botao-heroi" href="/conta#perfil"><wop-icone nome="editar"></wop-icone> Editar o meu perfil</a>` : nothing}
    ${podeFalar
      ? html`<button type="button" class="botao botao-heroi" @click=${() => irParaConversa(p.id)}><wop-icone nome="mensagens"></wop-icone> Enviar mensagem</button>`
      : nothing}
    ${!sessao.perfil
      ? html`<a class="botao botao-heroi" href="/entrar?volta=${encodeURIComponent(location.pathname + location.search)}"><wop-icone nome="mensagens"></wop-icone> Entrar para falar</a>`
      : nothing}
    <button type="button" class="botao botao-heroi-contorno" @click=${partilhar}><wop-icone nome="partilhar"></wop-icone> Partilhar</button>
  `;
}

/* ── Desenho ─────────────────────────────────────────────────── */

function desenhar() {
  const p = estado.perfil;
  const freelancer = p.tipo === "freelancer";
  const nome = freelancer ? nomeCompleto(p) : nomeCliente(p);
  pintar(
    html`
      <header class="faixa-perfil">
        ${avatar(p, "avatar-enorme")}
        <div class="faixa-perfil-texto">
          <p class="sobretitulo com-icone">
            ${freelancer
              ? html`<wop-icone nome=${p.area || "outro"}></wop-icone>Freelancer${p.area ? html` · ${nomeCategoria(p.area)}` : nothing}`
              : html`<wop-icone nome="empresa"></wop-icone>Cliente${p.segmento ? html` · ${p.segmento}` : nothing}`}
          </p>
          <h1>${nome}</h1>
          <ul class="meta meta-icones">
            ${freelancer
              ? html`<li><span class="disponibilidade ${p.disponivel ? "sim" : ""}">${p.disponivel ? "Disponível para novos projetos" : "Sem disponibilidade de momento"}</span></li>
                  ${p.valor_hora ? html`<li><wop-icone nome="orcamento"></wop-icone>${dinheiro(p.valor_hora, p.moeda)} por hora</li>` : nothing}`
              : nothing}
            <li><wop-icone nome="estrela"></wop-icone>No Work on Pan desde ${mesAno(p.criado_em)}</li>
          </ul>
          <div class="acoes">${acoes(p)}</div>
        </div>
      </header>

      ${freelancer ? sobre(p) : nothing}
      ${freelancer ? portfolio() : projetosDoCliente()}
    `,
    $("#perfil")
  );
  $("#perfil").removeAttribute("aria-busy");
}

const sobre = (p) => html`
  <section class="cartao perfil-sobre" aria-labelledby="tituloSobre">
    <h2 id="tituloSobre" class="titulo-secao-icone"><wop-icone nome="perfil"></wop-icone> Sobre</h2>
    <p class="perfil-bio">${p.bio || "Ainda sem apresentação."}</p>
    ${p.competencias.length ? html`<ul class="competencias">${p.competencias.map((c) => html`<li>${c}</li>`)}</ul>` : nothing}
  </section>
`;

function portfolio() {
  const t = estado.trabalhos;
  return html`
    <section class="perfil-portfolio" aria-labelledby="tituloPortfolio">
      <div class="cabecalho-secao">
        <h2 id="tituloPortfolio">Portfólio</h2>
        <span class="texto-suave texto-pequeno">${t.length ? `${t.length} ${t.length === 1 ? "trabalho" : "trabalhos"}` : ""}</span>
      </div>
      ${t.length
        ? html`<ul class="galeria">
            ${t.map((x, i) => html`<li>
              <button type="button" class="galeria-item" @click=${() => abrirTrabalho(i)} aria-label="Ver ${x.titulo || "trabalho"} em grande">
                <img src=${urlImagem(PASTAS.portfolio, x.caminho)} alt=${x.titulo || ""} loading="lazy" decoding="async">
                ${x.titulo ? html`<span class="galeria-legenda">${x.titulo}</span>` : nothing}
              </button>
            </li>`)}
          </ul>`
        : estadoVazio({ texto: "Ainda não há trabalhos no portfólio." })}
    </section>
  `;
}

function projetosDoCliente() {
  const lista = estado.projetos;
  return html`
    <section aria-labelledby="tituloProjetos">
      <div class="cabecalho-secao"><h2 id="tituloProjetos">Projetos abertos</h2></div>
      ${lista.length
        ? html`<div class="lista-grelha">
            ${lista.map((p) => html`<article class="cartao cartao-projeto">
              <div class="item-topo">
                <span class="area-icone" data-area=${p.categoria}><wop-icone nome=${p.categoria}></wop-icone></span>
                <div class="item-topo-texto">
                  <p class="sobretitulo">${nomeCategoria(p.categoria)} · ${dataCurta(p.criado_em)}</p>
                  <h3><a class="item-titulo" href="/projetos?p=${p.id}">${p.titulo}</a></h3>
                </div>
              </div>
              <ul class="meta meta-icones">
                <li><wop-icone nome="orcamento"></wop-icone><strong class="valor">${dinheiro(p.orcamento, p.moeda)}</strong></li>
                <li><wop-icone nome="prazo"></wop-icone>${p.prazo_dias} dias</li>
              </ul>
            </article>`)}
          </div>`
        : estadoVazio({ texto: "Este cliente não tem projetos abertos de momento." })}
    </section>
  `;
}

/* ── Janela do trabalho (ver em grande) ──────────────────────── */

function abrirTrabalho(i) {
  estado.aberto = (i + estado.trabalhos.length) % estado.trabalhos.length;
  const t = estado.trabalhos[estado.aberto];
  const varios = estado.trabalhos.length > 1;
  pintar(
    html`
      <figure class="trabalho-grande">
        <img src=${urlImagem(PASTAS.portfolio, t.caminho)} alt=${t.titulo || ""}>
        <figcaption>
          <div>
            <h2 id="jtTitulo">${t.titulo || "Sem título"}</h2>
            ${t.descricao ? html`<p class="texto-suave">${t.descricao}</p>` : nothing}
          </div>
          <div class="acoes">
            ${varios
              ? html`<button type="button" class="botao-icone" aria-label="Anterior" @click=${() => abrirTrabalho(estado.aberto - 1)}><wop-icone nome="voltar"></wop-icone></button>
                  <span class="texto-suave texto-pequeno">${estado.aberto + 1} / ${estado.trabalhos.length}</span>
                  <button type="button" class="botao-icone" aria-label="Seguinte" @click=${() => abrirTrabalho(estado.aberto + 1)}><wop-icone nome="seta"></wop-icone></button>`
              : nothing}
            <button type="button" class="botao-icone" aria-label="Fechar" @click=${() => janela.close()}><wop-icone nome="fechar"></wop-icone></button>
          </div>
        </figcaption>
      </figure>
    `,
    janela
  );
  if (!janela.open) janela.showModal();
}

janela.addEventListener("click", (e) => e.target === janela && janela.close());
janela.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") abrirTrabalho(estado.aberto + 1);
  if (e.key === "ArrowLeft") abrirTrabalho(estado.aberto - 1);
});

carregar().catch((e) => {
  console.error("[Work on Pan] perfil:", e);
  naoEncontrado();
});
