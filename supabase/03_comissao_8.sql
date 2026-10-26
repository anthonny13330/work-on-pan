-- Work on Pan — 03: a comissão passa de 5 % para 8 %.
-- Corre DEPOIS de 02_pagamentos_e_imagens.sql, uma única vez, no SQL Editor do Supabase.
--
-- Com 5 %, as taxas do PayPal (ao receber do cliente e ao enviar ao freelancer) eram maiores do que a comissão.
-- Só muda o cálculo dos pagamentos novos: os que já estão retidos mantêm a comissão com que foram pagos.

create or replace function pagamento_preparar(p_proposta uuid, p_cliente uuid) returns pagamentos
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

  v_comissao := round(v.valor * 0.08, 2);
  insert into pagamentos (projeto_id, proposta_id, cliente_id, freelancer_id, valor, moeda, comissao, valor_freelancer)
  values (v.projeto_id, v.id, p_cliente, v.freelancer_id, v.valor, v.moeda, v_comissao, v.valor - v_comissao)
  returning * into v_pag;
  return v_pag;
end $$;

create or replace function pagamento_libertado(p_pagamento uuid, p_envio text) returns void
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
      || v_pag.moeda || ' para o PayPal do freelancer (valor menos 8 % de comissão). Projeto concluído.');
  end if;
end $$;
