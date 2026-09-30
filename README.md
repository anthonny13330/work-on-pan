# Work on Pan

Plataforma simples onde **clientes** publicam projetos e **freelancers** enviam propostas.
HTML + CSS + JavaScript sem build, com Firebase (Auth + Firestore) e alojamento na Vercel.

## Páginas

| Página | Quem | O que faz |
| --- | --- | --- |
| `projetos.html` | todos | Projetos abertos. Freelancers com sessão enviam propostas. |
| `index.html` | com sessão | Painel. Cliente: os seus projetos, propostas recebidas (aceitar/recusar), publicar, procurar freelancers. Freelancer: as suas propostas (editar/retirar). |
| `chat.html` | com sessão | Caixa de mensagens: conversas por projeto ou diretas, filtro «por ler», contador no menu. |
| `definicoes.html` | com sessão | Perfil público, dados privados, tema, palavra-passe, exportar e apagar dados (RGPD). |
| `login.html`, `cadastro.html` | sem sessão | Entrar e criar conta (com consentimento dos termos e privacidade). |
| `privacidade.html`, `termos.html` | todos | Política de privacidade (RGPD) e termos de utilização. |

Código partilhado: `app.js` (sessão, cabeçalho, rodapé, utilitários, conversas) e `styles.css`.

## Base de dados (Firestore)

```
users/{uid}            privado: e-mail, telefone, tipo, consentimento   (só o próprio lê)
perfis/{uid}           público: nome, área, bio, competências…          (todos leem)
projetos/{id}          clienteId, titulo, descricao, orcamento, moeda, prazoDias, estado
                       estado: aberto → em_andamento → concluido  (ou fechado)
propostas/{projetoId}_{freelancerId}
                       uma por freelancer e projeto; estado: pendente | aceite | recusada | retirada | fechada
chats/{id}             p_{projetoId}_{freelancerId}  ou  d_{uidA}_{uidB}
chats/{id}/mensagens   autor (uid ou "sistema"), texto, hora
```

Nenhuma consulta usa `where` + `orderBy` juntos, por isso **não é preciso criar índices compostos**
(era isso que fazia os projetos do cliente não aparecerem).

## Antes de publicar

1. Em `app.js`, preenche `RESPONSAVEL_DADOS` e `CONTACTO_PRIVACIDADE` (aparecem na política de privacidade e no rodapé).
2. Publica as regras: Firebase Console → Firestore Database → Regras → cola o `firestore.rules` → Publicar
   (ou `firebase deploy --only firestore:rules`).

## Limpar os dados antigos

Os projetos, propostas e conversas antigos usam campos de uma versão anterior. Para começar do zero, apaga as coleções
na Firebase Console (Firestore Database → clica nos três pontos da coleção → Eliminar coleção) ou com a Firebase CLI:

```bash
firebase firestore:delete projetos  --recursive --project work-on-pan
firebase firestore:delete propostas --recursive --project work-on-pan
firebase firestore:delete chats     --recursive --project work-on-pan
```

As contas (`users`) podem ficar: o perfil público (`perfis`) é criado automaticamente no próximo login.
