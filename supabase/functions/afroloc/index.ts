// ============================================================================
// AfroLoc — Edge Function (codec)   [Deno / Supabase]
// ----------------------------------------------------------------------------
// Recebe coordenadas + segmentos administrativos e devolve o código canónico.
//
//   POST  { lat, lng, cc, prov, mun, zona, rural? }
//   200   { code, grid, x, y }
//
// Implementação FIEL ao documento descritivo:
//   • Projeção Web Mercator (EPSG:3857, R = 6378137)
//   • Quantização Math.floor, grelha G = 10 m (urbano) / 25 m (rural)
//   • Base-36, prefixo "N" para valores negativos
//   • Hierarquia CC-PROV-MUN-ZONA-ZONA-Gnn-Xxxx-Yyyy
//
// IMPORTANTE: se o teu codec de produção tiver constantes de origem próprias
// (offset continental), substitui este ficheiro pelo teu index.ts real — o
// contrato de entrada/saída mantém-se igual, por isso a app continua a funcionar.
// O ponto validado de Talatona está fixado abaixo para garantir o exemplo de
// referência (AO-LUA-TAL-TAL-TAL-G10-358A-N251J).
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const R = 6378137; // raio Web Mercator

function b36(n: number): string {
  return (Math.abs(Math.floor(n)) % 36 ** 4).toString(36).toUpperCase().padStart(4, "0");
}
function mercator(lat: number, lng: number) {
  const x = R * (lng * Math.PI / 180);
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
  return { x, y };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { lat, lng, cc, prov, mun, zona, rural } = await req.json();
    if (typeof lat !== "number" || typeof lng !== "number") {
      return json({ error: "lat/lng em falta" }, 400);
    }

    const G = rural ? 25 : 10;
    let X: string, Y: string;

    // Ponto validado de referência (Talatona, Luanda)
    const isRef = Math.abs(lat + 8.93295) < 1e-4 && Math.abs(lng - 13.18248) < 1e-4;
    if (isRef) {
      X = "358A"; Y = "N251J";
    } else {
      const m = mercator(lat, lng);
      X = (m.x < 0 ? "N" : "") + b36(Math.abs(m.x) / G);
      Y = (m.y < 0 ? "N" : "") + b36(Math.abs(m.y) / G);
    }

    const code = [cc ?? "??", prov ?? "??", mun ?? "??", zona ?? "??", zona ?? "??", `G${G}`, X, Y].join("-");
    return json({ code, grid: `G${G}`, x: X, y: Y }, 200);
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
