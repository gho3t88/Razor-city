import { useEffect, useState } from "react";
import { cityMapOf, crewPoint, waypointRoute } from "@/game/city-map";
import { freeMuscle, hitOutlook, isGangId } from "@/game/logic";
import { useRazor } from "@/game/store";
import type { GameState, Owner } from "@/game/types";

const colors: Record<Owner, string> = {
  player: "#e0b15a", neutral: "#627d80", vultures: "#ee816f", lanterns: "#c6a2f5", saints: "#82b4e0", cobras: "#79c5a0",
};
const control = "min-h-11 rounded-md border border-line px-3 py-2 text-sm disabled:opacity-40";

export function CityMap({ game }: { game: GameState }) {
  const select = useRazor(s => s.select);
  const travel = useRazor(s => s.travel);
  const orderAttack = useRazor(s => s.orderAttack);
  const tick = useRazor(s => s.tickCity);
  const [now, setNow] = useState(Date.now());
  const [planning, setPlanning] = useState(false);
  const [stops, setStops] = useState<string[]>([]);
  const [zoom, setZoom] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [soldiers, setSoldiers] = useState(4);
  const map = cityMapOf(game);
  const order = map.order;
  const selected = game.districts.find(d => d.id === game.selectedId) ?? game.districts[0];
  const route = order?.route ?? waypointRoute(game, stops.length ? stops : [selected.id]);
  const point = crewPoint(game, reducedMotion && order ? (now >= order.arrivesAt ? order.arrivesAt : order.startedAt) : now);
  const busy = !!order;
  const fighting = order?.kind === "attack" && now >= order.arrivesAt;
  const free = freeMuscle(game);
  const send = Math.min(soldiers, free);
  const owner = selected.owner === "player" ? "YOUR TERRITORY" : selected.owner === "neutral" ? "OPEN TERRITORY" : game.gangs[selected.owner].name.toUpperCase();
  const target = order ? game.districts.find(d => d.id === order.route[order.route.length - 1]) : null;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!order) return;
    const timer = window.setInterval(() => { setNow(Date.now()); tick(); }, 50);
    tick();
    return () => window.clearInterval(timer);
  }, [order, tick]);

  function choose(id: string) {
    select(id);
    if (planning && !busy) setStops(current => current.length < 6 && current[current.length - 1] !== id ? [...current, id] : current);
  }

  const pathPoints = route.map(id => {
    const d = game.districts.find(d => d.id === id)!;
    return `${96 + d.col * 150},${99 + d.row * 150}`;
  }).join(" ");

  return (
    <div className="city-shell">
      <div className="city-heading">
        <div><span className="city-eyebrow">STREET OPERATIONS</span><h2>RAZOR CITY <span>/ LIVE MAP</span></h2></div>
        <button type="button" className={control} aria-pressed={zoom} onClick={() => setZoom(!zoom)}>{zoom ? "Fit map" : "Zoom in"}</button>
      </div>
      <div className="city-scroll" tabIndex={zoom ? 0 : undefined} aria-label="City map; scroll to explore when zoomed">
        <svg className={`city-svg ${zoom ? "city-zoom" : ""}`} viewBox="0 0 660 510" aria-label="Razor City district map">
          <defs>
            <pattern id="water-lines" width="24" height="12" patternUnits="userSpaceOnUse"><path d="M0 6h12" stroke="#24464a" strokeWidth="1" /></pattern>
            <pattern id="street-grid" width="150" height="150" x="30" y="34" patternUnits="userSpaceOnUse"><rect width="150" height="150" fill="#111b20" /><path d="M0 0H150V150" fill="none" stroke="#35464c" strokeWidth="3" /><path d="M0 0H150V150" fill="none" stroke="#67706c" strokeDasharray="4 8" strokeWidth=".7" /></pattern>
          </defs>
          <rect width="660" height="510" fill="#0b171d" />
          <rect width="660" height="510" fill="url(#street-grid)" />
          <path d="M0 466Q190 450 330 478T660 472V510H0Z" fill="#143038" />
          <path d="M0 466Q190 450 330 478T660 472V510H0Z" fill="url(#water-lines)" />
          <text x="30" y="497" className="city-water-label">HOLLOW HARBOR</text>
          <text x="625" y="24" fill="#94a8a6" fontSize="12">N ↑</text>
          {game.districts.map((d, index) => {
            const x = 30 + d.col * 150;
            const y = 34 + d.row * 150;
            const on = d.id === selected.id;
            const color = colors[d.owner];
            return (
              <g key={d.id} className="city-region" role="button" tabIndex={0} aria-label={`${d.name}, ${d.owner === "neutral" ? "open" : d.owner === "player" ? "yours" : game.gangs[d.owner].name}`} aria-pressed={on} onClick={() => choose(d.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(d.id); } }}>
                <rect x={x + 5} y={y + 5} width="132" height="130" rx="5" fill={color} fillOpacity={on ? ".18" : ".055"} stroke={on ? "#f3d291" : color} strokeOpacity={on ? 1 : .4} strokeWidth={on ? 2.5 : 1} />
                {/* Small city blocks leave a clear cross street for the emblem. */}
                {Array.from({ length: 8 }, (_, b) => {
                  const bx = x + 14 + (b % 4) * 29;
                  const by = y + (b < 4 ? 31 : 86);
                  const h = 18 + ((index * 7 + b * 11) % 14);
                  return <g key={b}><rect x={bx + 3} y={by + 4} width="21" height={h} fill="#070e13" /><rect x={bx} y={by} width="21" height={h} rx="1" fill={d.lab && b === 5 ? "#42504e" : "#2a383d"} stroke="#516065" strokeWidth=".6" /><path d={`M${bx + 4} ${by + 5}h12m-12 5h12`} stroke={color} strokeOpacity=".35" strokeWidth="1" /></g>;
                })}
                <text x={x + 13} y={y + 23} fill="#edf0e5" fontSize="13" fontWeight="700" letterSpacing="1">{d.short}</text>
                <rect x={x + 10} y={y + 119} width="119" height="13" fill="#101b20" />
                <text x={x + 14} y={y + 129} fill={color} fontSize="10" fontWeight="600">{d.owner === "player" ? `YOUR CREW · ${d.stationMuscle}` : d.owner === "neutral" ? `OPEN · DEF ${d.defense}` : `${game.gangs[d.owner].tag} · DEF ${d.defense}`}</text>
              </g>
            );
          })}
          <g pointerEvents="none">
            <polyline points={pathPoints} className={busy ? "city-route active" : "city-route"} />
            {!busy && stops.map((id, i) => {
              const d = game.districts.find(d => d.id === id)!;
              return <g key={`${id}-${i}`} transform={`translate(${96 + d.col * 150},${99 + d.row * 150})`}><circle r="10" fill="#e0b15a" /><text textAnchor="middle" y="4" fontSize="12" fill="#101915" fontWeight="bold">{i + 1}</text></g>;
            })}
            {[0, 1, 2].map(i => <rect key={i} className={`city-car city-car-${i}`} x="0" y={179 + i * 150} width="9" height="4" rx="1" fill={i === 1 ? "#d1b583" : "#668d9c"} />)}
            {fighting ? (
              <g transform={`translate(${point.x},${point.y})`} aria-label="Street battle in progress">
                <circle r="45" className="city-battle-ring" />
                {Array.from({ length: 6 }, (_, i) => {
                  const left = i < 3;
                  return <g key={i} transform={`translate(${left ? -26 : 26},${(i % 3 - 1) * 13}) scale(${left ? 1 : -1},1)`}>
                    <g className={`city-soldier soldier-${i}`}><ellipse rx="5" ry="3" cy="4" fill="#060c10" /><path d="M-2 2l-2 5m5-5l2 5" stroke={left ? "#d4af64" : "#ee816f"} strokeWidth="2" /><rect x="-4" y="-4" width="8" height="8" rx="2" fill={left ? "#d4af64" : "#ee816f"} /><circle cy="-6" r="3" fill="#d7c2a3" /><path d="M2-2h9" stroke="#d6dcd6" strokeWidth="2" /><path className="city-gunfire" d="M13-2h10m-8-3l5 6" stroke="#ffe4a0" strokeWidth="1.5" /></g>
                  </g>;
                })}
                <text textAnchor="middle" y="-47" fill="#ffab8f" fontSize="11" fontWeight="700">STREET BATTLE</text>
              </g>
            ) : <g transform={`translate(${point.x},${point.y})`}>
              <circle r="21" className="city-crew-halo" />
              <path d="M0-16L14-8V7L0 17-14 7V-8Z" fill="#111b20" stroke="#e0b15a" strokeWidth="2" />
              <path d="M-7-5L0 5 7-5M0 5v5" fill="none" stroke="#f3d291" strokeWidth="2.5" />
              <text textAnchor="middle" y="32" fill="#f3d291" fontSize="10" fontWeight="700">YOUR CREW</text>
            </g>}
          </g>
        </svg>
      </div>
      <div className="city-orders">
        <div className="city-readout" role="status" aria-live="polite">
          <span className={`city-live-dot ${fighting ? "battle" : ""}`} />
          <span>{busy ? `${fighting ? "Fighting in" : "Crew moving to"} ${target?.name} · ${Math.max(0, Math.ceil((order.endsAt - now) / 1000))}s` : map.report ?? "Crew ready. Tap a region to plan your next move."}</span>
        </div>
        <div className="flex items-start justify-between gap-2"><div><p className="city-eyebrow" style={{ color: colors[selected.owner] }}>{owner}</p><h3 className="text-lg font-semibold">{selected.name}</h3></div><span className="text-xs text-mute">{busy ? "ORDER ACTIVE" : "CREW READY"}</span></div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={`${control} bg-gold text-ink font-semibold`} disabled={busy || game.phase !== "play" || route.length < 2} onClick={() => { travel(stops.length ? stops : [selected.id]); setStops([]); setPlanning(false); }}>Travel {stops.length ? "route" : "here"}</button>
          <button className={control} aria-pressed={planning} disabled={busy || game.phase !== "play"} onClick={() => { setPlanning(!planning); setStops([]); }}>{planning ? "Cancel waypoints" : "Add waypoints"}</button>
          {stops.length > 0 && <button className={control} onClick={() => setStops(stops.slice(0, -1))}>Undo stop</button>}
        </div>
        {planning && <p className="mt-2 text-xs text-gold">Tap regions in order ({stops.length}/6). Then tap Travel route.</p>}
        {!busy && stops.length > 0 && <p className="mt-2 text-xs text-mute">{stops.map(id => game.districts.find(d => d.id === id)?.name).join(" → ")}</p>}
        {isGangId(selected.owner) && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <label className="text-sm text-mute">Soldiers <select aria-label="Attack soldiers" className="ml-2 min-h-11 rounded border border-line bg-panel-2 px-2 text-paper" value={send} disabled={busy || !free} onChange={e => setSoldiers(Number(e.target.value))}>{free ? Array.from({ length: free }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>) : <option value={0}>0</option>}</select></label>
          <button type="button" className={`${control} border-blood text-blood`} disabled={busy || game.phase !== "play" || !free || game.ap < 1} onClick={() => { orderAttack(selected.id, send); setStops([]); setPlanning(false); }}>Order attack</button>
          <span className="text-xs text-mute">{hitOutlook(game, selected.id, send)} · 1 move · losses are real</span>
        </div>}
        <p className="mt-3 text-xs text-mute">Travel is free scouting. It does not capture regions or station soldiers. Attacks need a bordering territory.</p>
      </div>
    </div>
  );
}
