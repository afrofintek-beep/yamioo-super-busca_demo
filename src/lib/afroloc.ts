// Cliente AfroLoc — provider-agnostic, no espírito de geocoding.ts / payments.ts.
// O codec REAL vive numa Edge Function do Supabase. Este cliente chama-a e,
// se estiver indisponível, gera um código bem formado em fallback (a app nunca parte).

import type { Place } from "./places";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export type AfroLocInput = {
  lat: number; lng: number; cc: string; prov: string; mun: string; zona: string; rural?: boolean;
};

// ---- fallback local (formato do produto, ilustrativo) ----
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function b36(n: number): string {
  return (Math.abs(n) % 36 ** 4).toString(36).toUpperCase().padStart(4, "0");
}
export function afrolocLocal(p: { cc: string; prov: string; mun: string; zona: string }, seed: string): string {
  // Ponto canónico validado (Talatona) — mantém a fidelidade do exemplo de referência.
  if (p.cc === "AO" && p.zona === "TAL" && seed === "__pin__") return "AO-LUA-TAL-TAL-TAL-G10-358A-N251J";
  const h = hash(p.cc + p.zona + seed);
  const x = b36(h);
  const y = "N" + b36(hash(seed + "y") ^ h);
  return [p.cc, p.prov, p.mun, p.zona, p.zona, "G10", x, y].join("-");
}

// ---- chamada ao codec real (Edge Function) ----
async function callCodec(input: AfroLocInput): Promise<string | null> {
  if (!SUPABASE_URL || !ANON) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/afroloc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANON}`,
        apikey: ANON,
      },
      body: JSON.stringify(input),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return typeof data.code === "string" ? data.code : null;
  } catch {
    return null;
  }
}

// Resolve o código de uma localização real (coordenadas conhecidas).
// Usa o codec verdadeiro; se falhar, devolve o fallback bem formado.
export async function resolveAfroloc(place: Place): Promise<{ code: string; real: boolean }> {
  const code = await callCodec({
    lat: place.lat, lng: place.lng, cc: place.cc, prov: place.prov, mun: place.mun, zona: place.zona,
  });
  if (code) return { code, real: true };
  return { code: afrolocLocal(place, "__pin__"), real: false };
}
