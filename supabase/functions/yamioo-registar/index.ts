// ============================================================================
// Yamioo Registar — Edge Function (registo de entidades)  [Deno]
// ----------------------------------------------------------------------------
// Fase 2: um vendedor/entidade regista-se e recebe logo o seu código AFROLOC.
// Insere na tabela `entidades` (service role, valida input). Verify JWT = OFF.
//
//   POST { nome, tipo, categoria, descricao, preco, cc, prov, mun, zona, lat, lng }
//   200  { ok: true, code, id }   |   { ok:false, error }
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const R = 6378137.0, MAX_LAT = 85.05112878;
function toMercator(lat: number, lon: number) {
  const c = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  return { x: R * (lon * Math.PI / 180), y: R * Math.log(Math.tan(Math.PI / 4 + (c * Math.PI / 180) / 2)) };
}
function encodeCoord(n: number): string {
  const u = n >= 0 ? n * 2 : -n * 2 - 1;
  return u.toString(36).toUpperCase();
}
function afrolocCode(cc: string, prov: string, mun: string, zona: string, lat: number, lng: number): string {
  const { x, y } = toMercator(lat, lng);
  const xy = `X${encodeCoord(Math.floor(x / 10))}-Y${encodeCoord(Math.floor(y / 10))}`;
  const CC = (cc || "??").toUpperCase();
  if (prov && mun && zona) return [CC, prov, mun, zona, "GEN", "G10", xy].join("-").toUpperCase();
  return `${CC}-ZU-G10-${xy}`;
}

const TIPOS = new Set(["local", "servico", "pessoa", "oportunidade", "conteudo"]);
const clip = (s: any, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json();
    const nome = clip(b.nome, 120);
    const cc = clip(b.cc, 2).toUpperCase();
    const lat = Number(b.lat), lng = Number(b.lng);
    if (!nome) return json({ ok: false, error: "Indica o nome." }, 200);
    if (!cc) return json({ ok: false, error: "País em falta." }, 200);
    if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return json({ ok: false, error: "Coordenadas inválidas." }, 200);
    }
    const tipo = TIPOS.has(b.tipo) ? b.tipo : "local";
    const prov = clip(b.prov, 4).toUpperCase();
    const mun = clip(b.mun, 4).toUpperCase();
    const zona = clip(b.zona, 4).toUpperCase();

    const row = {
      nome, tipo,
      categoria: clip(b.categoria, 80) || null,
      descricao: clip(b.descricao, 400) || null,
      preco: clip(b.preco, 40) || null,
      cc, prov: prov || null, mun: mun || null, zona: zona || null,
      lat, lng, confianca: 60, validado: false, fonte: "registo",
    };

    const URL = Deno.env.get("SUPABASE_URL");
    const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!URL || !KEY) return json({ ok: false, error: "Servidor mal configurado." }, 200);

    const r = await fetch(`${URL}/rest/v1/entidades`, {
      method: "POST",
      headers: {
        apikey: KEY, Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json", Prefer: "return=representation",
      },
      body: JSON.stringify(row),
    });
    if (!r.ok) return json({ ok: false, error: `Falhou o registo (${r.status}).` }, 200);
    const [created] = await r.json();

    // A coluna `afroloc` é GERADA na BD (fonte única do codec). Usa-a; só se
    // faltar recorre ao codec local (nunca deve faltar).
    const code = created?.afroloc ?? afrolocCode(cc, prov, mun, zona, lat, lng);

    // Nível 2 — livro de eventos (best-effort; nunca falha o registo).
    await logEvento(URL, KEY, {
      tipo: "registo",
      entidade_id: created?.id ?? null,
      afroloc: code,
      cc, prov: prov || null, mun: mun || null,
      meta: { nome, tipo, fonte: "registo" },
    });

    return json({ ok: true, id: created?.id ?? null, code }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }
});

// Escreve um evento no livro de atividade (best-effort; erros são ignorados).
async function logEvento(URL: string, KEY: string, evt: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${URL}/rest/v1/eventos`, {
      method: "POST",
      headers: {
        apikey: KEY, Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json", Prefer: "return=minimal",
      },
      body: JSON.stringify(evt),
    });
  } catch { /* eventos são best-effort */ }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
