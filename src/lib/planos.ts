// Planos do registo formal (Ideia 2). Preços ILUSTRATIVOS em AKZ — calibrar.
// O preço é sempre recalculado no servidor (yamioo-subscrever) — o cliente
// só mostra. Descontos: semestral −10%, anual −25%.

export type PlanoId = "verificado" | "pro";
export type Ciclo = "mensal" | "semestral" | "anual";

export const PLANOS: Record<PlanoId, { nome: string; mensal: number; da: string[] }> = {
  verificado: {
    nome: "Verificado",
    mensal: 2000,
    da: ["Selo ✓ Verificado", "Destaque no ranking", "Quem te procurou (stats)"],
  },
  pro: {
    nome: "Destaque Pro",
    mensal: 5000,
    da: ["Tudo do Verificado", "Topo garantido na zona", "Campanhas (Sumba)", "Elegível a crédito (Kilapi)"],
  },
};

export const CICLOS: { id: Ciclo; nome: string; meses: number; desconto: number }[] = [
  { id: "mensal", nome: "Mensal", meses: 1, desconto: 0 },
  { id: "semestral", nome: "Semestral", meses: 6, desconto: 0.10 },
  { id: "anual", nome: "Anual", meses: 12, desconto: 0.25 },
];

export function precoTotal(plano: PlanoId, ciclo: Ciclo): number {
  const c = CICLOS.find((x) => x.id === ciclo)!;
  return Math.round(PLANOS[plano].mensal * c.meses * (1 - c.desconto));
}

export const akz = (n: number) => n.toLocaleString("pt-PT") + " AKZ";
