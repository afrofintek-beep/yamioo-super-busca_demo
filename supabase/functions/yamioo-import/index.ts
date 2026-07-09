// ============================================================================
// Yamioo Import — Edge Function (importação em lote de pontos)  [Deno]
// ----------------------------------------------------------------------------
// Recebe linhas com coordenadas e insere em `entidades` (fonte='web'), com
// AFROLOC gerado pelo search/afroloc a partir de cc+coords. Dedupe por ext_id.
// Gate simples por x-import-key. Verify JWT = OFF.
//
//   POST { rows: [{ nome, tipo, categoria, descricao, lat, lng, ext_id }] }
//   200  { ok, recebidos } | { ok:false, error }
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-import-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const GATE = "imp-yamioo-8Fq2Zx7L";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if ((req.headers.get("x-import-key") || "") !== GATE) return json({ ok: false, error: "Não autorizado." }, 401);
    const { rows } = await req.json();
    if (!Array.isArray(rows)) return json({ ok: false, error: "rows em falta." }, 200);
    const clean = rows.map((r: any) => ({
      nome: String(r.nome || "").slice(0, 120),
      tipo: ["local", "servico", "pessoa", "oportunidade", "conteudo"].includes(r.tipo) ? r.tipo : "local",
      categoria: r.categoria ? String(r.categoria).slice(0, 80) : null,
      descricao: r.descricao ? String(r.descricao).slice(0, 300) : null,
      cc: "AO", lat: Number(r.lat), lng: Number(r.lng),
      confianca: 65, validado: false, fonte: "web", ext_id: String(r.ext_id || "").slice(0, 90),
    })).filter((r: any) => r.nome && isFinite(r.lat) && isFinite(r.lng) && r.ext_id);
    if (!clean.length) return json({ ok: true, recebidos: 0 }, 200);

    const URL = Deno.env.get("SUPABASE_URL"), KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!URL || !KEY) return json({ ok: false, error: "Servidor mal configurado." }, 200);
    const r = await fetch(`${URL}/rest/v1/entidades?on_conflict=ext_id`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(clean),
    });
    if (!r.ok) return json({ ok: false, error: `${r.status}: ${(await r.text()).slice(0, 160)}` }, 200);
    return json({ ok: true, recebidos: clean.length }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
