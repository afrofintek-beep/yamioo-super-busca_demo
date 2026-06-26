import React, { useState, useEffect, useCallback } from "react";
import { PLACES, makePlace, DEFAULT_PLACE, type Place } from "./lib/places";
import { resolveAfroloc } from "./lib/afroloc";
import { runSearch, type Result, type Iny } from "./lib/search";
import { registar, contarEntidades } from "./lib/registar";

/* ---------- paleta / marca ---------- */
const INK = "#0A0E11", INK2 = "#0E141A", CARD = "#12191F";
const LINE = "rgba(255,255,255,0.08)";
const CREAM = "#F2E7D3", MUTE = "#8A95A1";
const ORANGE = "#FF7A1A", AMBER = "#FFB347", TEAL = "#19C6AC";
const GRAD = `linear-gradient(90deg, ${ORANGE} 0%, ${AMBER} 38%, ${TEAL} 100%)`;

const VERTICALS = [
  { id: "todos", label: "Tudo", glyph: "✦" },
  { id: "local", label: "Locais", glyph: "📍" },
  { id: "servico", label: "Serviços", glyph: "🔧" },
  { id: "pessoa", label: "Pessoas", glyph: "🧑" },
  { id: "oportunidade", label: "Oportunidades", glyph: "💼" },
  { id: "conteudo", label: "Conteúdo", glyph: "📰" },
];
const TIPO_LABEL: Record<string, string> = { local: "Local", servico: "Serviço", pessoa: "Pessoa", oportunidade: "Oportunidade", conteudo: "Conteúdo" };

export default function App() {
  const [place, setPlace] = useState<Place>(DEFAULT_PLACE);
  const [pin, setPin] = useState<{ code: string; real: boolean }>({ code: "AO-LUA-TAL-TAL-GEN-G10-X6AGK-Y4A31", real: false });
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [meta, setMeta] = useState<{ interpretacao: string; lingua: string; iny: Iny } | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [chip, setChip] = useState("todos");
  const [sheet, setSheet] = useState(false);
  const [reg, setReg] = useState(false);
  const [onboard, setOnboard] = useState(true);
  const [toast, setToast] = useState("");
  const [idx, setIdx] = useState<number | null>(null);
  const [langIdx, setLangIdx] = useState(0);
  const [phIdx, setPhIdx] = useState(0);

  const STAGES = ["A interpretar a tua procura…", "A pesquisar o índice de entidades…", "A calcular distâncias reais…", "A gerar códigos AfroLoc…", "A ordenar por proximidade e confiança…"];
  const PLACEHOLDERS = ["Qual o melhor mercado perto de mim?", "Onde comprar fubá ao melhor preço?", "Técnico de frigoríficos no bairro", `Quem vende telha em ${place.bairro}?`, "Moto-táxi disponível agora"];

  // resolve o código AfroLoc real do PIN sempre que muda o lugar
  useEffect(() => { let live = true; const lp = geo ? { ...place, lat: geo.lat, lng: geo.lng } : place; resolveAfroloc(lp).then((p) => { if (live) setPin(p); }); return () => { live = false; }; }, [place, geo]);
  useEffect(() => { contarEntidades().then(setIdx); }, []);
  useEffect(() => { const t = setInterval(() => setLangIdx((i) => (i + 1) % place.langs.length), 1700); return () => clearInterval(t); }, [place]);
  useEffect(() => { const t = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 3200); return () => clearInterval(t); }, [place]);
  useEffect(() => { if (!loading) return; let i = 0; const t = setInterval(() => { i = (i + 1) % STAGES.length; setStage(i); }, 650); return () => clearInterval(t); }, [loading]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const search = useCallback(async (q?: string) => {
    const term = (q ?? query).trim();
    if (!term) return;
    setQuery(term); setLoading(true); setResults(null); setMeta(null); setStage(0);
    const lp = geo ? { ...place, lat: geo.lat, lng: geo.lng } : place;
    const res = await runSearch(term, lp);
    setMeta({ interpretacao: res.interpretacao, lingua: res.lingua, iny: res.iny });
    setResults(res.resultados);
    setLoading(false); setChip("todos");
  }, [query, place, geo]);

  const voice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { flash("Entrada por voz indisponível neste navegador."); return; }
    try {
      const r = new SR(); r.lang = "pt-PT";
      r.onresult = (e: any) => { const t = e.results[0][0].transcript; setQuery(t); search(t); };
      r.onerror = () => flash("Não consegui ouvir. Tenta de novo.");
      r.start(); flash("A ouvir…");
    } catch { flash("Entrada por voz indisponível neste navegador."); }
  };

  const copy = (t: string) => { try { navigator.clipboard?.writeText(t); } catch {} };
  const shown = results ? (chip === "todos" ? results : results.filter((r) => r.tipo === chip)) : null;
  const suggestions = ["mercado perto", "preço do fubá hoje", "técnico de frigoríficos", "moto-táxi", "carpinteiro", "onde levantar dinheiro"];

  return (
    <div style={{ minHeight: "100vh", background: INK, color: CREAM, fontFamily: "ui-sans-serif, -apple-system, 'Segoe UI', Roboto, sans-serif", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 460, position: "relative", overflow: "hidden", minHeight: "100vh", background: `radial-gradient(120% 60% at 50% -10%, rgba(255,122,26,0.22), rgba(255,179,71,0.08) 30%, transparent 60%), linear-gradient(180deg, ${INK2}, ${INK} 40%)` }}>
        <div style={{ position: "absolute", top: -160, left: "50%", transform: "translateX(-50%)", width: 460, height: 320, background: "radial-gradient(closest-side, rgba(255,140,40,0.30), transparent)", filter: "blur(10px)", animation: "breathe 6s ease-in-out infinite", pointerEvents: "none" }} />

        <div style={{ position: "relative", padding: "22px 20px 120px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <Wordmark />
            <button onClick={() => setSheet(true)} style={pill}>
              <span style={{ width: 7, height: 7, borderRadius: 9, background: TEAL, boxShadow: `0 0 10px ${TEAL}`, animation: "ping 2.4s ease-in-out infinite" }} />
              <span style={{ fontWeight: 600 }}>{place.flag} {place.country}</span>
              <span style={{ color: MUTE }}>›</span><span>{place.city}</span>
              <span style={{ color: MUTE }}>›</span><span style={{ color: TEAL }}>{place.bairro}</span>
              <span style={{ color: MUTE, fontSize: 13 }}>⌄</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 2px 18px", fontSize: 12.5, color: MUTE }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: 9, background: ORANGE, animation: "ping 1.8s infinite" }} />
              <b style={{ color: CREAM, fontVariantNumeric: "tabular-nums" }}>{idx === null ? "…" : idx.toLocaleString("pt-PT")}</b> {idx === 1 ? "negócio real no índice" : "negócios reais no índice"}
            </span>
            <span style={badge}>⚡ Modo leve</span>
          </div>

          <div style={{ borderRadius: 18, padding: 1.5, background: GRAD, boxShadow: "0 16px 40px -18px rgba(255,122,26,0.5)" }}>
            <div style={{ background: INK2, borderRadius: 16.5, padding: "13px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 17, opacity: 0.85 }}>🔍</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }} placeholder={PLACEHOLDERS[phIdx]} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: CREAM, fontSize: 15.5 }} />
              <button onClick={voice} title="Pesquisar por voz" style={iconBtn}>🎙️</button>
              <button onClick={() => search()} style={{ ...goBtn, background: GRAD }}>Buscar</button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 4px 0", fontSize: 12.5, color: MUTE }}>
            <span>fala:</span>
            <span key={langIdx} style={{ color: TEAL, fontWeight: 600, animation: "fadein .5s" }}>{place.langs[langIdx]}</span>
            <span style={{ marginLeft: "auto", color: MUTE }}>híbrido · registo + web</span>
          </div>

          <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "16px 0 4px", margin: "0 -4px" }}>
            {VERTICALS.map((v) => {
              const on = chip === v.id;
              return (
                <button key={v.id} onClick={() => setChip(v.id)} style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", border: `1px solid ${on ? "transparent" : LINE}`, color: on ? "#06110F" : CREAM, background: on ? GRAD : "rgba(255,255,255,0.03)" }}>
                  <span style={{ fontSize: 13 }}>{v.glyph}</span>{v.label}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 18 }}>
            {loading && <Loading stage={STAGES[stage]} />}

            {!loading && !results && (
              <div style={{ textAlign: "center", padding: "26px 6px" }}>
                <p style={{ color: MUTE, fontSize: 14, lineHeight: 1.6, margin: "0 0 18px" }}>
                  O que o Google não vê: a banca, o ze-do-conserto, a quitandeira da esquina.
                  <br />Pesquisa o mundo real à tua volta em <b style={{ color: CREAM }}>{place.bairro}</b>.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                  {suggestions.map((s) => <button key={s} onClick={() => search(s)} style={chipGhost}>{s}</button>)}
                </div>
              </div>
            )}

            {!loading && results && (
              <div>
                {meta?.interpretacao && <p style={{ fontSize: 12.5, color: MUTE, margin: "0 2px 12px", lineHeight: 1.5 }}><span style={{ color: TEAL }}>⟶ </span>{meta.interpretacao}</p>}
                {meta?.iny && meta.iny.produto && <InyStrip iny={meta.iny} />}
                {shown && shown.length === 0 && <div style={{ textAlign: "center", color: MUTE, padding: "30px 0", fontSize: 14 }}>Sem entidades nesta vertical. Toca em <b style={{ color: CREAM }}>Tudo</b>.</div>}
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  {shown && shown.map((r, i) => <ResultCard key={r.code + i} r={r} onShare={() => { copy(r.code); try { window.location.href = `sms:?&body=${encodeURIComponent(`${r.nome} — AfroLoc: ${r.code}`)}`; } catch {} flash("Código copiado — a abrir SMS no telemóvel."); }} />)}
                </div>
                <p style={{ textAlign: "center", color: MUTE, fontSize: 11.5, marginTop: 18, lineHeight: 1.6 }}>
                  Ranking por <b style={{ color: CREAM }}>proximidade · confiança · frescura</b>.<br />
                  Cada ponto tem um código AfroLoc — partilhável por SMS, mesmo offline.
                </p>
              </div>
            )}
          </div>
        </div>

        {!onboard && (
          <button onClick={() => setReg(true)} title="Registar um negócio" style={fab}>
            <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>＋</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Registar</span>
          </button>
        )}

        {sheet && <Sheet place={place} onClose={() => setSheet(false)} onPick={(ci, bi) => { setPlace(makePlace(ci, bi)); setSheet(false); setResults(null); }} />}
        {reg && <RegisterSheet place={place} onClose={() => setReg(false)} onDone={(m) => { flash(m); contarEntidades().then(setIdx); }} />}
        {onboard && <Onboarding place={place} code={pin.code} real={pin.real} onGeo={(c) => setGeo(c)} onClose={() => setOnboard(false)} />}
        {toast && <div style={toastStyle}>{toast}</div>}
      </div>
    </div>
  );
}

function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "baseline", fontWeight: 800, fontSize: 27, letterSpacing: -1.2 }}>
      <span style={{ color: CREAM }}>yami</span>
      <span style={{ background: GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", fontWeight: 900 }}>oo</span>
    </div>
  );
}

function Loading({ stage }: { stage: string }) {
  return (
    <div style={{ padding: "30px 0", textAlign: "center" }}>
      <div style={{ display: "inline-flex", gap: 6, marginBottom: 16 }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: 9, height: 9, borderRadius: 9, background: GRAD, animation: `bounce 1s ${i * 0.15}s infinite ease-in-out` }} />)}
      </div>
      <div key={stage} style={{ color: MUTE, fontSize: 13.5, animation: "fadein .4s" }}>{stage}</div>
    </div>
  );
}

function ResultCard({ r, onShare }: { r: Result; onShare: () => void }) {
  const tipo = TIPO_LABEL[r.tipo] || "Local";
  const glyph = (VERTICALS.find((v) => v.id === r.tipo) || ({} as any)).glyph || "📍";
  return (
    <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 16, padding: 14, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: GRAD, opacity: 0.9 }} />
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ width: 40, height: 40, flex: "0 0 auto", borderRadius: 11, display: "grid", placeItems: "center", fontSize: 19, background: "rgba(255,255,255,0.04)", border: `1px solid ${LINE}` }}>{glyph}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: CREAM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.nome}</h3>
            <span style={{ ...tag, marginLeft: "auto" }}>{tipo}</span>
          </div>
          <div style={{ fontSize: 12, color: MUTE, marginTop: 1 }}>{r.categoria}{r.fonte === "web" ? " · 🌐 web" : " · índice local"}</div>
          <p style={{ margin: "7px 0 0", fontSize: 13.5, color: "#C9D2DB", lineHeight: 1.45 }}>{r.descricao}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            <Signal label={`${r.dist.toFixed(1)} km`} icon="📍" />
            <Signal label={`${r.conf}% confiança`} icon="✔" tone={r.conf >= 80 ? "good" : "mid"} />
            <Signal label={r.fresh} icon="🕒" />
            {r.preco && <Signal label={r.preco} icon="₳" tone="price" />}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 11, background: "rgba(25,198,172,0.07)", border: "1px solid rgba(25,198,172,0.22)", borderRadius: 10, padding: "7px 10px" }}>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11.5, color: TEAL, letterSpacing: 0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.code}</span>
            <button onClick={onShare} style={{ marginLeft: "auto", ...miniBtn }}>SMS ⇪</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Signal({ label, icon, tone }: { label: string; icon: string; tone?: string }) {
  const c = tone === "good" ? TEAL : tone === "price" ? AMBER : tone === "mid" ? "#C9D2DB" : MUTE;
  return <span style={{ fontSize: 11.5, color: c, background: "rgba(255,255,255,0.04)", border: `1px solid ${LINE}`, borderRadius: 8, padding: "4px 8px", fontWeight: 600 }}>{icon} {label}</span>;
}

function InyStrip({ iny }: { iny: { produto: string; mediana: string; tendencia: string } }) {
  const arrow = iny.tendencia === "subida" ? "▲" : iny.tendencia === "descida" ? "▼" : "▬";
  const col = iny.tendencia === "subida" ? "#FF6B6B" : iny.tendencia === "descida" ? TEAL : MUTE;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "linear-gradient(90deg, rgba(255,122,26,0.10), rgba(25,198,172,0.08))", border: `1px solid ${LINE}`, borderRadius: 13, padding: "11px 13px", marginBottom: 13 }}>
      <div style={{ fontSize: 11, color: AMBER, fontWeight: 800, letterSpacing: 1 }}>INY</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: CREAM, fontWeight: 600 }}>{iny.produto}</div>
        <div style={{ fontSize: 11.5, color: MUTE }}>mediana nacional</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: CREAM }}>{iny.mediana}</div>
        <div style={{ fontSize: 11.5, color: col, fontWeight: 700 }}>{arrow} {iny.tendencia}</div>
      </div>
    </div>
  );
}

function Sheet({ place, onClose, onPick }: { place: Place; onClose: () => void; onPick: (ci: number, bi: number) => void }) {
  const [q, setQ] = useState("");
  const filtered = PLACES.map((c, ci) => ({ c, ci })).filter(({ c }) => (c.country + " " + c.city).toLowerCase().includes(q.toLowerCase()));
  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "82%", background: INK2, borderTopLeftRadius: 22, borderTopRightRadius: 22, border: `1px solid ${LINE}`, padding: 18, overflowY: "auto", animation: "slideup .28s ease" }}>
        <div style={{ width: 40, height: 4, borderRadius: 9, background: LINE, margin: "0 auto 16px" }} />
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Escolher lugar</div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar país ou cidade…" style={{ width: "100%", background: INK, border: `1px solid ${LINE}`, borderRadius: 12, padding: "11px 13px", color: CREAM, outline: "none", fontSize: 14, marginBottom: 14 }} />
        {filtered.map(({ c, ci }) => (
          <div key={c.cc} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: MUTE, marginBottom: 8 }}>{c.flag} {c.country} · {c.city} <span style={{ color: TEAL }}>· até bairro</span></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {c.bairros.map((b, bi) => {
                const on = place.ci === ci && place.bi === bi;
                return <button key={b.n} onClick={() => onPick(ci, bi)} style={{ ...chipGhost, ...(on ? { background: GRAD, color: "#06110F", borderColor: "transparent" } : {}) }}>{b.n}</button>;
              })}
            </div>
          </div>
        ))}
        <div style={{ textAlign: "center", color: MUTE, fontSize: 11.5, padding: "6px 0 2px" }}>5 cidades-piloto · 54 países no produto completo</div>
      </div>
    </div>
  );
}

function RegisterSheet({ place, onClose, onDone }: { place: Place; onClose: () => void; onDone: (m: string) => void }) {
  const TIPOS = [["local", "📍 Local"], ["servico", "🔧 Serviço"], ["pessoa", "🧑 Pessoa"], ["oportunidade", "💼 Oportunidade"], ["conteudo", "📰 Conteúdo"]];
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("local");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [coords, setCoords] = useState({ lat: place.lat, lng: place.lng });
  const [gps, setGps] = useState<"idle" | "locating" | "on">("idle");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const useGps = () => {
    if (!navigator.geolocation) { setErr("GPS indisponível neste navegador."); return; }
    setGps("locating"); setErr("");
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setGps("on"); },
      () => { setGps("idle"); setErr("Não consegui obter o GPS. Uso o bairro selecionado."); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const submit = async () => {
    if (!nome.trim()) { setErr("Indica o nome do negócio."); return; }
    setBusy(true); setErr("");
    const res = await registar({
      nome, tipo, categoria, descricao, preco: preco.trim() || null,
      cc: place.cc, prov: place.prov, mun: place.mun, zona: place.zona,
      lat: coords.lat, lng: coords.lng,
    });
    setBusy(false);
    if (res.ok) { setDone(res.code || ""); onDone("Registado! Já aparece nas pesquisas."); }
    else setErr(res.error || "Não foi possível registar.");
  };

  const field: React.CSSProperties = { width: "100%", background: INK, border: `1px solid ${LINE}`, borderRadius: 12, padding: "11px 13px", color: CREAM, outline: "none", fontSize: 14, marginBottom: 10 };

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "90%", background: INK2, borderTopLeftRadius: 22, borderTopRightRadius: 22, border: `1px solid ${LINE}`, padding: 18, overflowY: "auto", animation: "slideup .28s ease" }}>
        <div style={{ width: 40, height: 4, borderRadius: 9, background: LINE, margin: "0 auto 16px" }} />
        {done === null ? (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Registar um negócio</div>
            <div style={{ fontSize: 12.5, color: MUTE, marginBottom: 14 }}>Fica no índice da Yamioo com um código AfroLoc próprio.</div>

            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome (ex: Quitanda da Dona Rosa)" style={field} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {TIPOS.map(([id, lbl]) => (
                <button key={id} onClick={() => setTipo(id)} style={{ ...chipGhost, padding: "7px 11px", fontSize: 12.5, ...(tipo === id ? { background: GRAD, color: "#06110F", borderColor: "transparent" } : {}) }}>{lbl}</button>
              ))}
            </div>
            <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Categoria (ex: Reparação de calçado)" style={field} />
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição curta (o que fazes / vendes)" rows={3} style={{ ...field, resize: "none", fontFamily: "inherit" }} />
            <input value={preco} onChange={(e) => setPreco(e.target.value)} placeholder={`Preço (opcional, ex: 500 ${place.curr})`} style={field} />

            <button onClick={useGps} style={{ ...chipGhost, width: "100%", padding: "11px", marginBottom: 6, ...(gps === "on" ? { borderColor: TEAL, color: TEAL } : {}) }}>
              {gps === "locating" ? "📡 A localizar…" : gps === "on" ? "✓ A usar o teu GPS" : `📍 Usar o meu GPS (ou fica em ${place.bairro})`}
            </button>
            <div style={{ fontSize: 11.5, color: MUTE, marginBottom: 12 }}>Local: {place.flag} {place.country} › {place.city} › {place.bairro}</div>

            {err && <div style={{ color: "#FF8A8A", fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
            <button onClick={submit} disabled={busy} style={{ ...goBtn, background: GRAD, width: "100%", padding: 13, fontSize: 15, opacity: busy ? 0.6 : 1, cursor: busy ? "default" : "pointer" }}>
              {busy ? "A registar…" : "Registar"}
            </button>
            <button onClick={onClose} style={{ ...linkBtn, marginTop: 10 }}>Cancelar</button>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "6px 4px 4px" }}>
            <div style={{ fontSize: 30, marginBottom: 4 }}>✅</div>
            <h2 style={{ margin: "2px 0 6px", fontSize: 19 }}>{nome} está no mapa</h2>
            <p style={{ color: MUTE, fontSize: 13, margin: "0 0 14px" }}>Já aparece quando alguém pesquisar perto de ti. Este é o teu código AfroLoc:</p>
            <div style={{ background: "rgba(25,198,172,0.08)", border: "1px solid rgba(25,198,172,0.25)", borderRadius: 12, padding: "12px", marginBottom: 16 }}>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 13.5, color: TEAL, fontWeight: 600, wordBreak: "break-all" }}>{done}</div>
            </div>
            <button onClick={() => { try { navigator.clipboard?.writeText(done); } catch {} onDone("Código copiado."); }} style={{ ...chipGhost, width: "100%", padding: 11, marginBottom: 8 }}>Copiar código</button>
            <button onClick={onClose} style={{ ...goBtn, background: GRAD, width: "100%", padding: 13, fontSize: 15 }}>Concluir</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Onboarding({ place, code, real, onGeo, onClose }: { place: Place; code: string; real: boolean; onGeo: (c: { lat: number; lng: number }) => void; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [sub, setSub] = useState(0);
  const [gpsNote, setGpsNote] = useState("");
  const STEPS = ["A localizar-te…", "A obter coordenadas", "A consultar a divisão administrativa", "A gerar o código AfroLoc"];
  useEffect(() => {
    if (step !== 1) return;
    let i = 0; const t = setInterval(() => { i++; if (i >= STEPS.length) { clearInterval(t); setStep(2); } else setSub(i); }, 560);
    return () => clearInterval(t);
  }, [step]);

  const askGps = () => {
    setStep(1); setSub(0); setGpsNote("");
    if (!navigator.geolocation) { setGpsNote("GPS indisponível — uso o bairro selecionado."); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => onGeo({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setGpsNote("Sem permissão de GPS — uso o bairro selecionado."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };
  return (
    <div style={{ ...overlay, display: "grid", placeItems: "center", padding: 22 }}>
      <div style={{ width: "100%", maxWidth: 360, background: INK2, border: `1px solid ${LINE}`, borderRadius: 22, padding: 22, position: "relative", boxShadow: "0 30px 80px -30px rgba(0,0,0,0.8)" }}>
        <div style={{ position: "absolute", top: -1, left: 30, right: 30, height: 2, background: GRAD, borderRadius: 9 }} />
        {step === 0 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 30, marginBottom: 6 }}>📍</div>
            <h2 style={{ margin: "4px 0 6px", fontSize: 20 }}>Onde estás?</h2>
            <p style={{ color: MUTE, fontSize: 13.5, lineHeight: 1.5, margin: "0 0 18px" }}>A Yamioo parte sempre de onde estás. Vamos resolver a tua morada num código AfroLoc.</p>
            <button onClick={askGps} style={{ ...goBtn, background: GRAD, width: "100%", padding: 13, fontSize: 15 }}>Permitir localização</button>
            <button onClick={onClose} style={{ ...linkBtn, marginTop: 12 }}>Escolher manualmente</button>
          </div>
        )}
        {step === 1 && (
          <div style={{ padding: "8px 4px" }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", opacity: i <= sub ? 1 : 0.3, transition: "opacity .3s" }}>
                <span style={{ width: 18, height: 18, borderRadius: 9, display: "grid", placeItems: "center", fontSize: 11, background: i < sub ? TEAL : "transparent", color: "#06110F", border: i >= sub ? `2px solid ${i === sub ? TEAL : LINE}` : "none", animation: i === sub ? "ping 1.2s infinite" : "none" }}>{i < sub ? "✓" : ""}</span>
                <span style={{ fontSize: 13.5, color: i <= sub ? CREAM : MUTE }}>{s}</span>
              </div>
            ))}
          </div>
        )}
        {step === 2 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 26 }}>✨</div>
              <h2 style={{ margin: "2px 0 0", fontSize: 19 }}>Encontrámos-te</h2>
            </div>
            <Row k="País" v={`${place.flag} ${place.country}`} />
            <Row k="Província" v={place.city} />
            <Row k="Município" v={place.mun === place.zona ? place.bairro : place.mun} />
            <Row k="Bairro / Divisão" v={place.bairro} last />
            <div style={{ marginTop: 12, background: "rgba(25,198,172,0.08)", border: "1px solid rgba(25,198,172,0.25)", borderRadius: 12, padding: "11px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 10.5, color: MUTE, letterSpacing: 1, marginBottom: 4 }}>CÓDIGO AFROLOC {real ? "· codec" : "· local"}</div>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 13.5, color: TEAL, fontWeight: 600 }}>{code}</div>
            </div>
            {gpsNote && <p style={{ color: MUTE, fontSize: 11.5, textAlign: "center", margin: "10px 0 0" }}>{gpsNote}</p>}
            <button onClick={onClose} style={{ ...goBtn, background: GRAD, width: "100%", padding: 13, fontSize: 15, marginTop: 16 }}>Continuar</button>
            <button onClick={onClose} style={{ ...linkBtn, marginTop: 10 }}>Não é aqui? Corrigir</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 2px", borderBottom: last ? "none" : `1px solid ${LINE}` }}><span style={{ color: MUTE, fontSize: 13 }}>{k}</span><span style={{ fontSize: 13.5, fontWeight: 600 }}>{v}</span></div>;
}

/* ---------- estilos ---------- */
const pill: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", border: `1px solid ${LINE}`, borderRadius: 999, padding: "6px 11px", fontSize: 12, color: CREAM, cursor: "pointer" };
const badge: React.CSSProperties = { background: "rgba(255,179,71,0.12)", border: "1px solid rgba(255,179,71,0.3)", color: AMBER, borderRadius: 999, padding: "3px 9px", fontSize: 11.5, fontWeight: 600 };
const goBtn: React.CSSProperties = { border: "none", borderRadius: 12, padding: "9px 15px", color: "#06110F", fontWeight: 800, fontSize: 13.5, cursor: "pointer" };
const iconBtn: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: `1px solid ${LINE}`, borderRadius: 10, width: 36, height: 36, fontSize: 15, cursor: "pointer", color: CREAM };
const chipGhost: React.CSSProperties = { background: "rgba(255,255,255,0.04)", border: `1px solid ${LINE}`, color: CREAM, borderRadius: 999, padding: "8px 13px", fontSize: 13, cursor: "pointer", fontWeight: 500 };
const tag: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: TEAL, background: "rgba(25,198,172,0.12)", border: "1px solid rgba(25,198,172,0.25)", borderRadius: 7, padding: "2px 7px" };
const miniBtn: React.CSSProperties = { background: "rgba(25,198,172,0.15)", border: "1px solid rgba(25,198,172,0.3)", color: TEAL, borderRadius: 8, padding: "4px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" };
const linkBtn: React.CSSProperties = { background: "transparent", border: "none", color: MUTE, fontSize: 13, cursor: "pointer", width: "100%", textAlign: "center" };
const overlay: React.CSSProperties = { position: "absolute", inset: 0, background: "rgba(4,7,9,0.72)", backdropFilter: "blur(4px)", zIndex: 40 };
const toastStyle: React.CSSProperties = { position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1B242C", border: `1px solid ${LINE}`, color: CREAM, padding: "10px 16px", borderRadius: 12, fontSize: 13, zIndex: 60, boxShadow: "0 14px 40px -14px rgba(0,0,0,0.7)", maxWidth: "88%", textAlign: "center" };
const fab: React.CSSProperties = { position: "absolute", right: 18, bottom: 22, zIndex: 30, display: "inline-flex", alignItems: "center", gap: 7, padding: "12px 16px", borderRadius: 999, border: "none", background: GRAD, color: "#06110F", cursor: "pointer", boxShadow: "0 14px 34px -12px rgba(255,122,26,0.6)" };
