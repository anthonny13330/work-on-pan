-- Work on Pan — esquema da base de dados (Supabase / Postgres)
--
-- Relações:
--   auth.users 1─1 perfis (público) 1─1 contas (privado)
--   perfis(cliente) 1─N projetos 1─N propostas N─1 perfis(freelancer)
--   conversas: cliente × freelancer (× projeto, opcional) 1─N mensagens
--
-- Apagar um utilizador em auth.users apaga em cascata o perfil, a conta,
-- os projetos, as propostas e as conversas dele (direito ao apagamento, RGPD).
--
-- Todas as alterações sensíveis (propostas, conversas, leitura) passam por
-- funções `security definer` que validam quem chama; as tabelas só aceitam
-- escrita direta onde isso é seguro (perfil próprio, projetos próprios, mensagens).

-- ── Tipos ──────────────────────────────────────────────────────────────
create type tipo_conta as enum ('cliente', 'freelancer');
create type estado_projeto as enum ('aberto', 'em_andamento', 'concluido', 'fechado');
create type estado_proposta as enum ('pendente', 'aceite', 'recusada', 'retirada', 'fechada');

-- ── Tabelas ────────────────────────────────────────────────────────────
create table perfis (
  id            uuid primary key references auth.users (id) on delete cascade,
  tipo          tipo_conta not null,
  nome          text not null check (char_length(nome) between 1 and 60),
  sobrenome     text not null default '' check (char_length(sobrenome) <= 60),
  -- freelancer
  area          text,
  bio           text not null default '' check (char_length(bio) <= 800),
  valor_hora    numeric(10, 2) check (valor_hora >= 0),
  moeda         text not null default 'EUR' check (moeda in ('EUR', 'BRL', 'USD', 'GBP')),
  competencias  text[] not null default '{}' check (cardinality(competencias) <= 15),
  disponivel    boolean not null default true,
  -- cliente
  empresa       text not null default '' check (char_length(empresa) <= 80),
  segmento      text not null default '' check (char_length(segmento) <= 60),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table perfis is 'Perfil público: visível para qualquer visitante.';

create table contas (
  id            uuid primary key references auth.users (id) on delete cascade,
  telefone      text not null default '' check (char_length(telefone) <= 20),
  consentimento jsonb not null default '{}',
  criado_em     timestamptz not null default now()
);
comment on table contas is 'Dados privados: só o próprio utilizador lê e altera.';

create table projetos (
  id                 uuid primary key default gen_random_uuid(),
  cliente_id         uuid not null references perfis (id) on delete cascade,
  titulo             text not null check (char_length(titulo) between 5 and 120),
  descricao          text not null check (char_length(descricao) between 30 and 4000),
  categoria          text not null,
  orcamento          numeric(12, 2) not null check (orcamento > 0),
  moeda              text not null default 'EUR' check (moeda in ('EUR', 'BRL', 'USD', 'GBP')),
  prazo_dias         int not null check (prazo_dias between 1 and 365),
  competencias       text[] not null default '{}' check (cardinality(competencias) <= 12),
  estado             estado_projeto not null default 'aberto',
  freelancer_id      uuid references perfis (id) on delete set null,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);
create index projetos_cliente_idx on projetos (cliente_id);
create index projetos_estado_idx on projetos (estado, criado_em desc);

create table propostas (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid not null references projetos (id) on delete cascade,
  freelancer_id  uuid not null references perfis (id) on delete cascade,
  valor          numeric(12, 2) not null check (valor > 0),
  moeda          text not null default 'EUR' check (moeda in ('EUR', 'BRL', 'USD', 'GBP')),
  prazo_entrega  int not null check (prazo_entrega between 1 and 365),
  mensagem       text not null check (char_length(mensagem) between 20 and 3000),
  estado         estado_proposta not null default 'pendente',
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (projeto_id, freelancer_id)
);
create index propostas_freelancer_idx on propostas (freelancer_id);

create table conversas (
  id                  uuid primary key default gen_random_uuid(),
  cliente_id          uuid not null references perfis (id) on delete cascade,
  freelancer_id       uuid not null references perfis (id) on delete cascade,
  projeto_id          uuid references projetos (id) on delete set null,
  ultima_mensagem     text not null default '',
  ultima_mensagem_em  timestamptz not null default now(),
  ultimo_autor_id     uuid,
  lido_cliente_em     timestamptz,
  lido_freelancer_em  timestamptz,
  criado_em           timestamptz not null default now(),
  check (cliente_id <> freelancer_id),
  unique nulls not distinct (cliente_id, freelancer_id, projeto_id)
);
create index conversas_cliente_idx on conversas (cliente_id);
create index conversas_freelancer_idx on conversas (freelancer_id);

create table mensagens (
  id           bigint generated always as identity primary key,
  conversa_id  uuid not null references conversas (id) on delete cascade,
  autor_id     uuid references perfis (id) on delete cascade, -- null = mensagem do sistema
  texto        text not null check (char_length(texto) between 1 and 4000),
  criado_em    timestamptz not null default now()
);
create index mensagens_conversa_idx on mensagens (conversa_id, criado_em);

-- ── Funções auxiliares ─────────────────────────────────────────────────
create function tipo_de(uid uuid) returns tipo_conta
language sql stable security definer set search_path = public
as $$ select tipo from perfis where id = uid $$;

create function e_participante(conversa uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from conversas c
    where c.id = conversa and auth.uid() in (c.cliente_id, c.freelancer_id)
  )
$$;

create function tocar_atualizado_em() returns trigger
language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

create trigger perfis_atualizado before update on perfis
  for each row execute function tocar_atualizado_em();
create trigger projetos_atualizado before update on projetos
  for each row execute function tocar_atualizado_em();
create trigger propostas_atualizado before update on propostas
  for each row execute function tocar_atualizado_em();

-- O tipo de conta não muda depois do registo.
create function perfis_tipo_fixo() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.tipo <> old.tipo then
    raise exception 'O tipo de conta não pode ser alterado.';
  end if;
  return new;
end $$;
create trigger perfis_tipo_fixo before update on perfis
  for each row execute function perfis_tipo_fixo();

-- O cliente só pode mexer no estado dentro das transições permitidas;
-- aceitar uma proposta (→ em_andamento) só acontece por responder_proposta().
create function projetos_validar_estado() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.cliente_id <> old.cliente_id then
    raise exception 'Não é possível mudar o dono do projeto.';
  end if;
  if new.estado is distinct from old.estado and current_setting('wop.interno', true) is distinct from '1' then
    if not (
      (old.estado = 'aberto' and new.estado = 'fechado') or
      (old.estado = 'fechado' and new.estado = 'aberto') or
      (old.estado = 'em_andamento' and new.estado = 'concluido')
    ) then
      raise exception 'Mudança de estado não permitida: % → %', old.estado, new.estado;
    end if;
  end if;
  if new.freelancer_id is distinct from old.freelancer_id and current_setting('wop.interno', true) is distinct from '1' then
    raise exception 'O freelancer escolhido só muda ao aceitar uma proposta.';
  end if;
  return new;
end $$;
create trigger projetos_validar_estado before update on projetos
  for each row execute function projetos_validar_estado();

-- Ao fechar ou apagar um projeto, as propostas pendentes ficam «fechada».
create function projetos_fechar_propostas() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado in ('fechado', 'concluido') and old.estado <> new.estado then
    update propostas set estado = 'fechada'
    where projeto_id = new.id and estado = 'pendente';
  end if;
  return new;
end $$;
create trigger projetos_fechar_propostas after update on projetos
  for each row execute function projetos_fechar_propostas();

-- Cada mensagem nova atualiza o resumo da conversa.
create function mensagens_atualizar_conversa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update conversas set
    ultima_mensagem    = left(new.texto, 140),
    ultima_mensagem_em = new.criado_em,
    ultimo_autor_id    = new.autor_id,
    lido_cliente_em    = case when new.autor_id = cliente_id then new.criado_em else lido_cliente_em end,
    lido_freelancer_em = case when new.autor_id = freelancer_id then new.criado_em else lido_freelancer_em end
  where id = new.conversa_id;
  return new;
end $$;
create trigger mensagens_atualizar_conversa after insert on mensagens
  for each row execute function mensagens_atualizar_conversa();

-- Registo: cria perfil e conta a partir dos dados enviados no signUp.
create function criar_perfil_novo_utilizador() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d jsonb := coalesce(new.raw_user_meta_data, '{}');
  t tipo_conta := coalesce(nullif(d ->> 'tipo', ''), 'cliente')::tipo_conta;
begin
  insert into perfis (id, tipo, nome, sobrenome, area, bio, valor_hora, moeda, competencias, empresa, segmento)
  values (
    new.id, t,
    coalesce(nullif(left(d ->> 'nome', 60), ''), split_part(new.email, '@', 1)),
    coalesce(left(d ->> 'sobrenome', 60), ''),
    nullif(d ->> 'area', ''),
    coalesce(left(d ->> 'bio', 800), ''),
    nullif(d ->> 'valor_hora', '')::numeric,
    coalesce(nullif(d ->> 'moeda', ''), 'EUR'),
    coalesce(array(select jsonb_array_elements_text(d -> 'competencias') limit 15), '{}'),
    coalesce(left(d ->> 'empresa', 80), ''),
    coalesce(left(d ->> 'segmento', 60), '')
  );
  insert into contas (id, consentimento)
  values (new.id, coalesce(d -> 'consentimento', '{}'));
  return new;
end $$;
create trigger ao_criar_utilizador after insert on auth.users
  for each row execute function criar_perfil_novo_utilizador();

-- ── Ações (RPC) ────────────────────────────────────────────────────────

create function marcar_conversa_lida(p_conversa uuid) returns void
language sql security definer set search_path = public as $$
  update conversas set
    lido_cliente_em    = case when cliente_id = auth.uid() then now() else lido_cliente_em end,
    lido_freelancer_em = case when freelancer_id = auth.uid() then now() else lido_freelancer_em end
  where id = p_conversa and auth.uid() in (cliente_id, freelancer_id)
$$;

-- Abre (ou devolve) a conversa entre quem chama e outra pessoa, opcionalmente sobre um projeto.
create function abrir_conversa(p_outro uuid, p_projeto uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  eu uuid := auth.uid();
  v_cliente uuid;
  v_freelancer uuid;
  v_id uuid;
begin
  if eu is null then raise exception 'Sessão necessária.'; end if;
  if tipo_de(eu) = 'cliente' and tipo_de(p_outro) = 'freelancer' then
    v_cliente := eu; v_freelancer := p_outro;
  elsif tipo_de(eu) = 'freelancer' and tipo_de(p_outro) = 'cliente' then
    v_cliente := p_outro; v_freelancer := eu;
  else
    raise exception 'As conversas são sempre entre um cliente e um freelancer.';
  end if;
  if p_projeto is not null and not exists (select 1 from projetos where id = p_projeto and cliente_id = v_cliente) then
    raise exception 'Projeto inválido para esta conversa.';
  end if;

  insert into conversas (cliente_id, freelancer_id, projeto_id)
  values (v_cliente, v_freelancer, p_projeto)
  on conflict (cliente_id, freelancer_id, projeto_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from conversas
    where cliente_id = v_cliente and freelancer_id = v_freelancer
      and projeto_id is not distinct from p_projeto;
  else
    insert into mensagens (conversa_id, autor_id, texto)
    values (v_id, null, case when p_projeto is null then 'Conversa direta aberta.'
                             else 'Conversa aberta sobre o projeto «' || (select titulo from projetos where id = p_projeto) || '».' end);
    perform marcar_conversa_lida(v_id);
  end if;
  return v_id;
end $$;

-- Freelancer envia (ou reenvia/edita) a proposta. Devolve o id da conversa.
create function enviar_proposta(p_projeto uuid, p_valor numeric, p_moeda text, p_prazo int, p_mensagem text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  eu uuid := auth.uid();
  v_projeto projetos;
  v_existente propostas;
  v_conversa uuid;
begin
  if tipo_de(eu) is distinct from 'freelancer' then
    raise exception 'Só contas de freelancer enviam propostas.';
  end if;
  select * into v_projeto from projetos where id = p_projeto;
  if v_projeto.id is null or v_projeto.estado <> 'aberto' then
    raise exception 'Este projeto já não está a receber propostas.';
  end if;

  select * into v_existente from propostas where projeto_id = p_projeto and freelancer_id = eu;
  if v_existente.id is null then
    insert into propostas (projeto_id, freelancer_id, valor, moeda, prazo_entrega, mensagem)
    values (p_projeto, eu, p_valor, p_moeda, p_prazo, trim(p_mensagem));
  elsif v_existente.estado in ('pendente', 'retirada') then
    update propostas set valor = p_valor, moeda = p_moeda, prazo_entrega = p_prazo,
                         mensagem = trim(p_mensagem), estado = 'pendente'
    where id = v_existente.id;
  else
    raise exception 'O cliente já respondeu a esta proposta.';
  end if;

  v_conversa := abrir_conversa(v_projeto.cliente_id, p_projeto);
  insert into mensagens (conversa_id, autor_id, texto)
  values (v_conversa, eu,
    case when v_existente.id is null then 'Proposta: ' else 'Proposta atualizada: ' end
    || trim_scale(p_valor) || ' ' || p_moeda || ', entrega em ' || p_prazo || ' dias.' || E'\n\n' || trim(p_mensagem));
  return v_conversa;
end $$;

create function retirar_proposta(p_proposta uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v propostas;
begin
  select * into v from propostas where id = p_proposta and freelancer_id = auth.uid();
  if v.id is null or v.estado <> 'pendente' then
    raise exception 'Só podes retirar propostas que ainda estão à espera de resposta.';
  end if;
  update propostas set estado = 'retirada' where id = v.id;
  insert into mensagens (conversa_id, autor_id, texto)
  select c.id, auth.uid(), 'Retirei a minha proposta para este projeto.'
  from conversas c join projetos p on p.id = v.projeto_id
  where c.projeto_id = v.projeto_id and c.freelancer_id = v.freelancer_id and c.cliente_id = p.cliente_id;
end $$;

create function responder_proposta(p_proposta uuid, p_aceitar boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v propostas;
  v_projeto projetos;
  v_conversa uuid;
begin
  select * into v from propostas where id = p_proposta;
  select * into v_projeto from projetos where id = v.projeto_id;
  if v.id is null or v_projeto.cliente_id is distinct from auth.uid() then
    raise exception 'Proposta não encontrada.';
  end if;
  if v.estado <> 'pendente' or v_projeto.estado <> 'aberto' then
    raise exception 'Esta proposta já não pode ser respondida.';
  end if;

  v_conversa := abrir_conversa(v.freelancer_id, v.projeto_id);

  if p_aceitar then
    perform set_config('wop.interno', '1', true);
    update propostas set estado = 'aceite' where id = v.id;
    update propostas set estado = 'fechada'
      where projeto_id = v.projeto_id and id <> v.id and estado = 'pendente';
    update projetos set estado = 'em_andamento', freelancer_id = v.freelancer_id where id = v.projeto_id;
    perform set_config('wop.interno', '', true);
    insert into mensagens (conversa_id, autor_id, texto)
    values (v_conversa, null, 'Proposta aceite (' || trim_scale(v.valor) || ' ' || v.moeda || ', ' || v.prazo_entrega
                              || ' dias). Combinem aqui os próximos passos.');
  else
    update propostas set estado = 'recusada' where id = v.id;
    insert into mensagens (conversa_id, autor_id, texto)
    values (v_conversa, null, 'O cliente recusou esta proposta.');
  end if;
  perform marcar_conversa_lida(v_conversa);
  return v_conversa;
end $$;

-- RGPD: cópia de todos os dados do utilizador (acesso e portabilidade).
create function exportar_os_meus_dados() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'gerado_em', now(),
    'email', (select email from auth.users where id = auth.uid()),
    'perfil', (select to_jsonb(p) from perfis p where id = auth.uid()),
    'conta', (select to_jsonb(c) from contas c where id = auth.uid()),
    'projetos', coalesce((select jsonb_agg(to_jsonb(p)) from projetos p where cliente_id = auth.uid()), '[]'),
    'propostas', coalesce((select jsonb_agg(to_jsonb(pp)) from propostas pp
                           join projetos p on p.id = pp.projeto_id
                           where pp.freelancer_id = auth.uid() or p.cliente_id = auth.uid()), '[]'),
    'conversas', coalesce((select jsonb_agg(to_jsonb(c) || jsonb_build_object('mensagens',
                   coalesce((select jsonb_agg(to_jsonb(m) order by m.criado_em) from mensagens m where m.conversa_id = c.id), '[]')))
                 from conversas c where auth.uid() in (c.cliente_id, c.freelancer_id)), '[]')
  )
$$;

-- RGPD: apaga a conta e, em cascata, tudo o que lhe pertence.
create function apagar_a_minha_conta() returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid()
$$;

revoke execute on all functions in schema public from anon, public;
grant execute on function abrir_conversa(uuid, uuid), enviar_proposta(uuid, numeric, text, int, text),
  retirar_proposta(uuid), responder_proposta(uuid, boolean), marcar_conversa_lida(uuid),
  exportar_os_meus_dados(), apagar_a_minha_conta(), tipo_de(uuid), e_participante(uuid)
  to authenticated;

-- ── Segurança por linha (RLS) ──────────────────────────────────────────
alter table perfis    enable row level security;
alter table contas    enable row level security;
alter table projetos  enable row level security;
alter table propostas enable row level security;
alter table conversas enable row level security;
alter table mensagens enable row level security;

create policy "perfis: todos leem" on perfis for select using (true);
create policy "perfis: o próprio altera" on perfis for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "contas: o próprio lê" on contas for select to authenticated using (id = (select auth.uid()));
create policy "contas: o próprio altera" on contas for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "projetos: todos leem" on projetos for select using (true);
create policy "projetos: cliente publica" on projetos for insert to authenticated
  with check (cliente_id = (select auth.uid()) and tipo_de((select auth.uid())) = 'cliente'
              and estado = 'aberto' and freelancer_id is null);
create policy "projetos: dono altera" on projetos for update to authenticated
  using (cliente_id = (select auth.uid())) with check (cliente_id = (select auth.uid()));
create policy "projetos: dono apaga" on projetos for delete to authenticated
  using (cliente_id = (select auth.uid()) and estado <> 'em_andamento');

create policy "propostas: freelancer e cliente do projeto leem" on propostas for select to authenticated
  using (freelancer_id = (select auth.uid())
         or exists (select 1 from projetos p where p.id = projeto_id and p.cliente_id = (select auth.uid())));

create policy "conversas: participantes leem" on conversas for select to authenticated
  using ((select auth.uid()) in (cliente_id, freelancer_id));

create policy "mensagens: participantes leem" on mensagens for select to authenticated
  using (e_participante(conversa_id));
create policy "mensagens: participantes escrevem" on mensagens for insert to authenticated
  with check (autor_id = (select auth.uid()) and e_participante(conversa_id));

-- Privilégios de tabela (o RLS decide depois linha a linha).
revoke all on perfis, contas, projetos, propostas, conversas, mensagens from anon, authenticated;
grant select on perfis, projetos to anon, authenticated;
grant update (nome, sobrenome, area, bio, valor_hora, moeda, competencias, disponivel, empresa, segmento)
  on perfis to authenticated;
grant select, update (telefone) on contas to authenticated;
grant insert (cliente_id, titulo, descricao, categoria, orcamento, moeda, prazo_dias, competencias),
      update (titulo, descricao, categoria, orcamento, moeda, prazo_dias, competencias, estado),
      delete on projetos to authenticated;
grant select on propostas, conversas, mensagens to authenticated;
grant insert (conversa_id, autor_id, texto) on mensagens to authenticated;

-- ── Tempo real ─────────────────────────────────────────────────────────
alter publication supabase_realtime add table projetos, propostas, conversas, mensagens;

-- ── Utilizadores que já existiam antes deste esquema ───────────────────
insert into perfis (id, tipo, nome, sobrenome)
select u.id,
       coalesce(nullif(u.raw_user_meta_data ->> 'tipo', ''), 'cliente')::tipo_conta,
       coalesce(nullif(left(u.raw_user_meta_data ->> 'nome', 60), ''), split_part(u.email, '@', 1)),
       coalesce(left(u.raw_user_meta_data ->> 'sobrenome', 60), '')
from auth.users u
where not exists (select 1 from perfis p where p.id = u.id);

insert into contas (id)
select u.id from auth.users u
where not exists (select 1 from contas c where c.id = u.id);

-- ── Funções internas fora da API ───────────────────────────────────────
-- Gatilhos e auxiliares das políticas não devem ser chamáveis por /rest/v1/rpc.
create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;

alter function public.tipo_de(uuid) set schema privado;
alter function public.e_participante(uuid) set schema privado;
alter function public.tocar_atualizado_em() set schema privado;
alter function public.perfis_tipo_fixo() set schema privado;
alter function public.projetos_validar_estado() set schema privado;
alter function public.projetos_fechar_propostas() set schema privado;
alter function public.mensagens_atualizar_conversa() set schema privado;
alter function public.criar_perfil_novo_utilizador() set schema privado;

revoke execute on all functions in schema privado from public, anon, authenticated;
grant execute on function privado.tipo_de(uuid), privado.e_participante(uuid) to authenticated;

alter function public.abrir_conversa(uuid, uuid) set search_path = public, privado;
alter function public.enviar_proposta(uuid, numeric, text, int, text) set search_path = public, privado;
alter function public.responder_proposta(uuid, boolean) set search_path = public, privado;
alter function public.retirar_proposta(uuid) set search_path = public, privado;
