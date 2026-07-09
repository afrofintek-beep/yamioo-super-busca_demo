// ============================================================================
// Yamioo Alerta — Edge Function ("avisa-me quando aparecer")  [Deno]
// ----------------------------------------------------------------------------
// Guarda a procura sem oferta + contacto na tabela `alertas`. Verify JWT = OFF.
//
//   POST { termo, contacto, cc, prov, mun, zona, lat, lng }
//   200  { ok: true } | { ok:false, error }
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const R = 6378137.0, MAX_LAT = 85.05112878;
function encodeCoord(n: number) { const u = n >= 0 ? n * 2 : -n * 2 - 1; return u.toString(36).toUpperCase(); }
function afrolocLugar(cc: string, prov: string, mun: string, zona: string, lat: number, lng: number): string | null {
  if (!isFinite(lat) || !isFinite(lng)) return null;
  const c = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const x = R * (lng * Math.PI / 180), y = R * Math.log(Math.tan(Math.PI / 4 + (c * Math.PI / 180) / 2));
  const xy = `X${encodeCoord(Math.floor(x / 10))}-Y${encodeCoord(Math.floor(y / 10))}`;
  const CC = (cc || "??").toUpperCase();
  return prov && mun && zona ? [CC, prov, mun, zona, "GEN", "G10", xy].join("-").toUpperCase() : `${CC}-ZU-G10-${xy}`;
}
const clip = (s: any, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json();
    const termo = clip(b.termo, 120);
    const contacto = clip(b.contacto, 120);
    if (!termo) return json({ ok: false, error: "Falta o termo." }, 200);
    if (!contacto) return json({ ok: false, error: "Indica um contacto." }, 200);

    const cc = clip(b.cc, 2).toUpperCase();
    const prov = clip(b.prov, 4).toUpperCase(), mun = clip(b.mun, 4).toUpperCase(), zona = clip(b.zona, 4).toUpperCase();
    const afroloc = afrolocLugar(cc, prov, mun, zona, Number(b.lat), Number(b.lng));

    const URL = Deno.env.get("SUPABASE_URL"), KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!URL || !KEY) return json({ ok: false, error: "Servidor mal configurado." }, 200);

    const r = await fetch(`${URL}/rest/v1/alertas`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ termo, contacto, cc: cc || null, prov: prov || null, mun: mun || null, zona: zona || null, afroloc }),
    });
    if (!r.ok) return json({ ok: false, error: `Falhou (${r.status}).` }, 200);
    return json({ ok: true }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
