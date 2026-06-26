// ============================================================================
// AfroLoc — Edge Function (codec)   [Deno / Supabase]
// ----------------------------------------------------------------------------
// Codec OFICIAL, portado fielmente de afroloc-app/src/lib/afroloc
//   • geo.ts  §4 / §9.1  — Web Mercator (EPSG:3857) + base36 zig-zag
//   • sdk.ts  §2.1        — encode determinista, tokens X…/Y…
//   • engines.ts §4.1     — nomenclatura CC-PROV-MUN-COM-BAI-G10-X-Y
//
//   POST  { lat, lng, cc, prov, mun, zona, rural?, com?, bai?, seq?, registrationType? }
//   200   { code, legacy, zone, grid, ix, iy, centroid }
//
// `code`    = nomenclatura (CC-PROV-MUN-COM-BAI-G10-X…-Y…[-NNNN]) quando há
//             segmentos administrativos; senão o legacy CC-ZU-G10-X…-Y…
// `legacy`  = código de célula standard (CC-ZU/ZR-G10-X…-Y…)
//
// O algoritmo é IDÊNTICO ao cliente — códigos gerados offline reconciliam no sync.
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const R = 6378137.0;        // raio WGS84 (Web Mercator)
const MAX_LAT = 85.05112878;

function toMercator(lat: number, lon: number) {
  const clampLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const x = R * (lon * (Math.PI / 180));
  const y = R * Math.log(Math.tan(Math.PI / 4 + (clampLat * (Math.PI / 180)) / 2));
  return { x, y };
}
function fromMercator(x: number, y: number) {
  const lon = (x / R) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);
  return { lat, lon };
}
// Índices de célula podem ser negativos → zig-zag para base36 sem sinal.
function encodeCoord(n: number): string {
  const u = n >= 0 ? n * 2 : -n * 2 - 1;
  return u.toString(36).toUpperCase();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json();
    const { lat, lng, cc, prov, mun, zona, rural, com, bai, seq } = b;
    const registrationType = b.registrationType ?? "formal";
    if (typeof lat !== "number" || typeof lng !== "number") {
      return json({ error: "lat/lng em falta" }, 400);
    }

    const gridSize = rural ? 25 : 10;
    const gridTag = rural ? "G25" : "G10";
    const zoneTag = rural ? "ZR" : "ZU";

    const { x, y } = toMercator(lat, lng);
    const ix = Math.floor(x / gridSize);
    const iy = Math.floor(y / gridSize);
    const xy = `X${encodeCoord(ix)}-Y${encodeCoord(iy)}`;

    const CC = (cc ?? "??").toUpperCase();
    const legacy = `${CC}-${zoneTag}-${gridTag}-${xy}`;

    // Nomenclatura: requer PROV + MUN + COM (bairro → "GEN" formal / "DIG" digital).
    const PROV = (prov ?? "").toUpperCase();
    const MUN = (mun ?? "").toUpperCase();
    const COM = (com ?? zona ?? "").toUpperCase();
    const BAI = (bai ?? (registrationType === "digital" ? "DIG" : "GEN")).toUpperCase();

    let code = legacy;
    if (PROV && MUN && COM) {
      code = [CC, PROV, MUN, COM, BAI, gridTag, xy].join("-");
      if (typeof seq === "number") code = `${code}-${String(seq).padStart(4, "0")}`;
    }

    const centroid = fromMercator(ix * gridSize + gridSize / 2, iy * gridSize + gridSize / 2);

    return json({ code, legacy, zone: rural ? "rural" : "urban", grid: gridTag, ix, iy, centroid }, 200);
  } catch (e) {
    return json({ error: String(e) }, 400);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
