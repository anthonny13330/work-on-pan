# Work on Pan

Plataforma simples onde **clientes** publicam projetos e **freelancers** enviam propostas.
HTML + CSS + JavaScript sem build, com [Supabase](https://supabase.com) (Postgres, Auth, Realtime) e alojamento na Vercel.

## Páginas

| Página | Quem | O que faz |
| --- | --- | --- |
| `projetos.html` | todos | Projetos abertos. Freelancers com sessão enviam propostas. |
| `index.html` | com sessão | Painel. Cliente: os seus projetos, propostas recebidas (aceitar/recusar), publicar, procurar freelancers. Freelancer: as suas propostas (editar, retirar, reenviar). |
| `chat.html` | com sessão | Caixa de mensagens em tempo real: conversas por projeto ou diretas, filtro «por ler», contador no menu. |
| `definicoes.html` | com sessão | Perfil público, dados privados, tema, palavra-passe, exportar e apagar dados (RGPD). |
| `login.html`, `cadastro.html` | sem sessão | Entrar, recuperar palavra-passe e criar conta (com consentimento dos termos e privacidade). |
| `privacidade.html`, `termos.html` | todos | Política de privacidade (RGPD) e termos de utilização. |

Código partilhado: `app.js` (sessão, cabeçalho, rodapé, utilitários), `styles.css` e `supabase-config.js` (URL e chave pública).

## Base de dados

O esquema completo está em [`supabase/esquema.sql`](supabase/esquema.sql).

```
auth.users ─1:1─ perfis (público) ─1:1─ contas (privado: telefone, consentimento)
perfis(cliente) ─1:N─ projetos ─1:N─ propostas ─N:1─ perfis(freelancer)
conversas (cliente × freelancer × projeto opcional) ─1:N─ mensagens
```

- Chaves estrangeiras com `on delete cascade`: apagar uma conta apaga tudo o que lhe pertence.
- Segurança por linha (RLS) em todas as tabelas; o browser só pode escrever o próprio perfil, os próprios projetos e mensagens nas suas conversas.
- As ações com regras de negócio são funções no servidor (`/rest/v1/rpc/...`):
  `enviar_proposta`, `retirar_proposta`, `responder_proposta` (aceitar/recusar), `abrir_conversa`,
  `marcar_conversa_lida`, `exportar_os_meus_dados`, `apagar_a_minha_conta`.
- Gatilhos: criam o perfil no registo, mantêm o resumo da conversa, fecham propostas pendentes quando o projeto fecha
  e impedem mudanças de estado inválidas.

## Configuração no painel do Supabase

1. **Authentication → URL Configuration**: em *Site URL* põe o domínio da Vercel (ex.: `https://work-on-pan.vercel.app`)
   e acrescenta-o também em *Redirect URLs* (`https://work-on-pan.vercel.app/**`). Sem isto, os links de confirmação
   de e-mail e de recuperação de palavra-passe apontam para `localhost`.
2. **Authentication → Emails**: traduz os modelos de e-mail para português, se quiseres.
3. Em `app.js`, preenche `RESPONSAVEL_DADOS` e `CONTACTO_PRIVACIDADE` (política de privacidade e rodapé).

O plano gratuito pausa o projeto ao fim de uma semana sem uso; se o site deixar de carregar dados, reativa-o no painel.
