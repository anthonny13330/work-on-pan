# Work on Pan

Plataforma onde **clientes** publicam projetos e **freelancers** enviam propostas.
Web nativa moderna, **sem passo de build**: HTML + CSS + módulos ES, com [Supabase](https://supabase.com)
(Postgres, Auth, Realtime) e alojamento na Vercel.

## Páginas

| Endereço | Quem | O que faz |
| --- | --- | --- |
| `/` | todos | Página de entrada: o que é, como funciona, projetos recentes, perguntas frequentes. |
| `/projetos` | todos | Projetos abertos com filtros no endereço. `?p=<id>` abre um projeto (link partilhável). Freelancers enviam propostas. |
| `/painel` | com sessão | Cliente: projetos, propostas recebidas (aceitar e pagar pelo PayPal, recusar), confirmar entrega e libertar pagamento, publicar, procurar freelancers. Freelancer: propostas (editar, retirar, reenviar) e estado dos pagamentos. |
| `/mensagens` | com sessão | Conversas em tempo real, filtro «por ler», contador no cabeçalho. |
| `/conta` | com sessão | Fotografia, perfil público, portfólio (freelancer), dados privados e e-mail PayPal, tema, palavra-passe, histórico de pagamentos, exportar e apagar dados (RGPD). |
| `/perfil?id=<id>` | todos | Perfil público: apresentação, competências e portfólio (freelancer) ou projetos abertos (cliente). |
| `/entrar`, `/registar` | sem sessão | Entrar, recuperar palavra-passe, reenviar confirmação, criar conta. |
| `/privacidade`, `/termos` | todos | Política de privacidade (RGPD) e termos. |

Os endereços antigos (`/login`, `/cadastro`, `/chat`, `/definicoes`) redirecionam para os novos (`vercel.json`).

## Estrutura

```
*.html                 uma página por endereço (cleanUrls da Vercel)
css/
  base.css             @layer reset, tokens (cores claro/escuro), base, utilitários; tipografia fluida até TV
  componentes.css      botões, cartões, formulários, janelas, cabeçalho, rodapé (container queries)
  paginas.css          estilos de cada página
js/
  config.js            URL e chave pública do Supabase, dados do responsável RGPD
  arranque.js          importado por todas as páginas: componentes + tema
  tema-inicial.js      corre antes de pintar, para não piscar no tema errado
  nucleo/              supabase, sessão, modelos HTML (lit-html), formatação, interface
  componentes/         <wop-topo>, <wop-rodape>, <wop-logo>, <wop-icone> e o cursor-panela (Web Components)
  paginas/             um módulo por página
vendor/                lit-html e supabase-js servidos pelo próprio site (sem CDN)
fontes/                Inter (texto), Space Grotesk (títulos) e Kalam (anotações), auto-alojadas
supabase/esquema.sql   esquema completo da base de dados
```

**Identidade visual**

- Paleta «cobre e ferro fundido»: escuro `#141210` com cobre `#C8733A`; claro em pedra `#F4F1EC` com cobre escuro `#A4561F`. Tudo em tokens no `base.css`.
- Logótipo: uma panela vista de cima; o cabo é a seta do rato e o vapor desenha o W. Abaixo de 24 px usa a versão ótica.
- Ícones literais com um único pormenor a cobre (`<wop-icone nome="…">`).
- Marcador amarelo só em títulos, um por ecrã, com o texto sempre carvão.
- Surpresas: panela no carregamento (`carregador()`) e vapor ao publicar (`vaporar()`). O cursor-panela só aparece em zonas com `data-cursor-panela`, com rato. Tudo se desliga com «reduzir movimento».

**Princípios**

- Nada de `innerHTML` com dados do utilizador: os modelos `html\`…\`` do lit-html escapam tudo.
- Nada de `onclick` no HTML: eventos ligados nos módulos (`@click=${…}`).
- Confirmações com `<dialog>` próprio (`confirmar()`, `pedirSenha()`), nunca `confirm()`/`prompt()`.
- Responsivo por conteúdo: `clamp()`, `auto-fit`/`minmax`, container queries; a raiz cresce em ecrãs ≥1800px (TV).
- Progressivo: View Transitions entre páginas, Speculation Rules para pré-carregar, `animation-timeline: view()`
  para revelar ao rolar — quem não suporta vê a página normal.
- Acessível: link «saltar para o conteúdo», separadores com setas, foco visível (maior na TV), `prefers-reduced-motion`.
- Segurança: CSP restrita (só o próprio site e o Supabase), HSTS, `nosniff`, RLS em todas as tabelas.

## Base de dados

Ver [`supabase/esquema.sql`](supabase/esquema.sql). Chaves estrangeiras com `on delete cascade`, RLS em todas as tabelas,
regras de negócio em funções (`enviar_proposta`, `responder_proposta`, `retirar_proposta`, `abrir_conversa`,
`marcar_conversa_lida`, `exportar_os_meus_dados`, `apagar_a_minha_conta`) e gatilhos para as invariantes.

[`supabase/02_pagamentos_e_imagens.sql`](supabase/02_pagamentos_e_imagens.sql) acrescenta os pagamentos retidos
(tabela `pagamentos`, só escrita pela função do servidor), o e-mail PayPal em `contas`, a fotografia em `perfis`, a tabela
`portfolio` e os baldes de imagens `avatares` e `portfolio` (cada pessoa só escreve na sua pasta).

## Correr localmente

Qualquer servidor estático serve, mas os endereços limpos (`/painel`) precisam de reescrita para `painel.html`.
O mais simples é `npx vercel dev`.

## Configuração no painel do Supabase

1. **Authentication → URL Configuration**: *Site URL* `https://work-on-pan.vercel.app` e, em *Redirect URLs*,
   `https://work-on-pan.vercel.app/**`. Sem isto os e-mails de confirmação e recuperação apontam para outro site.
2. **Authentication → Password security**: ligar a proteção contra palavras-passe vazadas.
3. Em `js/config.js`, preencher `RESPONSAVEL_DADOS` e `CONTACTO_PRIVACIDADE`.

O plano gratuito pausa o projeto ao fim de uma semana sem uso; se o site deixar de carregar dados, reativa-o no painel.

## Pagamentos (PayPal sandbox) e imagens — como ativar

O dinheiro circula assim: o cliente aceita uma proposta **pagando-a** pelo PayPal → o valor fica **retido** na conta da
plataforma → quando o cliente confirma a entrega, a função do servidor envia ao freelancer o valor **menos 8 %**
(PayPal Payouts). Quem fala com o PayPal é só a Edge Function [`supabase/functions/pagamentos`](supabase/functions/pagamentos/index.ts);
as chaves nunca vão para o browser.

**Ordem certa (antes de juntar este ramo ao `main`):**

1. **Base de dados:** Supabase → SQL Editor → cola e corre `supabase/02_pagamentos_e_imagens.sql` e depois `supabase/03_comissao_8.sql` (cada um uma vez).
2. **Credenciais PayPal sandbox:** em [developer.paypal.com](https://developer.paypal.com) → *Apps & Credentials* →
   separador *Sandbox* → *Create App* (tipo Merchant). Copia o *Client ID* e o *Secret*. Em *Testing Tools → Sandbox Accounts*
   tens uma conta *Personal* (para pagar como cliente) e podes criar outra para usar como e-mail PayPal de um freelancer.
3. **Segredos da função:** Supabase → Edge Functions → *Secrets* → acrescenta `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`,
   `PAYPAL_AMBIENTE` = `sandbox` e `SITE_URL` = `https://work-on-pan.vercel.app`.
4. **Publicar a função:** Supabase → Edge Functions → *Deploy a new function* → *Via Editor*, nome `pagamentos`,
   cola o conteúdo de `supabase/functions/pagamentos/index.ts` e publica (com «Verify JWT» ligado).
   Com a CLI: `supabase functions deploy pagamentos`.
5. Junta o ramo ao `main`.

**Para passar a dinheiro real:** troca as credenciais pelas de *Live*, `PAYPAL_AMBIENTE` = `live` e, em `js/config.js`,
`PAGAMENTOS_MODO = "live"`. Antes disso, confirma com um contabilista/jurista: reter dinheiro de terceiros num marketplace
na UE pode exigir o produto de marketplaces do PayPal (Commerce Platform) ou licença de instituição de pagamento, e os
registos de pagamento podem ter de ser guardados pelo prazo fiscal.
