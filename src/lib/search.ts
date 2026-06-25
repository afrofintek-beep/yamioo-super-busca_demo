// Motor de busca híbrido (cliente). Tenta a Edge Function de IA (provider-agnostic);
// se não estiver configurada ou falhar, usa um modo local resiliente.
// Os códigos AfroLoc dos resultados são bem formados (ilustrativos): as entidades
// informais não trazem coordenadas precisas — só o PIN do utilizador usa o codec real.

import type { Place } from "./places";
import { afrolocLocal } from "./afroloc";

const SEARCH_FN = import.meta.env.VITE_SEARCH_FN_URL as string | undefined;

export type Tipo = "local" | "servico" | "pessoa" | "oportunidade" | "conteudo";
export type Result = {
  nome: string; tipo: Tipo; categoria: string; descricao: string;
  preco: string | null; dist: number; conf: number; fresh: string;
  score: number; fonte: "web" | "local"; code: string;
};
export type Iny = { produto: string; mediana: string; tendencia: string } | null;
export type SearchResponse = { interpretacao: string; lingua: string; iny: Iny; resultados: Result[] };

const FRESH = ["agora mesmo", "há 2 h", "hoje", "há 1 dia", "há 3 dias", "esta semana"];
const num = (v: any, d: number) => (typeof v === "number" && !isNaN(v) ? v : d);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function normTipo(t: string): Tipo {
  t = (t || "").toLowerCase();
  if (t.startsWith("serv")) return "servico";
  if (t.startsWith("pess")) return "pessoa";
  if (t.startsWith("opor")) return "oportunidade";
  if (t.startsWith("cont")) return "conteudo";
  return "local";
}

export async function runSearch(query: string, place: Place): Promise<SearchResponse> {
  let parsed: any = null;
  if (SEARCH_FN) {
    try {
      const r = await fetch(SEARCH_FN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, place }),
      });
      const data = await r.json();
      parsed = tolerantParse(data.text || "");
    } catch { parsed = null; }
  }
  if (!parsed || !parsed.resultados || !parsed.resultados.length) parsed = fallback(query, place);
  return enrich(parsed, query, place);
}

function fallback(query: string, place: Place) {
  return {
    interpretacao: `Resultados locais para "${query}" em ${place.bairro} (modo resiliente).`,
    lingua_detectada: place.langs[0],
    iny: null,
    resultados: [
      { nome: `Banca de ${query}`, tipo: "local", categoria: "Mercado informal", descricao: `Vendedor de ${query} no mercado do bairro.`, preco: place.curr === "AKZ" ? "2.500 AKZ" : null },
      { nome: "Zé do Conserto", tipo: "servico", categoria: "Reparações", descricao: `Faz e arranja relacionado com "${query}". Atende ao domicílio.`, preco: null },
      { nome: `Ponto ${place.bairro}`, tipo: "local", categoria: "Comércio de rua", descricao: `Vendedores de ${query} concentrados nesta zona.`, preco: null },
      { nome: "Oportunidade local", tipo: "oportunidade", categoria: "Trabalho", descricao: `Procura-se ajudante ligado a "${query}" perto de ti.`, preco: null },
    ],
  };
}

function enrich(parsed: any, query: string, place: Place): SearchResponse {
  const rows: Result[] = (parsed.resultados || []).slice(0, 6).map((r: any, i: number) => {
    const seed = (r.nome || "") + i;
    const h = hash(seed);
    const dist = clamp(num(r.distancia_km, 0.2 + (h % 60) / 10), 0.1, 9);
    const conf = clamp(Math.round(num(r.confianca, 55 + (h % 44))), 40, 99);
    const fresh = r.frescura || FRESH[h % FRESH.length];
    const freshScore = 1 - Math.max(0, FRESH.indexOf(fresh)) / FRESH.length;
    const tipo = normTipo(r.tipo);
    const score = 0.5 * (1 - Math.min(dist, 9) / 9) + 0.3 * (conf / 100) + 0.2 * freshScore;
    return {
      nome: r.nome || "Sem nome", tipo, categoria: r.categoria || "",
      descricao: r.descricao || "", preco: r.preco && r.preco !== "null" ? r.preco : null,
      dist, conf, fresh, score, fonte: i % 3 === 0 ? "web" : "local",
      code: afrolocLocal(place, seed),
    };
  });
  rows.sort((a, b) => b.score - a.score);
  return {
    interpretacao: parsed.interpretacao || "",
    lingua: parsed.lingua_detectada || place.langs[0],
    iny: parsed.iny && parsed.iny.produto ? parsed.iny : null,
    resultados: rows,
  };
}

// Tolerante a JSON truncado vindo do modelo.
export function tolerantParse(raw: string): any {
  let t = (raw || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  try { return JSON.parse(t); } catch {}
  const out: any = { interpretacao: "", lingua_detectada: "", iny: null, resultados: [] };
  const mi = t.match(/"interpretacao"\s*:\s*"([^"]*)"/); if (mi) out.interpretacao = mi[1];
  const ml = t.match(/"lingua_detectada"\s*:\s*"([^"]*)"/); if (ml) out.lingua_detectada = ml[1];
  const ri = t.indexOf('"resultados"');
  if (ri >= 0) {
    const a = t.indexOf("[", ri);
    if (a >= 0) {
      let depth = 0, cur = "", inStr = false, esc = false;
      for (let i = a + 1; i < t.length; i++) {
        const c = t[i]; cur += c;
        if (esc) { esc = false; continue; }
        if (c === "\\") { esc = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (c === "{") depth++;
        else if (c === "}") { depth--; if (depth === 0) { try { out.resultados.push(JSON.parse(cur.slice(cur.indexOf("{")))); } catch {} cur = ""; } }
        else if (c === "]" && depth === 0) break;
      }
    }
  }
  return out;
}
