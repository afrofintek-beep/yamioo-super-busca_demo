// ============================================================================
// Yamioo Search — Edge Function (camada de IA provider-agnostic)  [Deno]
// ----------------------------------------------------------------------------
// Opcional. Liga a pesquisa "super" a um LLM, com a chave guardada como SECRET
// no Supabase (nunca exposta ao frontend).
//
//   POST { query, place }   ->   200 { text }   (JSON dentro de "text")
//
// Configurar SECRET no painel:
//   Supabase -> Project Settings -> Edge Functions -> Secrets
//   ANTHROPIC_API_KEY = sk-ant-...
//
// Trocar de fornecedor depois é só mudar este ficheiro — o frontend não muda.
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { query, place } = await req.json();
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ text: "", error: "ANTHROPIC_API_KEY em falta" }, 200);

    const ctx = `${place.country} › ${place.city} › ${place.bairro}`;
    const lang = (place.langs && place.langs[0]) || "Português";
    const prompt =
`És o motor de busca híbrido da Yamioo, para a economia informal africana — vendedores ambulantes, quitandas, técnicos, mercados, prestadores e pontos sem morada formal nem website.
Utilizador em: ${ctx}. Moeda: ${place.curr}. Língua: ${lang}.
Procura: "${query}"

Devolve APENAS JSON válido (sem markdown), no formato:
{"interpretacao":"<1 frase>","lingua_detectada":"${lang}","iny":{"produto":"<se for um bem>","mediana":"<valor + ${place.curr}>","tendencia":"subida|estável|descida"} ou null,"resultados":[{"nome":"<local e real>","tipo":"local|servico|pessoa|oportunidade|conteudo","categoria":"<curta>","descricao":"<1 frase>","distancia_km":<0.1-8>,"confianca":<40-99>,"frescura":"<ex: hoje>","preco":"<valor + ${place.curr} ou null>"}]}
Máximo 5 resultados. Responde em ${lang}.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await r.json();
    const text = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
    return json({ text }, 200);
  } catch (e) {
    return json({ text: "", error: String(e) }, 200);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
