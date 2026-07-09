-- ============================================================================
-- Espinha de dados do ecossistema — livro de atividade (para a Kilapi).
-- Cada registo/procura na Yamioo emite um evento ligado à identidade AFROLOC.
-- A Kilapi lê esta tabela (service role) para construir o score de crédito.
-- Correr no SQL Editor do Supabase.
-- ============================================================================

create table if not exists eventos (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null,                 -- registo | procura | (futuro: venda, avaliacao…)
  afroloc      text,                          -- identidade/lugar AFROLOC associado
  entidade_id  uuid references entidades(id) on delete set null,
  cc           text,
  prov         text,
  mun          text,
  termo        text,                          -- termo de procura (quando aplicável)
  meta         jsonb default '{}'::jsonb,     -- payload livre (n_resultados, nome, fonte…)
  criado_em    timestamptz default now()
);

create index if not exists eventos_afroloc_idx on eventos (afroloc);
create index if not exists eventos_tipo_idx    on eventos (tipo);
create index if not exists eventos_criado_idx  on eventos (criado_em desc);

-- Fechado ao público: só o service role (Yamioo/Kilapi no servidor) escreve/lê.
alter table eventos enable row level security;
