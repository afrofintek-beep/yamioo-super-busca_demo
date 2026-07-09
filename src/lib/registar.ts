// Cliente de registo — envia uma entidade para a Edge Function yamioo-registar,
// que a insere na tabela `entidades` e devolve o código AfroLoc gerado.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export type AlertaInput = {
  termo: string; contacto: string; cc: string; prov: string; mun: string; zona: string; lat: number; lng: number;
};
// "Avisa-me quando aparecer" — captura a procura sem oferta (arranque a frio):
// dá seguimento ao utilizador e diz-nos o que semear.
export async function avisarme(input: AlertaInput): Promise<{ ok: boolean; error?: string }> {
  if (!SUPABASE_URL) return { ok: false, error: "App sem ligação ao servidor." };
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/yamioo-alerta`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.ok === false) return { ok: false, error: d.error || "Não foi possível guardar." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Sem ligação. Tenta de novo." };
  }
}

// Nº real de entidades no índice (para mostrar na app em vez de um contador falso).
export async function contarEntidades(): Promise<number | null> {
  if (!SUPABASE_URL || !ANON) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/entidades?select=id`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) ? rows.length : null;
  } catch {
    return null;
  }
}

export type RegInput = {
  nome: string; tipo: string; categoria: string; descricao: string;
  preco: string | null; cc: string; prov: string; mun: string; zona: string;
  lat: number; lng: number;
};

export async function registar(input: RegInput): Promise<{ ok: boolean; code?: string; error?: string }> {
  if (!SUPABASE_URL) return { ok: false, error: "App sem ligação ao servidor." };
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/yamioo-registar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.ok === false) return { ok: false, error: d.error || "Não foi possível registar." };
    return { ok: true, code: d.code };
  } catch {
    return { ok: false, error: "Sem ligação. Tenta de novo." };
  }
}
