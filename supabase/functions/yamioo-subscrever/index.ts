// ============================================================================
// Yamioo Subscrever — Edge Function (pedido de registo formal / selo)  [Deno]
// ----------------------------------------------------------------------------
// Regista um PEDIDO de subscrição (estado='pedido'). O preço é calculado no
// servidor (nunca confiar no cliente). A ativação (verificado=true) faz-se
// depois — via pagamento Multicaixa (quando houver login) ou por agente/admin.
// Verify JWT = OFF.
//
//   POST { plano, ciclo, nome, contacto, entidade_id?, afroloc?, cc?, prov?, mun?, zona? }
//   200  { ok, plano, ciclo, valor_akz } | { ok:false, error }
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MENSAL: Record<string, number> = { verificado: 2000, pro: 5000 };
const CICLO: Record<string, { meses: number; desc: number }> = {
  mensal: { meses: 1, desc: 0 }, semestral: { meses: 6, desc: 0.10 }, anual: { meses: 12, desc: 0.25 },
};
const clip = (s: any, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json();
    const plano = clip(b.plano, 20);
    const ciclo = clip(b.ciclo, 20);
    const contacto = clip(b.contacto, 120);
    if (!(plano in MENSAL)) return json({ ok: false, error: "Plano inválido." }, 200);
    if (!(ciclo in CICLO)) return json({ ok: false, error: "Ciclo inválido." }, 200);
    if (!contacto) return json({ ok: false, error: "Indica um contacto." }, 200);

    const c = CICLO[ciclo];
    const valor_akz = Math.round(MENSAL[plano] * c.meses * (1 - c.desc));

    const row = {
      plano, ciclo, valor_akz,
      entidade_id: clip(b.entidade_id, 40) || null,
      afroloc: clip(b.afroloc, 80) || null,
      nome: clip(b.nome, 120) || null,
      contacto, estado: "pedido",
    };

    const URL = Deno.env.get("SUPABASE_URL"), KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!URL || !KEY) return json({ ok: false, error: "Servidor mal configurado." }, 200);

    const r = await fetch(`${URL}/rest/v1/subscricoes`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
    if (!r.ok) return json({ ok: false, error: `Falhou (${r.status}).` }, 200);
    return json({ ok: true, plano, ciclo, valor_akz }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
