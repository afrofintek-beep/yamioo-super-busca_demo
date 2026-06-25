# Yamioo — Super Motor de Busca

Motor de busca híbrido para a economia informal africana. Vite + React + TypeScript,
com o **AfroLoc ligado a uma Edge Function real do Supabase** e pesquisa por IA opcional.

Stack: React 18 · Vite 5 · TypeScript · Tailwind · Supabase Edge Functions (Deno) · Vercel.

---

## O que é real vs. ilustrativo

| Parte | Estado |
|---|---|
| Código AfroLoc do **PIN** (tua localização) | **Real** — gerado pelo codec (Edge Function) a partir das coordenadas |
| Códigos AfroLoc dos **resultados** | Bem formados, ilustrativos (entidades informais não trazem coordenadas precisas) |
| Pesquisa | **Real** se ligares a função `yamioo-search`; senão, modo local resiliente |
| Distância / confiança / frescura | Plausíveis (ainda não vêm do PostGIS) |

> O codec incluído segue fielmente o documento. Se o teu codec de produção tiver
> constantes de origem próprias, **substitui** `supabase/functions/afroloc/index.ts`
> pelo teu `index.ts` real — o contrato é o mesmo, a app não muda.

---

## Passo a passo (sem terminal)

### 1) Pôr no GitHub
1. github.com → **New repository** → nome `yamioo-super-busca` → **Create**.
2. Na página do repo vazio: **uploading an existing file**.
3. Arrasta **todo o conteúdo** desta pasta (incluindo as pastas `src/` e `supabase/`).
4. **Commit changes**.

### 2) Deploy na Vercel
1. vercel.com → **Add New… → Project** → importa o repo `yamioo-super-busca`.
2. Framework: **Vite** (deteta sozinho). Não mexas no build.
3. **Environment Variables** (cola estas):
   - `VITE_SUPABASE_URL` = o teu Project URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` = a tua anon public key
   - `VITE_SEARCH_FN_URL` = *(deixa vazio por agora)*
4. **Deploy**. Em ~1 min tens o link.

> A app já funciona aqui: o PIN mostra o código AfroLoc real e a pesquisa corre
> em modo local. Os passos 3 e 4 abaixo ligam o codec e a IA.

### 3) Edge Function AfroLoc (Supabase, no painel)
1. Supabase → o teu projeto → **Edge Functions** → **Create a new function**.
2. Nome: `afroloc`.
3. Cola o conteúdo de `supabase/functions/afroloc/index.ts` no editor → **Deploy**.
4. Em **Function settings**, confirma **Verify JWT = ON** (a app envia a anon key como Bearer).
5. Testa: volta à app, o cartão "Encontrámos-te" deve mostrar `· codec` no rótulo.

### 4) (Opcional) Pesquisa por IA real
1. Supabase → **Edge Functions** → **Create a new function** → nome `yamioo-search`.
2. Cola `supabase/functions/yamioo-search/index.ts` → **Deploy**.
3. **Project Settings → Edge Functions → Secrets** → adiciona
   `ANTHROPIC_API_KEY` = a tua chave.
4. Copia o URL da função (`https://<ref>.supabase.co/functions/v1/yamioo-search`).
5. Vercel → Project → **Settings → Environment Variables** → mete
   `VITE_SEARCH_FN_URL` = esse URL → **Redeploy**.

---

## CORS

As funções já respondem a qualquer origem (`Access-Control-Allow-Origin: *`),
para ser simples no arranque. Para produção, troca o `*` pelo domínio Vercel
em ambos os `index.ts`.

## Correr no teu Mac (Claude Code / opcional)
`npm install` e depois `npm run dev` → abre em `http://localhost:8080`.
Cria um ficheiro `.env` a partir de `.env.example` com as tuas chaves.
