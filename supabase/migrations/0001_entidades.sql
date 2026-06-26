-- ============================================================================
-- Yamioo — índice de entidades reais (economia informal pan-africana)
-- Fase 1: tabela de registo próprio. Cada entidade tem lat/lng → código AFROLOC.
-- Correr no Supabase: Dashboard → SQL Editor → colar tudo → Run.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists entidades (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  tipo        text not null default 'local',        -- local|servico|pessoa|oportunidade|conteudo
  categoria   text,
  descricao   text,
  preco       text,                                  -- ex: "2.500 AKZ" (null se não aplicável)
  cc          text not null,                         -- país ISO-2 (AO, MZ, GH, …)
  prov        text,
  mun         text,
  zona        text,
  lat         double precision not null,
  lng         double precision not null,
  confianca   int  default 70,                       -- 40–99
  validado    boolean default false,                 -- validado pela comunidade?
  fonte       text default 'registo',                -- registo|import|web|seed
  criado_em   timestamptz default now(),
  atualizado_em timestamptz default now()
);

create index if not exists entidades_cc_idx on entidades (cc);
create index if not exists entidades_busca_idx
  on entidades using gin (
    to_tsvector('portuguese',
      coalesce(nome,'') || ' ' || coalesce(categoria,'') || ' ' || coalesce(descricao,''))
  );

-- Leitura pública (a app lê via Edge Function); escrita só via service role / dashboard.
alter table entidades enable row level security;
drop policy if exists "leitura publica entidades" on entidades;
create policy "leitura publica entidades" on entidades for select using (true);

-- ── Sementes (fonte='seed') — pontos reais à volta de Luanda para testar
-- ponta-a-ponta. APAGA/SUBSTITUI por dados teus:  delete from entidades where fonte='seed';
insert into entidades (nome, tipo, categoria, descricao, preco, cc, prov, mun, zona, lat, lng, confianca, validado, fonte) values
  ('Mercado do Kilamba Kiaxi', 'local', 'Mercado informal', 'Grande mercado de rua: alimentação, roupa, utensílios e reparações.', null, 'AO','LUA','TAL','TAL', -8.9402, 13.1880, 88, true, 'seed'),
  ('Mestre Zeca — Sapateiro', 'pessoa', 'Reparação de calçado', 'Conserta solas, saltos e costuras em couro. Atende junto à paragem.', '500 AKZ', 'AO','LUA','TAL','TAL', -8.9335, 13.1840, 79, true, 'seed'),
  ('Quitanda da Dona Rosa', 'local', 'Venda de hortícolas', 'Banca de legumes, fruta e peixe seco no mercado do bairro.', '300 AKZ', 'AO','LUA','TAL','TAL', -8.9310, 13.1860, 74, false, 'seed'),
  ('Zé Eletricista', 'servico', 'Reparações elétricas', 'Instalações e avarias elétricas ao domicílio em Talatona e Camama.', null, 'AO','LUA','TAL','TAL', -8.9288, 13.1902, 71, false, 'seed'),
  ('Kandando Transportes', 'servico', 'Mototáxi / entregas', 'Entregas rápidas e transporte de pessoas na zona de Talatona.', '1.000 AKZ', 'AO','LUA','TAL','TAL', -8.9360, 13.1825, 68, false, 'seed'),
  ('Ponto de Recargas Bento', 'local', 'Recargas & multicaixa', 'Recargas de telemóvel, pagamentos e transferências.', null, 'AO','LUA','TAL','TAL', -8.9322, 13.1849, 82, true, 'seed');
