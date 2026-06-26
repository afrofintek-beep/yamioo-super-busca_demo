// Cliente AfroLoc — provider-agnostic, no espírito de geocoding.ts / payments.ts.
// O codec REAL vive numa Edge Function do Supabase. Este cliente chama-a e,
// se estiver indisponível, gera o MESMO código localmente (algoritmo idêntico —
// portado de afroloc-app/src/lib/afroloc), por isso a app nunca parte e o PIN
// offline coincide com o online.

import type { Place } from "./places";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export type AfroLocInput = {
  lat: number; lng: number; cc: string; prov: string; mun: string; zona: string; rural?: boolean;
};

// ---- codec oficial (Web Mercator + base36 zig-zag), igual à Edge Function ----
const R = 6378137.0;
const MAX_LAT = 85.05112878;
function toMercator(lat: number, lon: number) {
  const clampLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const x = R * (lon * (Math.PI / 180));
  const y = R * Math.log(Math.tan(Math.PI / 4 + (clampLat * (Math.PI / 180)) / 2));
  return { x, y };
}
function encodeCoord(n: number): string {
  const u = n >= 0 ? n * 2 : -n * 2 - 1;
  return u.toString(36).toUpperCase();
}
function tiles(lat: number, lng: number, rural?: boolean) {
  const gridSize = rural ? 25 : 10;
  const { x, y } = toMercator(lat, lng);
  return { ix: Math.floor(x / gridSize), iy: Math.floor(y / gridSize) };
}
// Nomenclatura CC-PROV-MUN-COM-BAI-G10-X…-Y… a partir de coordenadas reais.
export function afrolocReal(
  p: { cc: string; prov: string; mun: string; zona: string }, lat: number, lng: number, rural?: boolean,
): string {
  const { ix, iy } = tiles(lat, lng, rural);
  const gridTag = rural ? "G25" : "G10";
  const xy = `X${encodeCoord(ix)}-Y${encodeCoord(iy)}`;
  return [p.cc, p.prov, p.mun, p.zona, "GEN", gridTag, xy].join("-");
}

// ---- códigos ilustrativos dos resultados (entidades informais sem coordenadas
// precisas): mesma FORMA do produto, agrupados perto do utilizador via hash. ----
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function afrolocLocal(
  p: { cc: string; prov: string; mun: string; zona: string; lat?: number; lng?: number }, seed: string,
): string {
  const h = hash(p.cc + p.zona + seed);
  // Se temos a posição do utilizador, partimos da sua célula e deslocamos uns
  // poucos tiles (resultados ficam plausivelmente "à volta"); senão, puro hash.
  let ix: number, iy: number;
  if (typeof p.lat === "number" && typeof p.lng === "number") {
    const base = tiles(p.lat, p.lng);
    ix = base.ix + ((h & 0xff) - 128);
    iy = base.iy + (((h >>> 8) & 0xff) - 128);
  } else {
    ix = h & 0x7fffff;
    iy = (hash(seed + "y") ^ h) & 0x7fffff;
  }
  const xy = `X${encodeCoord(ix)}-Y${encodeCoord(iy)}`;
  return [p.cc, p.prov, p.mun, p.zona, "GEN", "G10", xy].join("-");
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
// Usa o codec da Edge Function; se falhar, gera o MESMO código localmente.
export async function resolveAfroloc(place: Place): Promise<{ code: string; real: boolean }> {
  const code = await callCodec({
    lat: place.lat, lng: place.lng, cc: place.cc, prov: place.prov, mun: place.mun, zona: place.zona,
  });
  if (code) return { code, real: true };
  return { code: afrolocReal(place, place.lat, place.lng), real: false };
}
