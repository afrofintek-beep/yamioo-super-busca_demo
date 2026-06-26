-- ============================================================================
-- Fase 3 — segunda fonte do índice (web/OSM). Dedupe por ext_id.
-- Correr no SQL Editor do Supabase.
-- ============================================================================

alter table entidades add column if not exists ext_id text;

-- Evita inserir o mesmo ponto OSM duas vezes (upsert por ext_id).
create unique index if not exists entidades_ext_id_uniq
  on entidades (ext_id) where ext_id is not null;
