// ============================================================================
// Yamioo Documento — Edge Function (upload de documentos de validação)  [Deno]
// ----------------------------------------------------------------------------
// Recebe um ficheiro (base64), guarda-o no bucket privado `documentos` (service
// role), regista em `documentos` e põe a entidade em validacao='pendente'.
// Verify JWT = OFF.
//
//   POST { entidade_id, tipo, base64, mime }
//   200  { ok, path } | { ok:false, error }
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const clip = (s: any, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json();
    const entidade_id = clip(b.entidade_id, 40);
    const tipo = clip(b.tipo, 30);
    const mime = clip(b.mime, 60) || "application/octet-stream";
    const base64 = typeof b.base64 === "string" ? b.base64 : "";
    if (!entidade_id) return json({ ok: false, error: "Falta a entidade." }, 200);
    if (!tipo) return json({ ok: false, error: "Falta o tipo de documento." }, 200);
    if (!base64) return json({ ok: false, error: "Ficheiro vazio." }, 200);

    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)); }
    catch { return json({ ok: false, error: "Ficheiro inválido." }, 200); }
    if (bytes.length > 6 * 1024 * 1024) return json({ ok: false, error: "Ficheiro muito grande (máx 6 MB)." }, 200);

    const URL = Deno.env.get("SUPABASE_URL"), KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!URL || !KEY) return json({ ok: false, error: "Servidor mal configurado." }, 200);

    const ext = EXT[mime] || "bin";
    const path = `${entidade_id}/${tipo}-${Date.now()}.${ext}`;

    const up = await fetch(`${URL}/storage/v1/object/documentos/${path}`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": mime, "x-upsert": "true" },
      body: bytes,
    });
    if (!up.ok) return json({ ok: false, error: `Upload falhou (${up.status}).` }, 200);

    await fetch(`${URL}/rest/v1/documentos`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ entidade_id, tipo, path, mime, estado: "pendente" }),
    });
    await fetch(`${URL}/rest/v1/entidades?id=eq.${entidade_id}`, {
      method: "PATCH",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ validacao: "pendente" }),
    });

    return json({ ok: true, path }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
