-- ============================================================================
-- Yamioo — Nível 1 (AFROLOC como CHAVE persistida) + arranque do Nível 2 (eventos)
-- ----------------------------------------------------------------------------
-- • `entidades.afroloc` passa a ser uma COLUNA GERADA (STORED) a partir de
--   lat/lng + divisões — backfill automático das linhas existentes, e sempre
--   coerente com o runtime (o mesmo codec, agora em SQL como fonte única).
-- • Tabela `eventos` = livro de atividade que a Kilapi lê. O SUJEITO é a
--   `entidade_id` (a ficha), com o `afroloc` (o LUGAR) ao lado — nunca o
--   endereço como se fosse a pessoa. `pessoa_id` fica reservado para quando
--   existir a identidade de PESSOA (contas ligadas).
-- Correr no Supabase: Dashboard → SQL Editor → colar tudo → Run.
-- ============================================================================

-- ── Codec AFROLOC em SQL (idêntico ao JS: Web Mercator + base36 zig-zag) ─────

-- base36 do inteiro com sinal via zig-zag (n>=0 -> 2n ; n<0 -> -2n-1)
create or replace function afroloc_b36zz(n bigint)
returns text language plpgsql immutable as $$
declare
  u bigint;
  s text := '';
  d int;
  digits constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
begin
  u := case when n >= 0 then n * 2 else -n * 2 - 1 end;
  if u = 0 then return '0'; end if;
  while u > 0 loop
    d := (u % 36)::int;
    s := substr(digits, d + 1, 1) || s;
    u := u / 36;                         -- divisão inteira (u > 0)
  end loop;
  return s;
end;
$$;

-- Nomenclatura CC-PROV-MUN-COM-BAI-G10-X…-Y… (ou CC-ZU-G10-X…-Y… sem divisões).
-- IMMUTABLE para poder alimentar uma coluna gerada.
create or replace function afroloc_nom(
  p_cc text, p_prov text, p_mun text, p_zona text,
  p_lat double precision, p_lng double precision
) returns text language plpgsql immutable as $$
declare
  r      constant double precision := 6378137.0;
  maxlat constant double precision := 85.05112878;
  clat   double precision;
  x      double precision;
  y      double precision;
  ix     bigint;
  iy     bigint;
  xy     text;
  cc     text := upper(coalesce(p_cc, '??'));
begin
  if p_lat is null or p_lng is null then return null; end if;
  clat := greatest(-maxlat, least(maxlat, p_lat));
  x := r * (p_lng * pi() / 180);
  y := r * ln(tan(pi() / 4 + (clat * pi() / 180) / 2));
  ix := floor(x / 10)::bigint;           -- grelha urbana 10 m (G10)
  iy := floor(y / 10)::bigint;
  xy := 'X' || afroloc_b36zz(ix) || '-Y' || afroloc_b36zz(iy);
  if p_prov is not null and p_prov <> ''
     and p_mun is not null and p_mun <> ''
     and p_zona is not null and p_zona <> '' then
    return upper(cc || '-' || p_prov || '-' || p_mun || '-' || p_zona || '-GEN-G10-' || xy);
  end if;
  return cc || '-ZU-G10-' || xy;
end;
$$;

-- ── Nível 1: AFROLOC como coluna persistida (chave de LUGAR) ─────────────────
alter table entidades
  add column if not exists afroloc text
  generated always as (afroloc_nom(cc, prov, mun, zona, lat, lng)) stored;

create index if not exists entidades_afroloc_idx on entidades (afroloc);

-- ── Nível 2 (arranque): livro de eventos que alimenta a Kilapi ──────────────
create table if not exists eventos (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null,                                   -- registo|procura|resultado|ingest|contacto|avaliacao
  entidade_id uuid references entidades(id) on delete set null,-- SUJEITO (a ficha/pessoa)
  afroloc     text,                                            -- o LUGAR (reputação geográfica)
  pessoa_id   uuid,                                            -- reservado: identidade de PESSOA (contas ligadas)
  cc          text,
  prov        text,
  mun         text,
  termo       text,                                            -- termo de procura (tipo='procura')
  meta        jsonb,                                           -- payload livre (n_resultados, fonte, …)
  criado_em   timestamptz default now()
);

create index if not exists eventos_afroloc_idx  on eventos (afroloc);
create index if not exists eventos_entidade_idx on eventos (entidade_id);
create index if not exists eventos_tipo_idx     on eventos (tipo);
create index if not exists eventos_criado_idx   on eventos (criado_em desc);

-- Atividade é sensível (termos de procura, quem foi encontrado): SEM leitura
-- pública. RLS ligado e sem política de SELECT → só o service role (as edge
-- functions / a Kilapi do lado servidor) lê e escreve.
alter table eventos enable row level security;

-- Recarregar o cache de esquema do PostgREST (para a nova coluna/tabela aparecerem já).
notify pgrst, 'reload schema';
