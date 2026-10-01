# Work on Pan

Plataforma onde **clientes** publicam projetos e **freelancers** enviam propostas.
Web nativa moderna, **sem passo de build**: HTML + CSS + módulos ES, com [Supabase](https://supabase.com)
(Postgres, Auth, Realtime) e alojamento na Vercel.

## Páginas

| Endereço | Quem | O que faz |
| --- | --- | --- |
| `/` | todos | Página de entrada: o que é, como funciona, projetos recentes, perguntas frequentes. |
| `/projetos` | todos | Projetos abertos com filtros no endereço. `?p=<id>` abre um projeto (link partilhável). Freelancers enviam propostas. |
| `/painel` | com sessão | Cliente: projetos, propostas recebidas (aceitar/recusar), publicar, procurar freelancers. Freelancer: propostas (editar, retirar, reenviar). |
| `/mensagens` | com sessão | Conversas em tempo real, filtro «por ler», contador no cabeçalho. |
| `/conta` | com sessão | Perfil público, dados privados, tema, palavra-passe, exportar e apagar dados (RGPD). |
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
  componentes/         <wop-topo>, <wop-rodape>, <wop-logo> (Web Components)
  paginas/             um módulo por página
vendor/                lit-html e supabase-js servidos pelo próprio site (sem CDN)
fontes/                Inter (variável, auto-alojada)
supabase/esquema.sql   esquema completo da base de dados
```

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

## Correr localmente

Qualquer servidor estático serve, mas os endereços limpos (`/painel`) precisam de reescrita para `painel.html`.
O mais simples é `npx vercel dev`.

## Configuração no painel do Supabase

1. **Authentication → URL Configuration**: *Site URL* `https://work-on-pan.vercel.app` e, em *Redirect URLs*,
   `https://work-on-pan.vercel.app/**`. Sem isto os e-mails de confirmação e recuperação apontam para outro site.
2. **Authentication → Password security**: ligar a proteção contra palavras-passe vazadas.
3. Em `js/config.js`, preencher `RESPONSAVEL_DADOS` e `CONTACTO_PRIVACIDADE`.

O plano gratuito pausa o projeto ao fim de uma semana sem uso; se o site deixar de carregar dados, reativa-o no painel.
