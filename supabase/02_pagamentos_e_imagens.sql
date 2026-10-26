-- Work on Pan — 02: pagamentos pela plataforma (PayPal) e imagens de perfil/portfólio.
-- Corre DEPOIS de esquema.sql, uma única vez, no SQL Editor do Supabase.
--
-- Fluxo do dinheiro (pagamento retido):
--   1. O cliente aceita uma proposta pagando-a (PayPal). O dinheiro fica na conta da plataforma: «retido».
--   2. Só depois disso a proposta passa a «aceite» e o projeto a «em andamento».
--   3. Quando o cliente confirma a entrega, a plataforma envia ao freelancer o valor menos 5 % de
--      comissão (PayPal Payouts): «libertado», e o projeto passa a «concluído».
--
-- O browser NUNCA escreve na tabela de pagamentos: só a função `pagamentos` (Edge Function, com a
-- chave de serviço) o faz, depois de falar com o PayPal. As funções abaixo só podem ser chamadas por ela.

-- ── Pagamentos ─────────────────────────────────────────────────────────

create type estado_pagamento as enum ('pendente', 'retido', 'libertado', 'reembolsado', 'cancelado');

create table pagamentos (
  id                uuid primary key default gen_random_uuid(),
  projeto_id        uuid not null references projetos (id) on delete cascade,
  proposta_id       uuid not null references propostas (id) on delete cascade,
  cliente_id        uuid not null references perfis (id) on delete cascade,
  freelancer_id     uuid not null references perfis (id) on delete cascade,
  valor             numeric(12, 2) not null check (valor > 0),          -- o que o cliente paga
  moeda             text not null check (moeda in ('EUR', 'BRL', 'USD', 'GBP')),
  comissao          numeric(12, 2) not null check (comissao >= 0),     -- fica para a plataforma
  valor_freelancer  numeric(12, 2) not null check (valor_freelancer > 0),
  estado            estado_pagamento not null default 'pendente',
  paypal_ordem      text unique,
  paypal_captura    text,
  paypal_envio      text,
  criado_em         timestamptz not null default now(),
  retido_em         timestamptz,
  libertado_em      timestamptz,
  check (valor = comissao + valor_freelancer)
);
create index pagamentos_projeto_idx on pagamentos (projeto_id);
create index pagamentos_freelancer_idx on pagamentos (freelancer_id);
-- Só pode haver um pagamento com dinheiro a sério por proposta.
create unique index pagamentos_um_por_proposta on pagamentos (proposta_id) where estado in ('retido', 'libertado');

alter table pagamentos enable row level security;
create policy "pagamentos: cliente e freelancer leem" on pagamentos for select to authenticated
  using ((select auth.uid()) in (cliente_id, freelancer_id));
revoke all on pagamentos from anon, authenticated;
grant select on pagamentos to authenticated;

-- E-mail PayPal para receber (privado: só o próprio vê).
alter table contas add column paypal_email text not null default ''
  check (paypal_email = '' or paypal_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
grant update (telefone, paypal_email) on contas to authenticated;

-- 1. Prepara um pagamento pendente para uma proposta (chamada pela Edge Function).
create function pagamento_preparar(p_proposta uuid, p_cliente uuid) returns pagamentos
language plpgsql security definer set search_path = public, privado as $$
declare
  v propostas;
  v_projeto projetos;
  v_pag pagamentos;
  v_comissao numeric(12, 2);
begin
  select * into v from propostas where id = p_proposta;
  select * into v_projeto from projetos where id = v.projeto_id;
  if v.id is null or v_projeto.cliente_id is distinct from p_cliente then
    raise exception 'Proposta não encontrada.';
  end if;
  if v.estado <> 'pendente' or v_projeto.estado <> 'aberto' then
    raise exception 'Esta proposta já não pode ser aceite.';
  end if;
  -- Uma tentativa anterior que ficou a meio deixa de contar.
  update pagamentos set estado = 'cancelado' where proposta_id = v.id and estado = 'pendente';

  v_comissao := round(v.valor * 0.05, 2);
  insert into pagamentos (projeto_id, proposta_id, cliente_id, freelancer_id, valor, moeda, comissao, valor_freelancer)
  values (v.projeto_id, v.id, p_cliente, v.freelancer_id, v.valor, v.moeda, v_comissao, v.valor - v_comissao)
  returning * into v_pag;
  return v_pag;
end $$;

-- 2. O PayPal confirmou a captura: o dinheiro fica retido e a proposta é aceite.
--    Devolve 'aceite', 'ja_aceite' ou 'reembolsar' (se entretanto o projeto deixou de estar aberto).
create function pagamento_confirmar(p_pagamento uuid, p_captura text) returns text
language plpgsql security definer set search_path = public, privado as $$
declare
  v_pag pagamentos;
  v propostas;
  v_projeto projetos;
  v_conversa uuid;
begin
  select * into v_pag from pagamentos where id = p_pagamento for update;
  if v_pag.id is null then raise exception 'Pagamento não encontrado.'; end if;
  if v_pag.estado in ('retido', 'libertado') then return 'ja_aceite'; end if;

  select * into v from propostas where id = v_pag.proposta_id for update;
  select * into v_projeto from projetos where id = v_pag.projeto_id for update;

  update pagamentos set estado = 'retido', paypal_captura = p_captura, retido_em = now() where id = v_pag.id;

  if v.estado <> 'pendente' or v_projeto.estado <> 'aberto' then
    return 'reembolsar';
  end if;

  perform set_config('wop.interno', '1', true);
  update propostas set estado = 'aceite' where id = v.id;
  update propostas set estado = 'fechada' where projeto_id = v.projeto_id and id <> v.id and estado = 'pendente';
  update projetos set estado = 'em_andamento', freelancer_id = v.freelancer_id where id = v.projeto_id;
  perform set_config('wop.interno', '', true);

  select id into v_conversa from conversas
  where cliente_id = v_pag.cliente_id and freelancer_id = v_pag.freelancer_id and projeto_id = v_pag.projeto_id;
  if v_conversa is not null then
    insert into mensagens (conversa_id, autor_id, texto)
    values (v_conversa, null, 'Proposta aceite e paga (' || trim_scale(v_pag.valor) || ' ' || v_pag.moeda
      || '). O pagamento está retido pela plataforma e é libertado para o freelancer quando o cliente confirmar a entrega.');
  end if;
  return 'aceite';
end $$;

-- 3. Reembolso feito no PayPal.
create function pagamento_reembolsado(p_pagamento uuid) returns void
language sql security definer set search_path = public as $$
  update pagamentos set estado = 'reembolsado' where id = p_pagamento
$$;

-- 4. Envio ao freelancer feito: pagamento libertado e projeto concluído.
create function pagamento_libertado(p_pagamento uuid, p_envio text) returns void
language plpgsql security definer set search_path = public, privado as $$
declare
  v_pag pagamentos;
  v_conversa uuid;
begin
  select * into v_pag from pagamentos where id = p_pagamento for update;
  if v_pag.id is null or v_pag.estado <> 'retido' then
    raise exception 'Este pagamento não está retido.';
  end if;
  update pagamentos set estado = 'libertado', paypal_envio = p_envio, libertado_em = now() where id = v_pag.id;

  perform set_config('wop.interno', '1', true);
  update projetos set estado = 'concluido' where id = v_pag.projeto_id and estado = 'em_andamento';
  perform set_config('wop.interno', '', true);

  select id into v_conversa from conversas
  where cliente_id = v_pag.cliente_id and freelancer_id = v_pag.freelancer_id and projeto_id = v_pag.projeto_id;
  if v_conversa is not null then
    insert into mensagens (conversa_id, autor_id, texto)
    values (v_conversa, null, 'Entrega confirmada. Foram enviados ' || trim_scale(v_pag.valor_freelancer) || ' '
      || v_pag.moeda || ' para o PayPal do freelancer (valor menos 5 % de comissão). Projeto concluído.');
  end if;
end $$;

revoke execute on function pagamento_preparar(uuid, uuid), pagamento_confirmar(uuid, text),
  pagamento_reembolsado(uuid), pagamento_libertado(uuid, text) from public, anon, authenticated;
grant execute on function pagamento_preparar(uuid, uuid), pagamento_confirmar(uuid, text),
  pagamento_reembolsado(uuid), pagamento_libertado(uuid, text) to service_role;

-- Aceitar uma proposta passa a exigir pagamento: responder_proposta só recusa.
create or replace function responder_proposta(p_proposta uuid, p_aceitar boolean) returns uuid
language plpgsql security definer set search_path = public, privado as $$
declare
  v propostas;
  v_projeto projetos;
  v_conversa uuid;
begin
  if p_aceitar then
    raise exception 'Para aceitar uma proposta, paga-a pela plataforma.';
  end if;
  select * into v from propostas where id = p_proposta;
  select * into v_projeto from projetos where id = v.projeto_id;
  if v.id is null or v_projeto.cliente_id is distinct from auth.uid() then
    raise exception 'Proposta não encontrada.';
  end if;
  if v.estado <> 'pendente' or v_projeto.estado <> 'aberto' then
    raise exception 'Esta proposta já não pode ser respondida.';
  end if;
  v_conversa := abrir_conversa(v.freelancer_id, v.projeto_id);
  update propostas set estado = 'recusada' where id = v.id;
  insert into mensagens (conversa_id, autor_id, texto) values (v_conversa, null, 'O cliente recusou esta proposta.');
  perform marcar_conversa_lida(v_conversa);
  return v_conversa;
end $$;

-- Um projeto com pagamento retido só fica concluído ao libertar o pagamento.
create or replace function privado.projetos_validar_estado() returns trigger
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
    if new.estado = 'concluido' and exists (select 1 from pagamentos where projeto_id = new.id and estado = 'retido') then
      raise exception 'Este projeto tem um pagamento retido: confirma a entrega para o libertar.';
    end if;
  end if;
  if new.freelancer_id is distinct from old.freelancer_id and current_setting('wop.interno', true) is distinct from '1' then
    raise exception 'O freelancer escolhido só muda ao aceitar uma proposta.';
  end if;
  return new;
end $$;

-- ── Fotografia de perfil e portfólio ───────────────────────────────────

alter table perfis add column foto text not null default '' check (char_length(foto) <= 200);
grant update (foto) on perfis to authenticated;

create table portfolio (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid not null references perfis (id) on delete cascade,
  caminho    text not null check (char_length(caminho) between 1 and 200),
  titulo     text not null default '' check (char_length(titulo) <= 80),
  descricao  text not null default '' check (char_length(descricao) <= 300),
  criado_em  timestamptz not null default now()
);
create index portfolio_perfil_idx on portfolio (perfil_id, criado_em desc);

alter table portfolio enable row level security;
create policy "portfolio: todos leem" on portfolio for select using (true);
create policy "portfolio: freelancer acrescenta" on portfolio for insert to authenticated
  with check (perfil_id = (select auth.uid()) and privado.tipo_de((select auth.uid())) = 'freelancer'
              and caminho like (select auth.uid())::text || '/%');
create policy "portfolio: dono altera" on portfolio for update to authenticated
  using (perfil_id = (select auth.uid())) with check (perfil_id = (select auth.uid()));
create policy "portfolio: dono apaga" on portfolio for delete to authenticated
  using (perfil_id = (select auth.uid()));
revoke all on portfolio from anon, authenticated;
grant select on portfolio to anon, authenticated;
grant insert (perfil_id, caminho, titulo, descricao), update (titulo, descricao), delete on portfolio to authenticated;

-- No máximo 12 trabalhos por pessoa.
create function privado.portfolio_limite() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from portfolio where perfil_id = new.perfil_id) >= 12 then
    raise exception 'O portfólio já tem 12 trabalhos. Apaga um para acrescentar outro.';
  end if;
  return new;
end $$;
revoke execute on function privado.portfolio_limite() from public, anon, authenticated;
create trigger portfolio_limite before insert on portfolio
  for each row execute function privado.portfolio_limite();

-- Ficheiros: cada pessoa só escreve na sua pasta (<id>/...). Leitura pública.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 2097152, array['image/webp', 'image/jpeg', 'image/png']),
       ('portfolio', 'portfolio', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "imagens: leitura pública" on storage.objects for select
  using (bucket_id in ('avatares', 'portfolio'));
create policy "imagens: o próprio envia" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatares', 'portfolio') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "imagens: o próprio substitui" on storage.objects for update to authenticated
  using (bucket_id in ('avatares', 'portfolio') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "imagens: o próprio apaga" on storage.objects for delete to authenticated
  using (bucket_id in ('avatares', 'portfolio') and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ── RGPD: a cópia dos dados passa a incluir portfólio e pagamentos ─────
create or replace function exportar_os_meus_dados() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'gerado_em', now(),
    'email', (select email from auth.users where id = auth.uid()),
    'perfil', (select to_jsonb(p) from perfis p where id = auth.uid()),
    'conta', (select to_jsonb(c) from contas c where id = auth.uid()),
    'portfolio', coalesce((select jsonb_agg(to_jsonb(f)) from portfolio f where perfil_id = auth.uid()), '[]'),
    'projetos', coalesce((select jsonb_agg(to_jsonb(p)) from projetos p where cliente_id = auth.uid()), '[]'),
    'propostas', coalesce((select jsonb_agg(to_jsonb(pp)) from propostas pp
                           join projetos p on p.id = pp.projeto_id
                           where pp.freelancer_id = auth.uid() or p.cliente_id = auth.uid()), '[]'),
    'pagamentos', coalesce((select jsonb_agg(to_jsonb(g)) from pagamentos g
                            where auth.uid() in (g.cliente_id, g.freelancer_id)), '[]'),
    'conversas', coalesce((select jsonb_agg(to_jsonb(c) || jsonb_build_object('mensagens',
                   coalesce((select jsonb_agg(to_jsonb(m) order by m.criado_em) from mensagens m where m.conversa_id = c.id), '[]')))
                 from conversas c where auth.uid() in (c.cliente_id, c.freelancer_id)), '[]')
  )
$$;

-- ── Tempo real ─────────────────────────────────────────────────────────
alter publication supabase_realtime add table pagamentos;
