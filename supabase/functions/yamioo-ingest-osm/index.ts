// ============================================================================
// Yamioo Ingest OSM — Edge Function (segunda fonte do índice: web/OpenStreetMap)
// ----------------------------------------------------------------------------
// Fase 3 v1. Dada uma zona (lat/lng + segmentos administrativos), busca POIs
// reais no OpenStreetMap (Overpass API) à volta e insere-os na tabela
// `entidades` com fonte='web', dedupe por ext_id, e código AFROLOC.
//
//   POST { cc, prov, mun, zona, lat, lng, radius?, limit? }
//   200  { ok, ingeridos, encontrados, exemplos }
//
// Fonte legal e gratuita (ODbL). Verify JWT = OFF (uso administrativo).
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
function encodeCoord(n: number) { const u = n >= 0 ? n * 2 : -n * 2 - 1; return u.toString(36).toUpperCase(); }

// OSM tag → (tipo, categoria legível)
function classify(tags: Record<string, string>): { tipo: string; categoria: string } | null {
  const pretty = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  if (tags.shop) return { tipo: "local", categoria: pretty(tags.shop) };
  if (tags.craft) return { tipo: "servico", categoria: pretty(tags.craft) };
  if (tags.office) return { tipo: "servico", categoria: pretty(tags.office) };
  if (tags.amenity) {
    const servicos = new Set(["bank", "fuel", "pharmacy", "clinic", "doctors", "hospital", "police", "post_office"]);
    return { tipo: servicos.has(tags.amenity) ? "servico" : "local", categoria: pretty(tags.amenity) };
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json();
    const lat = Number(b.lat), lng = Number(b.lng);
    const cc = String(b.cc ?? "").toUpperCase();
    if (!isFinite(lat) || !isFinite(lng) || !cc) return json({ ok: false, error: "lat/lng/cc em falta" }, 200);
    const prov = String(b.prov ?? "").toUpperCase();
    const mun = String(b.mun ?? "").toUpperCase();
    const zona = String(b.zona ?? "").toUpperCase();
    const radius = Math.min(Math.max(Number(b.radius) || 1500, 200), 5000);
    const limit = Math.min(Math.max(Number(b.limit) || 60, 1), 150);

    const ql =
`[out:json][timeout:25];
(
  node["name"]["shop"](around:${radius},${lat},${lng});
  node["name"]["amenity"](around:${radius},${lat},${lng});
  node["name"]["craft"](around:${radius},${lat},${lng});
  way["name"]["shop"](around:${radius},${lat},${lng});
);
out center ${limit};`;

    const ov = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "yamioo-ingest/1.0 (afrofintek@gmail.com)",
      },
      body: "data=" + encodeURIComponent(ql),
    });
    if (!ov.ok) return json({ ok: false, error: `Overpass ${ov.status}` }, 200);
    const data = await ov.json();
    const els: any[] = data.elements || [];

    const rows = els.map((el) => {
      const t = el.tags || {};
      const c = classify(t);
      const la = el.lat ?? el.center?.lat, ln = el.lon ?? el.center?.lon;
      if (!c || !t.name || typeof la !== "number" || typeof ln !== "number") return null;
      const { x, y } = toMercator(la, ln);
      void x; void y;
      return {
        nome: String(t.name).slice(0, 120),
        tipo: c.tipo, categoria: c.categoria.slice(0, 80),
        descricao: [t["addr:street"], t["addr:suburb"]].filter(Boolean).join(", ").slice(0, 400) || null,
        preco: null, cc, prov: prov || null, mun: mun || null, zona: zona || null,
        lat: la, lng: ln, confianca: 65, validado: false, fonte: "web",
        ext_id: `osm:${el.type}/${el.id}`,
      };
    }).filter(Boolean);

    const URL = Deno.env.get("SUPABASE_URL");
    const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!URL || !KEY) return json({ ok: false, error: "Servidor mal configurado." }, 200);

    let ingeridos = 0;
    if (rows.length) {
      const r = await fetch(`${URL}/rest/v1/entidades?on_conflict=ext_id`, {
        method: "POST",
        headers: {
          apikey: KEY, Authorization: `Bearer ${KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(rows),
      });
      if (!r.ok) return json({ ok: false, error: `Insert ${r.status}: ${await r.text()}` }, 200);
      ingeridos = (await r.json()).length;
    }

    return json({
      ok: true, encontrados: els.length, ingeridos,
      exemplos: rows.slice(0, 5).map((r: any) => `${r.nome} (${r.categoria})`),
    }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
