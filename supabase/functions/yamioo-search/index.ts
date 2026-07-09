// ============================================================================
// Yamioo Search — Edge Function (motor híbrido sobre DADOS REAIS)  [Deno]
// ----------------------------------------------------------------------------
// Fase 1: pesquisa a tabela `entidades` (registo real) por texto + país,
// calcula DISTÂNCIA real (haversine) e o CÓDIGO AFROLOC real de cada entidade,
// e usa o Claude apenas para INTERPRETAR/ORDENAR (não para inventar resultados).
//
//   POST { query, place }  ->  200 { text }   (JSON dentro de "text")
//
// Env (injetadas pelo Supabase): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Secret opcional: ANTHROPIC_API_KEY (melhora interpretação + índice de preços).
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── codec AFROLOC (igual à função afroloc / ao cliente) ──
const R = 6378137.0, MAX_LAT = 85.05112878;
function toMercator(lat: number, lon: number) {
  const c = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  return { x: R * (lon * Math.PI / 180), y: R * Math.log(Math.tan(Math.PI / 4 + (c * Math.PI / 180) / 2)) };
}
function encodeCoord(n: number): string {
  const u = n >= 0 ? n * 2 : -n * 2 - 1;
  return u.toString(36).toUpperCase();
}
function afrolocCode(e: any): string {
  const { x, y } = toMercator(e.lat, e.lng);
  const ix = Math.floor(x / 10), iy = Math.floor(y / 10);
  const xy = `X${encodeCoord(ix)}-Y${encodeCoord(iy)}`;
  const cc = (e.cc ?? "??").toUpperCase();
  if (e.prov && e.mun && e.zona) {
    return [cc, e.prov, e.mun, e.zona, "GEN", "G10", xy].join("-").toUpperCase();
  }
  return `${cc}-ZU-G10-${xy}`;
}

function haversineKm(la1: number, lo1: number, la2: number, lo2: number) {
  const Re = 6371, rad = (d: number) => d * Math.PI / 180;
  const dLa = rad(la2 - la1), dLo = rad(lo2 - lo1);
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(dLo / 2) ** 2;
  return Re * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function frescura(iso: string): string {
  if (!iso) return "recente";
  const days = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (days < 0.05) return "agora mesmo";
  if (days < 1) return "hoje";
  if (days < 2) return "há 1 dia";
  if (days < 7) return `há ${Math.round(days)} dias`;
  if (days < 30) return "esta semana";
  return "este mês";
}

async function fetchEntidades(query: string, cc: string): Promise<any[]> {
  const URL = Deno.env.get("SUPABASE_URL");
  const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!URL || !KEY) return [];
  const terms = query.trim().split(/\s+/).filter((t) => t.length >= 3).slice(0, 4);
  const pats = (terms.length ? terms : [query.trim()]).map((t) => encodeURIComponent(`*${t}*`));
  const orParts: string[] = [];
  for (const p of pats) { orParts.push(`nome.ilike.${p}`, `categoria.ilike.${p}`, `descricao.ilike.${p}`); }
  const or = `or=(${orParts.join(",")})`;

  async function run(withCc: boolean): Promise<any[]> {
    const q = `${URL}/rest/v1/entidades?select=*&${withCc ? `cc=eq.${encodeURIComponent(cc)}&` : ""}${or}&limit=60`;
    const r = await fetch(q, { headers: { apikey: KEY!, Authorization: `Bearer ${KEY}` } });
    if (!r.ok) return [];
    return await r.json();
  }
  let rows = await run(true);
  if (!rows.length) rows = await run(false);            // alarga a outros países se vazio
  return rows;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { query, place } = await req.json();
    const cc = (place?.cc ?? "").toUpperCase();
    const lang = (place?.langs && place.langs[0]) || "Português";

    const rows = await fetchEntidades(String(query ?? ""), cc);

    // Enriquecer com distância + código AFROLOC reais, ordenar por relevância.
    const enriched = rows.map((e: any) => {
      const dist = (typeof place?.lat === "number" && typeof place?.lng === "number")
        ? haversineKm(place.lat, place.lng, e.lat, e.lng) : 0;
      const conf = Math.max(40, Math.min(99, e.confianca ?? 70));
      const score = 0.55 * (1 - Math.min(dist, 10) / 10) + 0.3 * (conf / 100) + (e.validado ? 0.15 : 0);
      return {
        nome: e.nome, tipo: e.tipo || "local", categoria: e.categoria || "",
        descricao: e.descricao || "", preco: e.preco ?? null,
        distancia_km: Math.round(dist * 10) / 10, confianca: conf,
        frescura: frescura(e.atualizado_em), code: e.afroloc ?? afrolocCode(e),
        fonte: e.fonte === "web" ? "web" : "local", _score: score,
      };
    }).sort((a, b) => b._score - a._score).slice(0, 6);

    // Interpretação/índice de preços via Claude (opcional) — só sobre dados reais.
    let interpretacao = enriched.length
      ? `Encontrámos ${enriched.length} resultado(s) reais para "${query}" perto de ${place?.bairro ?? ""}.`
      : `Ainda não há entidades registadas para "${query}" em ${place?.bairro ?? "esta zona"}.`;
    let iny: any = null;

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (key && enriched.length) {
      try {
        const ctx = enriched.map((r) => `- ${r.nome} (${r.categoria}, ${r.preco ?? "s/preço"}, ${r.distancia_km}km)`).join("\n");
        const prompt =
`És o motor de busca da Yamioo (economia informal africana). O utilizador procura "${query}" em ${place?.country} › ${place?.city} › ${place?.bairro} (moeda ${place?.curr}, língua ${lang}).
Estes são os resultados REAIS da base de dados:
${ctx}
Devolve APENAS JSON válido (sem markdown):
{"interpretacao":"<1 frase em ${lang}>","iny": {"produto":"<bem, se aplicável>","mediana":"<valor + ${place?.curr}>","tendencia":"subida|estável|descida"} ou null}
Não inventes entidades; baseia-te só nos resultados acima.`;
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 400, messages: [{ role: "user", content: prompt }] }),
        });
        const data = await r.json();
        const txt = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
        const m = txt.match(/\{[\s\S]*\}/);
        if (m) { const j = JSON.parse(m[0]); if (j.interpretacao) interpretacao = j.interpretacao; if (j.iny && j.iny.produto) iny = j.iny; }
      } catch { /* mantém interpretação determinística */ }
    }

    const out = { interpretacao, lingua_detectada: lang, iny, resultados: enriched.map(({ _score, ...r }) => r) };

    // Nível 2 — evento de PROCURA (best-effort): sinal de procura por zona/termo
    // que a Kilapi lê. O `afroloc` aqui é o LUGAR de quem procura.
    const URL = Deno.env.get("SUPABASE_URL");
    const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (URL && KEY) {
      const searcherAfroloc = (typeof place?.lat === "number" && typeof place?.lng === "number")
        ? afrolocCode({ lat: place.lat, lng: place.lng, cc, prov: place?.prov, mun: place?.mun, zona: place?.zona })
        : null;
      await logEvento(URL, KEY, {
        tipo: "procura",
        afroloc: searcherAfroloc,
        cc, prov: place?.prov ?? null, mun: place?.mun ?? null,
        termo: String(query ?? "").slice(0, 120),
        meta: { n_resultados: enriched.length, bairro: place?.bairro ?? null },
      });
    }

    return json({ text: JSON.stringify(out) }, 200);
  } catch (e) {
    return json({ text: "", error: String(e) }, 200);
  }
});

// Escreve um evento no livro de atividade (best-effort; erros ignorados).
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
