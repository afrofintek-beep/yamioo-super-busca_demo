-- ============================================================================
-- Captura de procura sem oferta ("avisa-me quando aparecer") — arranque a frio.
-- Cada linha = uma pessoa que procurou algo que ainda não existe e quer saber
-- quando aparecer. É a lista de "o que semear" e a de "a quem avisar".
-- Correr no SQL Editor do Supabase oltqppftxvhnkzqshsqx.
-- ============================================================================

create table if not exists alertas (
  id          uuid primary key default gen_random_uuid(),
  termo       text not null,
  contacto    text not null,                 -- telemóvel ou email
  cc          text, prov text, mun text, zona text,
  afroloc     text,                          -- lugar de quem procurou
  notificado  boolean default false,
  criado_em   timestamptz default now()
);
create index if not exists alertas_termo_idx on alertas (termo);
create index if not exists alertas_mun_idx   on alertas (cc, mun);

alter table alertas enable row level security;   -- só service role escreve/lê
