import React, { useState, useEffect, useCallback, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PLACES, makePlace, DEFAULT_PLACE, type Place } from "./lib/places";
import { resolveAfroloc, decodeAfroloc } from "./lib/afroloc";
import { runSearch, type Result, type Iny } from "./lib/search";
import { registar, contarEntidades, avisarme, subscrever, enviarDocumento, admin } from "./lib/registar";
import { PLANOS, CICLOS, precoTotal, akz, type PlanoId, type Ciclo } from "./lib/planos";
import { gerarCartao, deeplink, baixar } from "./lib/cartao";
import { atividadesPara } from "./lib/atividades";

/* ---------- paleta / marca ---------- */
const INK = "#0c1420", INK2 = "#141019", CARD = "#181521";
const LINE = "rgba(255,255,255,0.09)";
const CREAM = "#F2E7D3", MUTE = "#9A96A3";
const ORANGE = "#FF6B35", AMBER = "#FFB347", TEAL = "#19C6AC";
const GRAD = `linear-gradient(90deg, ${ORANGE} 0%, ${AMBER} 45%, ${TEAL} 100%)`;
// fundo quente (bordô no topo → navy em baixo), como o yamioo.com
const BG = `radial-gradient(90% 60% at 50% -5%, rgba(150,52,58,0.34), rgba(84,36,52,0.12) 38%, transparent 62%), linear-gradient(180deg, #26141a 0%, #17131f 46%, #0c1420 100%)`;
const FONT = "'Poppins', ui-sans-serif, -apple-system, 'Segoe UI', Roboto, sans-serif";

const VERTICALS = [
  { id: "todos", label: "Todos", icon: "sparkles" },
  { id: "pessoa", label: "Pessoas", icon: "user" },
  { id: "local", label: "Locais", icon: "pin" },
  { id: "servico", label: "Serviços", icon: "tool" },
  { id: "conteudo", label: "Conteúdo", icon: "news" },
  { id: "oportunidade", label: "Oportunidades", icon: "briefcase" },
];
const TIPO_LABEL: Record<string, string> = { local: "Local", servico: "Serviço", pessoa: "Pessoa", oportunidade: "Oportunidade", conteudo: "Conteúdo" };

// Atalhos de descoberta — muitas escolhas de busca à primeira vista (esp. desktop).
const EXPLORAR: { label: string; icon: string }[] = [
  { label: "Mercado", icon: "pin" }, { label: "Farmácia", icon: "pin" }, { label: "Banco", icon: "pin" },
  { label: "Restaurante", icon: "pin" }, { label: "Padaria", icon: "pin" }, { label: "Quitanda", icon: "pin" },
  { label: "Kinguila", icon: "pin" }, { label: "Sapateiro", icon: "tool" }, { label: "Alfaiate", icon: "tool" },
  { label: "Canalizador", icon: "tool" }, { label: "Eletricista", icon: "tool" }, { label: "Mecânico", icon: "tool" },
  { label: "Mototáxi", icon: "tool" }, { label: "Informático", icon: "tool" }, { label: "Cabeleireiro", icon: "user" },
  { label: "Barbearia", icon: "pin" },
];

export default function App() {
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("validar")) return <Painel />;
  const [place, setPlace] = useState<Place>(DEFAULT_PLACE);
  const [pin, setPin] = useState<{ code: string; real: boolean }>({ code: "AO-LUA-TAL-TAL-GEN-G10-X6AGK-Y4A31", real: false });
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [meta, setMeta] = useState<{ interpretacao: string; lingua: string; iny: Iny } | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [chip, setChip] = useState("todos");
  const [vista, setVista] = useState<"lista" | "mapa">("lista");
  const [mapaPonto, setMapaPonto] = useState<Result | null>(null);
  const [detalhe, setDetalhe] = useState<Result | null>(null);
  const [sheet, setSheet] = useState(false);
  const [reg, setReg] = useState(false);
  const [planos, setPlanos] = useState<{ nome: string; code: string } | null>(null);
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
  const clearSearch = () => { setQuery(""); setResults(null); setMeta(null); setChip("todos"); };
  const shown = results ? (chip === "todos" ? results : results.filter((r) => r.tipo === chip)) : null;
  // Sugestões que GANHAM — só termos com resultados reais no índice (arranque a frio).
  const suggestions = ["banco", "farmácia", "restaurante", "mercado"];

  return (
    <div style={{ minHeight: "100vh", background: INK, color: CREAM, fontFamily: FONT, display: "flex", justifyContent: "center" }}>
      <div className="wrap" style={{ position: "relative", overflow: "hidden", minHeight: "100vh", background: BG }}>
        <div style={{ position: "absolute", top: -180, left: "50%", transform: "translateX(-50%)", width: 440, height: 300, background: "radial-gradient(closest-side, rgba(255,140,40,0.16), transparent)", filter: "blur(14px)", animation: "breathe 6s ease-in-out infinite", pointerEvents: "none" }} />

        <div style={{ position: "relative", padding: "22px 20px 120px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <button onClick={clearSearch} title="Início" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><Wordmark /></button>
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
            <span style={{ ...badge, display: "inline-flex", alignItems: "center", gap: 5 }}><Icon n="bolt" size={12} /> Modo leve</span>
          </div>

          <div style={{ fontSize: 14, color: MUTE, textAlign: "center", margin: "4px 0 14px" }}>Descobre mais. Pesquisa com contexto.</div>
          <div style={{ borderRadius: 16, border: `1px solid ${LINE}`, background: "rgba(255,255,255,0.03)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: MUTE, display: "flex", opacity: 0.85 }}><Icon n="search" size={18} /></span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); if (e.key === "Escape") clearSearch(); }} placeholder="Pesquisar pessoas, locais e serviços" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: CREAM, fontSize: 15.5, fontFamily: FONT }} />
            {(query || results) && <button onClick={clearSearch} title="Limpar" style={{ ...iconBtn, display: "grid", placeItems: "center", color: MUTE }}><Icon n="x" size={16} /></button>}
            <button onClick={voice} title="Pesquisar por voz" style={{ ...iconBtn, display: "grid", placeItems: "center" }}><Icon n="mic" size={17} /></button>
            <button onClick={() => search()} style={{ ...goBtn, background: ORANGE, color: "#fff" }}>Buscar</button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 4px 0", fontSize: 12.5, color: MUTE }}>
            <span>fala:</span>
            <span key={langIdx} style={{ color: TEAL, fontWeight: 600, animation: "fadein .5s" }}>{place.langs[langIdx]}</span>
            <span style={{ marginLeft: "auto", color: MUTE }}>híbrido · registo + web</span>
          </div>

          <div style={{ position: "relative", margin: "0 -4px" }}>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "16px 4px 4px" }}>
            {VERTICALS.map((v) => {
              const on = chip === v.id;
              return (
                <button key={v.id} onClick={() => setChip(v.id)} style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", border: `1px solid ${on ? "transparent" : LINE}`, color: on ? "#fff" : CREAM, background: on ? ORANGE : "rgba(255,255,255,0.05)" }}>
                  <Icon n={v.icon} size={15} />{v.label}
                </button>
              );
            })}
          </div>
          <div style={{ position: "absolute", right: 0, top: 16, bottom: 4, width: 32, background: `linear-gradient(90deg, transparent, ${INK})`, pointerEvents: "none" }} />
          </div>

          <div style={{ marginTop: 18 }}>
            {loading && <Loading stage={STAGES[stage]} />}

            {!loading && !results && (
              <div style={{ textAlign: "center", padding: "26px 6px" }}>
                <p style={{ color: MUTE, fontSize: 14, lineHeight: 1.6, margin: "0 0 18px" }}>
                  O que o Google não vê: a banca, o ze-do-conserto, a quitandeira da esquina.
                  <br />Pesquisa o mundo real à tua volta em <b style={{ color: CREAM }}>{place.bairro}</b>.
                </p>
                <div style={{ fontSize: 11.5, color: TEAL, letterSpacing: 0.3, marginBottom: 10, display: "inline-flex", alignItems: "center", gap: 6 }}><Icon n="check" size={13} />já no mapa perto de ti</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                  {suggestions.map((s) => <button key={s} className="ychip" onClick={() => search(s)} style={chipGhost}>{s}</button>)}
                </div>
                <div style={{ marginTop: 28, textAlign: "left" }}>
                  <div style={{ fontSize: 12.5, color: MUTE, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><Icon n="sparkles" size={13} />Explorar por atividade</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                    {EXPLORAR.map((a) => (
                      <button key={a.label} className="tile" onClick={() => search(a.label)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 13px", borderRadius: 12, border: `1px solid ${LINE}`, background: "rgba(255,255,255,0.03)", color: CREAM, cursor: "pointer", fontSize: 13.5, fontWeight: 500, textAlign: "left" }}>
                        <span style={{ color: TEAL, display: "flex" }}><Icon n={a.icon} size={16} /></span>{a.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!loading && results && (
              <div>
                {meta?.interpretacao && <p style={{ fontSize: 12.5, color: MUTE, margin: "0 2px 12px", lineHeight: 1.5 }}><span style={{ color: TEAL }}>⟶ </span>{meta.interpretacao}</p>}
                {meta?.iny && meta.iny.produto && <InyStrip iny={meta.iny} />}
                {results.length === 0 && <SemResultados query={query} place={place} onRegistar={() => setReg(true)} onToast={flash} />}
                {results.length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    {(["lista", "mapa"] as const).map((v) => (
                      <button key={v} onClick={() => setVista(v)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${vista === v ? "transparent" : LINE}`, color: vista === v ? "#fff" : CREAM, background: vista === v ? ORANGE : "rgba(255,255,255,0.05)" }}><Icon n={v === "mapa" ? "pin" : "news"} size={14} />{v === "mapa" ? "Mapa" : "Lista"}</button>
                    ))}
                  </div>
                )}
                {results.length > 0 && shown && shown.length === 0 && <div style={{ textAlign: "center", color: MUTE, padding: "30px 0", fontSize: 14 }}>Sem entidades nesta vertical. Toca em <b style={{ color: CREAM }}>Tudo</b>.</div>}
                {vista === "mapa" && shown && shown.length > 0
                  ? <MapaResultados resultados={shown} />
                  : <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                      {shown && shown.map((r, i) => <ResultCard key={r.code + i} r={r} onOpen={() => setDetalhe(r)} onMap={() => setMapaPonto(r)} onShare={() => { copy(r.code); try { window.location.href = `sms:?&body=${encodeURIComponent(`${r.nome} — AfroLoc: ${r.code}`)}`; } catch {} flash("Código copiado — a abrir SMS no telemóvel."); }} />)}
                    </div>}
                {results.length > 0 && (
                  <p style={{ textAlign: "center", color: MUTE, fontSize: 11.5, marginTop: 18, lineHeight: 1.6 }}>
                    Ranking por <b style={{ color: CREAM }}>proximidade · confiança · frescura</b>.<br />
                    Cada ponto tem um código AfroLoc — partilhável por SMS, mesmo offline.
                  </p>
                )}
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
        {reg && <RegisterSheet place={place} onClose={() => setReg(false)} onDone={(m) => { flash(m); contarEntidades().then(setIdx); }} onPlanos={(nome, code) => { setReg(false); setPlanos({ nome, code }); }} />}
        {planos && <PlanosSheet dados={planos} onClose={() => setPlanos(null)} onToast={flash} />}
        {mapaPonto && <MapaPonto r={mapaPonto} onClose={() => setMapaPonto(null)} />}
        {detalhe && <DetalheNegocio r={detalhe} onClose={() => setDetalhe(null)} onMap={() => { setDetalhe(null); setMapaPonto(detalhe); }} />}
        {onboard && <Onboarding place={place} code={pin.code} real={pin.real} onGeo={(c) => setGeo(c)} onClose={() => setOnboard(false)} />}
        {toast && <div style={toastStyle}>{toast}</div>}
      </div>
    </div>
  );
}

function Painel() {
  const [key, setKey] = useState("");
  const [entrado, setEntrado] = useState(false);
  const [lista, setLista] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const carregar = async (k: string) => {
    setBusy(true); setMsg("");
    const res = await admin("listar", k);
    setBusy(false);
    if (res.error) { setMsg(res.error); return; }
    setKey(k); setEntrado(true); setLista(res.pendentes || []);
  };
  const decidir = async (id: string, decisao: string) => {
    const res = await admin("decidir", key, { entidade_id: id, decisao });
    if (res.ok) setLista((l) => l.filter((e) => e.id !== id));
    else setMsg(res.error || "Falhou.");
  };
  const field: React.CSSProperties = { width: "100%", background: INK2, border: `1px solid ${LINE}`, borderRadius: 12, padding: "12px 14px", color: CREAM, outline: "none", fontSize: 14, marginBottom: 12 };

  return (
    <div style={{ minHeight: "100vh", background: INK, color: CREAM, fontFamily: "ui-sans-serif, -apple-system, 'Segoe UI', Roboto, sans-serif", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 760, padding: "24px 18px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}><Wordmark /><span style={badge}>painel · validação</span></div>
        {!entrado ? (
          <div style={{ maxWidth: 340, margin: "44px auto", textAlign: "center" }}>
            <div style={{ color: TEAL, marginBottom: 10, display: "flex", justifyContent: "center" }}><Icon n="lock" size={30} /></div>
            <h2 style={{ margin: "0 0 6px", fontSize: 19 }}>Painel de validação</h2>
            <p style={{ color: MUTE, fontSize: 13, margin: "0 0 16px" }}>Introduz a chave de acesso.</p>
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") carregar(key); }} placeholder="Chave de admin" style={field} />
            {msg && <div style={{ color: "#FF8A8A", fontSize: 12.5, marginBottom: 10 }}>{msg}</div>}
            <button onClick={() => carregar(key)} disabled={busy} style={{ ...goBtn, background: GRAD, width: "100%", padding: 13, fontSize: 15, opacity: busy ? 0.6 : 1 }}>{busy ? "A entrar…" : "Entrar"}</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Pendentes <span style={{ color: MUTE, fontWeight: 400 }}>({lista.length})</span></div>
              <button onClick={() => carregar(key)} style={{ ...chipGhost, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", fontSize: 12.5 }}><Icon n="refresh" size={14} />Atualizar</button>
            </div>
            {msg && <div style={{ color: "#FF8A8A", fontSize: 12.5, marginBottom: 10 }}>{msg}</div>}
            {lista.length === 0 && <div style={{ textAlign: "center", color: MUTE, padding: "40px 0", fontSize: 14 }}>Nada pendente de validação. 🎉</div>}
            {lista.map((e) => (
              <div key={e.id} className="ycard" style={{ background: CARD, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>{e.nome}</h3>
                  <span style={{ ...tag, marginLeft: "auto" }}>{e.perfil === "formal" ? "Empresa" : "Informal"}</span>
                </div>
                <div style={{ fontSize: 12, color: MUTE, marginBottom: 10 }}>{e.categoria || "—"} · {e.mun}/{e.zona} · <span style={{ fontFamily: "ui-monospace, monospace" }}>{e.afroloc}</span></div>
                <div style={{ fontSize: 12.5, color: "#C9D2DB", lineHeight: 1.8, marginBottom: 10 }}>
                  {e.perfil === "formal" && <>
                    <div>NIF: <b>{e.nif || "—"}</b> · {e.forma_juridica || "—"}</div>
                    <div>Alvará: {e.alvara || "—"} · Registo: {e.registo_comercial || "—"}</div>
                    <div>Rep.: {e.rep_legal_nome || "—"} (BI {e.rep_legal_bi || "—"})</div>
                    <div>Setor: {e.setor || "—"} · Trab.: {e.n_trabalhadores ?? "—"}</div>
                  </>}
                  <div>Contacto: {e.telemovel || "—"}{e.email ? ` · ${e.email}` : ""}</div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                  {(!e.documentos || e.documentos.length === 0) && <span style={{ fontSize: 12, color: MUTE }}>Sem documentos enviados.</span>}
                  {(e.documentos || []).map((d: any, i: number) => d.url ? (
                    (d.mime || "").startsWith("image/")
                      ? <a key={i} href={d.url} target="_blank" rel="noreferrer" style={{ textAlign: "center" }}><img src={d.url} alt={d.tipo} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10, border: `1px solid ${LINE}`, display: "block" }} /><div style={{ fontSize: 10, color: MUTE, marginTop: 3 }}>{d.tipo}</div></a>
                      : <a key={i} href={d.url} target="_blank" rel="noreferrer" style={{ ...chipGhost, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}><Icon n="file" size={14} />{d.tipo}</a>
                  ) : <span key={i} style={{ fontSize: 11, color: MUTE }}>{d.tipo} (indisp.)</span>)}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => decidir(e.id, e.perfil === "formal" ? "empresa" : "comunidade")} style={{ ...goBtn, background: GRAD, flex: 1, padding: 11, fontSize: 13.5 }}>Aprovar · {e.perfil === "formal" ? "Empresa verificada" : "Verificado"}</button>
                  <button onClick={() => decidir(e.id, "rejeitar")} style={{ ...chipGhost, padding: "11px 16px", color: "#FF8A8A", borderColor: "rgba(255,120,120,0.3)" }}>Rejeitar</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function MapaPonto({ r, onClose }: { r: Result; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const c = decodeAfroloc(r.code);
  useEffect(() => {
    const el = ref.current;
    if (!el || !c) return;
    const map = L.map(el, { attributionControl: false });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
    map.setView([c.lat, c.lng], 16);
    const col = r.verificado ? "#FF6B35" : "#19C6AC";
    L.circleMarker([c.lat, c.lng], { radius: 11, color: col, fillColor: col, fillOpacity: 0.9, weight: 3 }).addTo(map).bindPopup(`<b>${r.nome}</b>`).openPopup();
    const t = setTimeout(() => map.invalidateSize(), 120);
    return () => { clearTimeout(t); map.remove(); };
  }, []);
  return (
    <div onClick={onClose} style={{ ...overlay, zIndex: 55 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: INK2, borderTopLeftRadius: 22, borderTopRightRadius: 22, border: `1px solid ${LINE}`, padding: 16, animation: "slideup .28s ease" }}>
        <div style={{ width: 40, height: 4, borderRadius: 9, background: LINE, margin: "0 auto 14px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.nome}</div>
            <div style={{ fontSize: 12, color: MUTE }}>{r.categoria} · {r.dist.toFixed(1)} km</div>
          </div>
          <button onClick={onClose} style={{ ...iconBtn, marginLeft: "auto", display: "grid", placeItems: "center" }}><Icon n="x" size={16} /></button>
        </div>
        {c ? (
          <>
            <div ref={ref} style={{ height: 360, borderRadius: 14, overflow: "hidden", border: `1px solid ${LINE}`, background: "#0c1420" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <span style={{ flex: 1, minWidth: 0, fontFamily: "ui-monospace, monospace", fontSize: 11.5, color: TEAL, wordBreak: "break-all" }}>{r.code}</span>
              <a href={`https://www.google.com/maps?q=${c.lat},${c.lng}`} target="_blank" rel="noreferrer" style={{ ...miniBtn, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}><Icon n="external-link" size={12} />Google Maps</a>
            </div>
          </>
        ) : <div style={{ textAlign: "center", color: MUTE, padding: "34px 0", fontSize: 14 }}>Este ponto não tem coordenada descodificável.</div>}
      </div>
    </div>
  );
}

function DetalheNegocio({ r, onClose, onMap }: { r: Result; onClose: () => void; onMap: () => void }) {
  const linha = (label: string, val: any) => (val === null || val === undefined || val === "") ? null : (
    <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px solid ${LINE}` }}>
      <span style={{ color: MUTE, fontSize: 12.5, flex: "0 0 auto" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, textAlign: "right", wordBreak: "break-word", color: CREAM }}>{val}</span>
    </div>
  );
  const seccao = (titulo: string, filhos: React.ReactNode[]) => {
    const arr = filhos.filter(Boolean);
    return arr.length ? <div style={{ marginTop: 16 }}><div style={{ fontSize: 10.5, letterSpacing: 1, color: TEAL, marginBottom: 2 }}>{titulo.toUpperCase()}</div>{arr}</div> : null;
  };
  const wa = (r.whatsapp || r.telemovel || "").replace(/[^0-9]/g, "");
  const act: React.CSSProperties = { ...chipGhost, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: 13, padding: "9px 13px" };
  return (
    <div onClick={onClose} style={{ ...overlay, zIndex: 55 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "92%", overflowY: "auto", background: INK2, borderTopLeftRadius: 22, borderTopRightRadius: 22, border: `1px solid ${LINE}`, padding: 18, animation: "slideup .28s ease" }}>
        <div style={{ width: 40, height: 4, borderRadius: 9, background: LINE, margin: "0 auto 14px" }} />
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{r.nome}</h2>
              {r.verificado && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, color: "#06110F", background: GRAD, borderRadius: 7, padding: "2px 7px" }}><Icon n="check" size={11} />{r.nivel === "empresa" ? "Empresa verificada" : "Verificado"}</span>}
            </div>
            <div style={{ fontSize: 12.5, color: MUTE, marginTop: 2 }}>{r.categoria}{r.fonte === "web" ? " · web" : " · índice local"} · {r.dist.toFixed(1)} km</div>
          </div>
          <button onClick={onClose} style={{ ...iconBtn, marginLeft: "auto", display: "grid", placeItems: "center" }}><Icon n="x" size={16} /></button>
        </div>
        {r.descricao && <p style={{ fontSize: 13.5, color: "#C9D2DB", lineHeight: 1.5, margin: "8px 0 0" }}>{r.descricao}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" style={{ ...act, borderColor: "rgba(25,198,172,0.4)", color: TEAL }}><Icon n="globe" size={14} />WhatsApp</a>}
          {r.telemovel && <a href={`tel:${r.telemovel}`} style={act}>Ligar</a>}
          <button onClick={onMap} style={act}><Icon n="pin" size={14} />Ver no mapa</button>
        </div>
        {seccao("Contacto", [linha("Responsável", r.responsavel), linha("Telemóvel", r.telemovel), linha("WhatsApp", r.whatsapp), linha("Email", r.email), linha("Website", r.website), linha("Horário", r.horario), linha("Desde", r.desde)])}
        {seccao("Localização", [linha("Código AFROLOC", <span style={{ fontFamily: "ui-monospace, monospace", color: TEAL, fontSize: 12 }}>{r.code}</span>), linha("Município · Zona", (r.mun || r.zona) ? `${r.mun || "—"} · ${r.zona || "—"}` : null), linha("Distância", `${r.dist.toFixed(1)} km`)])}
        {seccao("Registo formal", [linha("Perfil", r.perfil === "formal" ? "Empresa / Formal" : r.perfil === "informal" ? "Informal" : null), linha("NIF", r.nif), linha("Forma jurídica", r.forma_juridica), linha("Registo comercial", r.registo_comercial), linha("Alvará", r.alvara), linha("Representante", r.rep_legal_nome), linha("Setor", r.setor), linha("Nº de trabalhadores", r.n_trabalhadores), linha("Endereço fiscal", r.endereco_fiscal)])}
        {seccao("Confiança & fonte", [linha("Confiança", `${r.conf}%`), linha("Validação", r.validacao === "verificado_empresa" ? "Empresa verificada" : r.validacao === "verificado_comunidade" ? "Verificado pela comunidade" : r.validacao === "pendente" ? "Pendente de validação" : null), linha("Frescura", r.fresh), linha("Fonte", r.fonte === "web" ? "Web (OpenStreetMap)" : "Registo / índice local")])}
        <button onClick={onClose} style={{ ...linkBtn, marginTop: 16 }}>Fechar</button>
      </div>
    </div>
  );
}

function MapaResultados({ resultados }: { resultados: Result[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pts = resultados.map((r) => ({ r, c: decodeAfroloc(r.code) })).filter((x) => x.c) as { r: Result; c: { lat: number; lng: number } }[];
    const map = L.map(el, { attributionControl: false, zoomControl: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
    const ms: L.CircleMarker[] = [];
    pts.forEach(({ r, c }) => {
      const col = r.verificado ? "#FF6B35" : "#19C6AC";
      const m = L.circleMarker([c.lat, c.lng], { radius: 8, color: col, fillColor: col, fillOpacity: 0.9, weight: 2 });
      m.bindPopup(`<div style="font-family:sans-serif;min-width:150px"><b>${r.nome}</b><br><span style="color:#999;font-size:12px">${r.categoria || ""} · ${r.dist.toFixed(1)} km</span><br><code style="font-size:11px;color:#0f8a76">${r.code}</code></div>`);
      m.addTo(map); ms.push(m);
    });
    if (pts.length) { try { map.fitBounds(L.featureGroup(ms).getBounds().pad(0.35)); } catch { map.setView([-8.93, 13.18], 13); } }
    else map.setView([-8.93, 13.18], 13);
    const t = setTimeout(() => map.invalidateSize(), 120);
    return () => { clearTimeout(t); map.remove(); };
  }, [resultados]);
  return (
    <div>
      <div ref={ref} style={{ height: 400, borderRadius: 16, overflow: "hidden", border: `1px solid ${LINE}`, background: "#0c1420" }} />
      <div style={{ fontSize: 11.5, color: MUTE, marginTop: 8, display: "flex", gap: 14, justifyContent: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 9, background: TEAL }} />no índice</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 9, background: ORANGE }} />verificado</span>
        <span>· pontos gerados dos códigos AFROLOC</span>
      </div>
    </div>
  );
}

function Wordmark({ size = 30 }: { size?: number }) {
  const s = size / 30;
  return (
    <svg width={152 * s} height={32 * s} viewBox="0 0 300 64" fill="none" role="img" aria-label="yamioo" style={{ display: "block" }}>
      <text x="2" y="46" fontFamily={FONT} fontSize="50" fontWeight="700" letterSpacing="-1.5" fill={CREAM}>yami</text>
      <path d="M126,30 C126,15 149,15 158,30 C167,45 190,45 190,30 C190,15 167,15 158,30 C149,45 126,45 126,30 Z" fill="none" stroke={CREAM} strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Icon({ n, size = 16 }: { n: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><line x1="12" y1="18" x2="12" y2="21" /></>,
    pin: <><path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></>,
    tool: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
    news: <><rect x="5" y="3" width="14" height="18" rx="2" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="8" y1="16" x2="13" y2="16" /></>,
    sparkles: <path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7z" />,
    bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
    globe: <><circle cx="12" cy="12" r="9" /><line x1="3" y1="12" x2="21" y2="12" /><path d="M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>,
    check: <polyline points="4 12 10 18 20 6" />,
    tag: <><path d="M3 12V4h8l9 9-8 8z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" /></>,
    download: <><path d="M12 3v12" /><polyline points="7 10 12 15 17 10" /><line x1="5" y1="21" x2="19" y2="21" /></>,
    copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
    bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 7 2 7H4s2-2 2-7" /><path d="M10 21a2 2 0 0 0 4 0" /></>,
    x: <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>,
    "arrow-left": <><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></>,
    file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><polyline points="14 3 14 8 19 8" /></>,
    lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
    refresh: <><path d="M21 12a9 9 0 1 1-3-6.7" /><polyline points="21 3 21 9 15 9" /></>,
    "external-link": <><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }} aria-hidden="true">
      {paths[n]}
    </svg>
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

function ResultCard({ r, onOpen, onMap, onShare }: { r: Result; onOpen: () => void; onMap: () => void; onShare: () => void }) {
  const tipo = TIPO_LABEL[r.tipo] || "Local";
  const ico = (VERTICALS.find((v) => v.id === r.tipo) || ({} as any)).icon || "pin";
  return (
    <div className="ycard" style={{ background: CARD, borderRadius: 16, padding: 14, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: GRAD, opacity: 0.9 }} />
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ width: 40, height: 40, flex: "0 0 auto", borderRadius: 11, display: "grid", placeItems: "center", color: TEAL, background: "rgba(255,255,255,0.04)", border: `1px solid ${LINE}` }}><Icon n={ico} size={20} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3 onClick={onOpen} style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: CREAM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer" }}>{r.nome}</h3>
            {r.verificado && <span title="Negócio verificado" style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, color: "#06110F", background: GRAD, borderRadius: 7, padding: "2px 6px" }}><Icon n="check" size={11} />Verificado</span>}
            <span style={{ ...tag, marginLeft: "auto" }}>{tipo}</span>
          </div>
          <div style={{ fontSize: 12, color: MUTE, marginTop: 1, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.categoria}</span>
            <span>·</span>
            {r.fonte === "web"
              ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Icon n="globe" size={11} />web</span>
              : <span>índice local</span>}
          </div>
          <p style={{ margin: "7px 0 0", fontSize: 13.5, color: "#C9D2DB", lineHeight: 1.45 }}>{r.descricao}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            <Signal label={`${r.dist.toFixed(1)} km`} icon="pin" />
            <Signal label={`${r.conf}% confiança`} icon="check" tone={r.conf >= 80 ? "good" : "mid"} />
            <Signal label={r.fresh} icon="clock" />
            {r.preco && <Signal label={r.preco} icon="tag" tone="price" />}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 11, background: "rgba(25,198,172,0.07)", border: "1px solid rgba(25,198,172,0.22)", borderRadius: 10, padding: "7px 10px" }}>
            <button onClick={onMap} title="Ver no mapa" style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer", color: TEAL }}>
              <Icon n="pin" size={13} />
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11.5, letterSpacing: 0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.code}</span>
            </button>
            <button onClick={onShare} style={{ ...miniBtn }}>SMS ⇪</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Signal({ label, icon, tone }: { label: string; icon: string; tone?: string }) {
  const c = tone === "good" ? TEAL : tone === "price" ? AMBER : tone === "mid" ? "#C9D2DB" : MUTE;
  return <span className="ychip" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: c, background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "5px 9px", fontWeight: 600 }}><Icon n={icon} size={12} />{label}</span>;
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

function SemResultados({ query, place, onRegistar, onToast }: { query: string; place: Place; onRegistar: () => void; onToast: (m: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [contacto, setContacto] = useState("");
  const [busy, setBusy] = useState(false);
  const [feito, setFeito] = useState(false);

  const confirmar = async () => {
    if (!contacto.trim()) return;
    setBusy(true);
    const res = await avisarme({ termo: query, contacto: contacto.trim(), cc: place.cc, prov: place.prov, mun: place.mun, zona: place.zona, lat: place.lat, lng: place.lng });
    setBusy(false);
    if (res.ok) { setFeito(true); onToast("Combinado! Avisamos-te quando aparecer."); }
    else onToast(res.error || "Não consegui guardar.");
  };

  return (
    <div style={{ textAlign: "center", padding: "20px 8px" }}>
      <div style={{ width: 46, height: 46, borderRadius: 13, margin: "0 auto 12px", display: "grid", placeItems: "center", color: MUTE, background: "rgba(255,255,255,0.04)", border: `1px solid ${LINE}` }}><Icon n="search" size={22} /></div>
      <div style={{ color: CREAM, fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Ainda ninguém pôs "{query}" no mapa de {place.bairro}.</div>
      <div style={{ color: MUTE, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>Na economia informal, toda a gente conhece um. Ajuda a tornar visível — ou deixa que te avisamos quando aparecer.</div>

      <button onClick={onRegistar} style={{ ...goBtn, background: GRAD, width: "100%", maxWidth: 320, padding: 12, fontSize: 14.5, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}><Icon n="pin" size={16} />Adiciona quem conheces</button>

      {!aberto && !feito && (
        <div><button onClick={() => setAberto(true)} style={{ ...linkBtn, width: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}><Icon n="bell" size={14} />Avisa-me quando aparecer</button></div>
      )}
      {aberto && !feito && (
        <div style={{ maxWidth: 320, margin: "4px auto 0", display: "flex", gap: 8 }}>
          <input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Telemóvel ou email" style={{ flex: 1, background: INK, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px", color: CREAM, outline: "none", fontSize: 13.5 }} />
          <button onClick={confirmar} disabled={busy} style={{ ...goBtn, background: GRAD, padding: "10px 14px", fontSize: 13.5, opacity: busy ? 0.6 : 1 }}>{busy ? "…" : "OK"}</button>
        </div>
      )}
      {feito && <div style={{ color: TEAL, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}><Icon n="check" size={14} />Combinado. Avisamos-te.</div>}
    </div>
  );
}

function PlanosSheet({ dados, onClose, onToast }: { dados: { nome: string; code: string }; onClose: () => void; onToast: (m: string) => void }) {
  const [plano, setPlano] = useState<PlanoId>("verificado");
  const [ciclo, setCiclo] = useState<Ciclo>("anual");
  const [contacto, setContacto] = useState("");
  const [busy, setBusy] = useState(false);
  const [feito, setFeito] = useState(false);
  const total = precoTotal(plano, ciclo);

  const submeter = async () => {
    if (!contacto.trim()) { onToast("Indica um contacto."); return; }
    setBusy(true);
    const res = await subscrever({ plano, ciclo, nome: dados.nome, contacto: contacto.trim(), afroloc: dados.code });
    setBusy(false);
    if (res.ok) { setFeito(true); onToast("Pedido recebido! Entramos em contacto para ativar."); }
    else onToast(res.error || "Não consegui registar o pedido.");
  };

  const field: React.CSSProperties = { width: "100%", background: INK, border: `1px solid ${LINE}`, borderRadius: 12, padding: "11px 13px", color: CREAM, outline: "none", fontSize: 14 };

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "92%", background: INK2, borderTopLeftRadius: 22, borderTopRightRadius: 22, border: `1px solid ${LINE}`, padding: 18, overflowY: "auto", animation: "slideup .28s ease" }}>
        <div style={{ width: 40, height: 4, borderRadius: 9, background: LINE, margin: "0 auto 16px" }} />
        {!feito ? (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Destaca o teu negócio</div>
            <div style={{ fontSize: 12.5, color: MUTE, marginBottom: 14 }}>Selo ✓ Verificado, topo do ranking e campanhas para <b style={{ color: CREAM }}>{dados.nome}</b>.</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {(Object.keys(PLANOS) as PlanoId[]).map((p) => (
                <button key={p} onClick={() => setPlano(p)} style={{ flex: 1, textAlign: "left", padding: "11px 12px", borderRadius: 13, cursor: "pointer", border: `1px solid ${plano === p ? TEAL : LINE}`, background: plano === p ? "rgba(25,198,172,0.08)" : "rgba(255,255,255,0.02)", color: CREAM }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{PLANOS[p].nome}</div>
                  <div style={{ fontSize: 11.5, color: MUTE, marginTop: 2 }}>{akz(PLANOS[p].mensal)}/mês</div>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {CICLOS.map((c) => (
                <button key={c.id} onClick={() => setCiclo(c.id)} style={{ ...chipGhost, flex: 1, padding: "8px 4px", fontSize: 12.5, ...(ciclo === c.id ? { background: GRAD, color: "#06110F", borderColor: "transparent" } : {}) }}>{c.nome}{c.desconto ? ` −${c.desconto * 100}%` : ""}</button>
              ))}
            </div>
            <div style={{ fontSize: 12.5, color: MUTE, marginBottom: 10, lineHeight: 1.9 }}>
              {PLANOS[plano].da.map((d) => <div key={d}><span style={{ color: TEAL }}>✓</span> {d}</div>)}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "10px 2px", marginBottom: 12, borderTop: `1px solid ${LINE}` }}>
              <span style={{ color: MUTE, fontSize: 13 }}>Total {CICLOS.find((c) => c.id === ciclo)!.nome.toLowerCase()}</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: CREAM }}>{akz(total)}</span>
            </div>
            <input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Telemóvel ou email para ativar" style={{ ...field, marginBottom: 10 }} />
            <button onClick={submeter} disabled={busy} style={{ ...goBtn, background: GRAD, width: "100%", padding: 13, fontSize: 15, opacity: busy ? 0.6 : 1 }}>{busy ? "A enviar…" : "Quero destacar-me"}</button>
            <button onClick={onClose} style={{ ...linkBtn, marginTop: 10 }}>Agora não</button>
            <div style={{ fontSize: 11, color: MUTE, textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>Pagamento por Multicaixa · o selo ativa após confirmação.<br />O selo também se ganha por validação da comunidade.</div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "8px 4px" }}>
            <div style={{ color: TEAL, marginBottom: 8, display: "flex", justifyContent: "center" }}><Icon n="check" size={34} /></div>
            <h2 style={{ margin: "2px 0 6px", fontSize: 19 }}>Pedido recebido</h2>
            <p style={{ color: MUTE, fontSize: 13, margin: "0 0 16px", lineHeight: 1.6 }}>Vamos contactar-te para ativar o <b style={{ color: CREAM }}>{PLANOS[plano].nome}</b> e emitir a referência Multicaixa. O selo ✓ aparece após o pagamento.</p>
            <button onClick={onClose} style={{ ...goBtn, background: GRAD, width: "100%", padding: 13, fontSize: 15 }}>Concluir</button>
          </div>
        )}
      </div>
    </div>
  );
}

function RegisterSheet({ place, onClose, onDone, onPlanos }: { place: Place; onClose: () => void; onDone: (m: string) => void; onPlanos: (nome: string, code: string) => void }) {
  const TIPOS: [string, string, string][] = [["local", "Local", "pin"], ["servico", "Serviço", "tool"], ["pessoa", "Pessoa", "user"], ["oportunidade", "Oportunidade", "briefcase"], ["conteudo", "Conteúdo", "news"]];
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("local");
  const [categoria, setCategoria] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [coords, setCoords] = useState({ lat: place.lat, lng: place.lng });
  const [gps, setGps] = useState<"idle" | "locating" | "on">("idle");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [entId, setEntId] = useState<string | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [perfil, setPerfil] = useState<"" | "informal" | "formal">("");
  const [passo, setPasso] = useState(0);
  const [f, setF] = useState<Record<string, string>>({ responsavel: "", telemovel: "", whatsapp: "", horario: "", desde: "", email: "", website: "", nif: "", forma_juridica: "", registo_comercial: "", alvara: "", rep_legal_nome: "", rep_legal_bi: "", setor: "", n_trabalhadores: "", endereco_fiscal: "", iban: "" });
  const upd = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const useGps = () => {
    if (!navigator.geolocation) { setErr("GPS indisponível neste navegador."); return; }
    setGps("locating"); setErr("");
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setGps("on"); },
      () => { setGps("idle"); setErr("Não consegui obter o GPS. Uso o bairro selecionado."); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const partilharCartao = async () => {
    if (!done) return;
    try {
      const blob = await gerarCartao(nome, done);
      const file = new File([blob], `yamioo-${done}.png`, { type: "image/png" });
      const texto = `${nome} — Encontra-me na Yamioo. Morada AFROLOC: ${done}`;
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) { await nav.share({ files: [file], text: texto }); return; }
      baixar(blob, `yamioo-${done}.png`);
      window.open(`https://wa.me/?text=${encodeURIComponent(`${texto} ${deeplink(done)}`)}`, "_blank");
    } catch { onDone("Não consegui gerar o cartão."); }
  };
  const guardarCartao = async () => {
    if (!done) return;
    try { const blob = await gerarCartao(nome, done); baixar(blob, `yamioo-${done}.png`); onDone("Cartão guardado."); }
    catch { onDone("Não consegui gerar o cartão."); }
  };

  const submit = async () => {
    if (!nome.trim()) { setErr("Indica o nome do negócio."); return; }
    setBusy(true); setErr("");
    const res = await registar({
      nome, tipo, categoria, descricao, preco: preco.trim() || null,
      cc: place.cc, prov: place.prov, mun: place.mun, zona: place.zona,
      lat: coords.lat, lng: coords.lng, perfil: perfil || "informal", ...f,
    });
    setBusy(false);
    if (res.ok) { setDone(res.code || ""); setEntId(res.id || null); onDone("Registado! Já aparece nas pesquisas."); }
    else setErr(res.error || "Não foi possível registar.");
  };
  const inp = (k: string, ph: string) => <input value={f[k]} onChange={(e) => upd(k, e.target.value)} placeholder={ph} style={{ width: "100%", background: INK, border: `1px solid ${LINE}`, borderRadius: 12, padding: "11px 13px", color: CREAM, outline: "none", fontSize: 14, marginBottom: 10 }} />;

  const field: React.CSSProperties = { width: "100%", background: INK, border: `1px solid ${LINE}`, borderRadius: 12, padding: "11px 13px", color: CREAM, outline: "none", fontSize: 14, marginBottom: 10 };

  return (
    <>
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "90%", background: INK2, borderTopLeftRadius: 22, borderTopRightRadius: 22, border: `1px solid ${LINE}`, padding: 18, overflowY: "auto", animation: "slideup .28s ease" }}>
        <div style={{ width: 40, height: 4, borderRadius: 9, background: LINE, margin: "0 auto 16px" }} />
        {done === null ? (
          <>
            {passo === 0 && (<>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Registar um negócio</div>
              <div style={{ fontSize: 12.5, color: MUTE, marginBottom: 16 }}>Um registo estruturado, com o teu código AFROLOC. Escolhe o perfil:</div>
              {[{ id: "informal", t: "Informal / Ambulante", d: "Rápido · validação pela comunidade", ic: "pin" }, { id: "formal", t: "Empresa / Formal", d: "Completo (NIF, alvará…) · selo de empresa verificada", ic: "briefcase" }].map((o) => (
                <button key={o.id} onClick={() => { setPerfil(o.id as any); setPasso(1); }} style={{ width: "100%", textAlign: "left", padding: "14px 15px", marginBottom: 10, borderRadius: 14, cursor: "pointer", border: `1px solid ${LINE}`, background: "rgba(255,255,255,0.02)", color: CREAM, display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ color: TEAL, display: "flex" }}><Icon n={o.ic} size={20} /></span>
                  <span><span style={{ fontSize: 14.5, fontWeight: 700, display: "block" }}>{o.t}</span><span style={{ fontSize: 12, color: MUTE }}>{o.d}</span></span>
                </button>
              ))}
              <button onClick={onClose} style={{ ...linkBtn, marginTop: 6 }}>Cancelar</button>
            </>)}

            {passo === 1 && (<>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <button onClick={() => setPasso(0)} style={{ ...iconBtn, display: "grid", placeItems: "center" }}><Icon n="arrow-left" size={16} /></button>
                <div><div style={{ fontSize: 15.5, fontWeight: 700 }}>Dados do negócio</div><div style={{ fontSize: 11.5, color: MUTE }}>{perfil === "formal" ? "Empresa · passo 1 de 2" : "Informal · passo único"}</div></div>
              </div>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome (ex: Quitanda da Dona Rosa)" style={field} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {TIPOS.map(([id, lbl, ic]) => (
                  <button key={id} onClick={() => setTipo(id)} style={{ ...chipGhost, display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", fontSize: 12.5, ...(tipo === id ? { background: GRAD, color: "#06110F", borderColor: "transparent" } : {}) }}><Icon n={ic} size={14} />{lbl}</button>
                ))}
              </div>
              <div style={{ position: "relative", marginBottom: 10 }}>
                <input value={categoria} onChange={(e) => { setCategoria(e.target.value); setCatOpen(true); }} onFocus={() => setCatOpen(true)} onBlur={() => setTimeout(() => setCatOpen(false), 150)} placeholder="Atividade (escolhe ou escreve)" style={{ ...field, marginBottom: 0 }} />
                {catOpen && (() => {
                  const lista = atividadesPara(tipo).filter((a) => a.toLowerCase().includes(categoria.trim().toLowerCase()));
                  if (!lista.length) return null;
                  return (
                    <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 5, maxHeight: 190, overflowY: "auto", background: INK2, border: `1px solid ${LINE}`, borderRadius: 12, boxShadow: "0 14px 34px -14px rgba(0,0,0,0.7)" }}>
                      {lista.map((a) => (
                        <div key={a} onMouseDown={(e) => { e.preventDefault(); setCategoria(a); setCatOpen(false); }} style={{ padding: "9px 13px", fontSize: 13.5, color: CREAM, cursor: "pointer", borderBottom: `1px solid ${LINE}` }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>{a}</div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição curta (o que fazes / vendes)" rows={2} style={{ ...field, resize: "none", fontFamily: "inherit" }} />
              {inp("responsavel", "Responsável / dono (nome)")}
              <div style={{ display: "flex", gap: 8 }}><div style={{ flex: 1 }}>{inp("telemovel", "Telemóvel")}</div><div style={{ flex: 1 }}>{inp("whatsapp", "WhatsApp")}</div></div>
              {inp("horario", "Horário (ex: Seg–Sáb 8h–18h)")}
              {inp("desde", "Desde (ano, ex: 2019)")}
              <input value={preco} onChange={(e) => setPreco(e.target.value)} placeholder={`Preço (opcional, ex: 500 ${place.curr})`} style={field} />
              <button onClick={useGps} style={{ ...chipGhost, width: "100%", padding: "11px", marginBottom: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, ...(gps === "on" ? { borderColor: TEAL, color: TEAL } : {}) }}>
                <Icon n={gps === "on" ? "check" : "pin"} size={15} />{gps === "locating" ? "A localizar…" : gps === "on" ? "A usar o teu GPS" : `Usar o meu GPS (ou fica em ${place.bairro})`}
              </button>
              <div style={{ fontSize: 11.5, color: MUTE, marginBottom: 12 }}>Local: {place.flag} {place.country} › {place.city} › {place.bairro}</div>
              {err && <div style={{ color: "#FF8A8A", fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
              {perfil === "formal"
                ? <button onClick={() => { if (!nome.trim()) { setErr("Indica o nome."); return; } setErr(""); setPasso(2); }} style={{ ...goBtn, background: GRAD, width: "100%", padding: 13, fontSize: 15 }}>Continuar →</button>
                : <button onClick={submit} disabled={busy} style={{ ...goBtn, background: GRAD, width: "100%", padding: 13, fontSize: 15, opacity: busy ? 0.6 : 1 }}>{busy ? "A registar…" : "Registar"}</button>}
            </>)}

            {passo === 2 && (<>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <button onClick={() => setPasso(1)} style={{ ...iconBtn, display: "grid", placeItems: "center" }}><Icon n="arrow-left" size={16} /></button>
                <div><div style={{ fontSize: 15.5, fontWeight: 700 }}>Dados formais</div><div style={{ fontSize: 11.5, color: MUTE }}>Empresa · passo 2 de 2</div></div>
              </div>
              {inp("nif", "NIF / Nº de contribuinte")}
              {inp("forma_juridica", "Forma jurídica (ENI, Lda, SA, Cooperativa)")}
              {inp("registo_comercial", "Nº de registo comercial / certidão")}
              {inp("alvara", "Alvará / licença comercial")}
              <div style={{ display: "flex", gap: 8 }}><div style={{ flex: 1 }}>{inp("rep_legal_nome", "Representante (nome)")}</div><div style={{ flex: 1 }}>{inp("rep_legal_bi", "BI do representante")}</div></div>
              <div style={{ display: "flex", gap: 8 }}><div style={{ flex: 2 }}>{inp("setor", "Setor (CAE)")}</div><div style={{ flex: 1 }}>{inp("n_trabalhadores", "Nº trab.")}</div></div>
              {inp("endereco_fiscal", "Endereço fiscal")}
              {inp("email", "Email")}
              {inp("website", "Website / redes sociais")}
              {inp("iban", "IBAN (opcional)")}
              <div style={{ fontSize: 11, color: MUTE, background: "rgba(255,255,255,0.03)", border: `1px solid ${LINE}`, borderRadius: 10, padding: "9px 11px", marginBottom: 12, lineHeight: 1.5 }}>Os <b style={{ color: CREAM }}>documentos</b> (certidão comercial, alvará, BI) serão pedidos a seguir para emitir o selo <b style={{ color: TEAL }}>Empresa verificada</b>.</div>
              {err && <div style={{ color: "#FF8A8A", fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
              <button onClick={submit} disabled={busy} style={{ ...goBtn, background: GRAD, width: "100%", padding: 13, fontSize: 15, opacity: busy ? 0.6 : 1 }}>{busy ? "A registar…" : "Registar empresa"}</button>
            </>)}
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "6px 4px 4px" }}>
            <div style={{ color: TEAL, marginBottom: 6, display: "flex", justifyContent: "center" }}><Icon n="check" size={34} /></div>
            <h2 style={{ margin: "2px 0 4px", fontSize: 19 }}>{nome} está no mapa 🎉</h2>
            <p style={{ color: MUTE, fontSize: 13, margin: "0 0 14px" }}>Tens agora uma <b style={{ color: CREAM }}>morada digital AFROLOC</b>. Partilha o teu cartão — quem o receber encontra-te num toque.</p>
            <div style={{ background: "rgba(25,198,172,0.08)", border: "1px solid rgba(25,198,172,0.25)", borderRadius: 12, padding: "12px", marginBottom: 14 }}>
              <div style={{ fontSize: 10.5, color: MUTE, letterSpacing: 1, marginBottom: 4 }}>O TEU CÓDIGO</div>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 13.5, color: TEAL, fontWeight: 600, wordBreak: "break-all" }}>{done}</div>
            </div>
            <button onClick={partilharCartao} style={{ ...goBtn, background: GRAD, width: "100%", padding: 13, fontSize: 15, marginBottom: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Icon n="share" size={16} />Partilhar cartão</button>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button onClick={guardarCartao} style={{ ...chipGhost, flex: 1, padding: 11, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon n="download" size={14} />Guardar</button>
              <button onClick={() => { try { navigator.clipboard?.writeText(done); } catch {} onDone("Código copiado."); }} style={{ ...chipGhost, flex: 1, padding: 11, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon n="copy" size={14} />Copiar</button>
            </div>
            {entId && <button onClick={() => setDocsOpen(true)} style={{ width: "100%", padding: "10px", marginBottom: 6, borderRadius: 12, cursor: "pointer", background: "rgba(255,255,255,0.03)", border: `1px solid ${LINE}`, color: CREAM, fontSize: 13.5, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}><Icon n="file" size={15} />Enviar documentos (validação)</button>}
            <button onClick={() => onPlanos(nome, done)} style={{ width: "100%", padding: "10px", marginBottom: 6, borderRadius: 12, cursor: "pointer", background: "rgba(25,198,172,0.08)", border: "1px solid rgba(25,198,172,0.3)", color: TEAL, fontSize: 13.5, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}><Icon n="check" size={15} />Quero o selo ✓ e destaque</button>
            <button onClick={onClose} style={{ ...linkBtn }}>Concluir</button>
          </div>
        )}
      </div>
    </div>
    {docsOpen && entId && <DocsSheet entId={entId} perfil={perfil || "informal"} onClose={() => setDocsOpen(false)} onToast={onDone} />}
    </>
  );
}

function DocsSheet({ entId, perfil, onClose, onToast }: { entId: string; perfil: string; onClose: () => void; onToast: (m: string) => void }) {
  const DOCS: [string, string][] = perfil === "formal"
    ? [["certidao", "Certidão comercial"], ["alvara", "Alvará / licença"], ["bi", "BI do representante"], ["nif", "Cartão NIF"], ["foto", "Foto do estabelecimento"]]
    : [["foto", "Foto do local / banca"], ["bi", "BI do responsável (opcional)"]];
  const [st, setSt] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setSt((p) => ({ ...p, [k]: v }));
  const onFile = (tipo: string, file?: File) => {
    if (!file) return;
    const rd = new FileReader();
    rd.onload = async () => {
      const base64 = String(rd.result).split(",")[1] || "";
      set(tipo, "…");
      const res = await enviarDocumento(entId, tipo, base64, file.type || "application/octet-stream");
      set(tipo, res.ok ? "ok" : "erro");
      onToast(res.ok ? "Documento enviado." : (res.error || "Falhou o envio."));
    };
    rd.readAsDataURL(file);
  };
  return (
    <div onClick={onClose} style={{ ...overlay, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "88%", background: INK2, borderTopLeftRadius: 22, borderTopRightRadius: 22, border: `1px solid ${LINE}`, padding: 18, overflowY: "auto", animation: "slideup .28s ease" }}>
        <div style={{ width: 40, height: 4, borderRadius: 9, background: LINE, margin: "0 auto 16px" }} />
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Documentos de validação</div>
        <div style={{ fontSize: 12.5, color: MUTE, marginBottom: 14, lineHeight: 1.5 }}>Envia os documentos. Ficas <b style={{ color: AMBER }}>pendente de validação</b> até um agente confirmar — depois recebes o selo <b style={{ color: TEAL }}>{perfil === "formal" ? "Empresa verificada" : "Verificado"}</b>.</div>
        {DOCS.map(([tipo, label]) => (
          <div key={tipo} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: `1px solid ${LINE}` }}>
            <span style={{ color: st[tipo] === "ok" ? TEAL : MUTE, display: "flex" }}><Icon n={st[tipo] === "ok" ? "check" : "file"} size={18} /></span>
            <span style={{ flex: 1, fontSize: 13.5, color: CREAM }}>{label}</span>
            <label style={{ ...chipGhost, padding: "7px 12px", fontSize: 12.5, cursor: "pointer" }}>
              {st[tipo] === "ok" ? "Trocar" : st[tipo] === "…" ? "A enviar…" : st[tipo] === "erro" ? "Repetir" : "Escolher"}
              <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => onFile(tipo, e.target.files?.[0] || undefined)} />
            </label>
          </div>
        ))}
        <button onClick={onClose} style={{ ...goBtn, background: GRAD, width: "100%", padding: 13, fontSize: 15, marginTop: 16 }}>Concluir</button>
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
            <div style={{ color: ORANGE, marginBottom: 6, display: "flex", justifyContent: "center" }}><Icon n="pin" size={30} /></div>
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
              <div style={{ color: TEAL, display: "flex", justifyContent: "center" }}><Icon n="sparkles" size={26} /></div>
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
