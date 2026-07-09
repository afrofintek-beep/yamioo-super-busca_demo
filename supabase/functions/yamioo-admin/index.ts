// ============================================================================
// Yamioo Admin — Edge Function (painel de validação)  [Deno]
// ----------------------------------------------------------------------------
// Protegido por header `x-admin-key` === secret ADMIN_KEY (validação no servidor).
// Verify JWT = OFF (a segurança é a ADMIN_KEY).
//
//   POST { action: "listar" }
//     -> { pendentes: [{ ...entidade, documentos:[{tipo,mime,url}] }] }
//   POST { action: "decidir", entidade_id, decisao: "empresa"|"comunidade"|"rejeitar" }
//     -> { ok }
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const ADMIN = Deno.env.get("ADMIN_KEY");
    const given = req.headers.get("x-admin-key") || "";
    if (!ADMIN || given !== ADMIN) return json({ error: "Não autorizado." }, 401);

    const URL = Deno.env.get("SUPABASE_URL"), KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!URL || !KEY) return json({ error: "Servidor mal configurado." }, 500);
    const H = { apikey: KEY, Authorization: `Bearer ${KEY}` } as Record<string, string>;

    const b = await req.json();

    if (b.action === "listar") {
      const cols = "id,nome,perfil,categoria,mun,zona,afroloc,nif,forma_juridica,alvara,registo_comercial,rep_legal_nome,rep_legal_bi,telemovel,email,setor,n_trabalhadores,criado_em";
      const er = await fetch(`${URL}/rest/v1/entidades?validacao=eq.pendente&select=${cols}&order=criado_em.desc&limit=50`, { headers: H });
      const ents = er.ok ? await er.json() : [];
      const pendentes = [];
      for (const e of ents) {
        const dr = await fetch(`${URL}/rest/v1/documentos?entidade_id=eq.${e.id}&select=tipo,path,mime`, { headers: H });
        const docs = dr.ok ? await dr.json() : [];
        const documentos = [];
        for (const d of docs) {
          let url = null;
          try {
            const sr = await fetch(`${URL}/storage/v1/object/sign/documentos/${d.path}`, {
              method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 3600 }),
            });
            if (sr.ok) { const s = await sr.json(); url = `${URL}/storage/v1${s.signedURL}`; }
          } catch { /* ignore */ }
          documentos.push({ tipo: d.tipo, mime: d.mime, url });
        }
        pendentes.push({ ...e, documentos });
      }
      return json({ pendentes }, 200);
    }

    if (b.action === "decidir") {
      const id = String(b.entidade_id || "");
      if (!id) return json({ error: "Falta a entidade." }, 200);
      let patch: Record<string, unknown>;
      if (b.decisao === "empresa") patch = { verificado: true, nivel: "empresa", validacao: "verificado_empresa" };
      else if (b.decisao === "comunidade") patch = { verificado: true, nivel: "comunidade", validacao: "verificado_comunidade" };
      else patch = { verificado: false, validacao: "rejeitado" };
      const r = await fetch(`${URL}/rest/v1/entidades?id=eq.${id}`, {
        method: "PATCH", headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(patch),
      });
      if (!r.ok) return json({ error: `Falhou (${r.status}).` }, 200);
      return json({ ok: true }, 200);
    }

    return json({ error: "Ação inválida." }, 200);
  } catch (e) {
    return json({ error: String(e) }, 200);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
