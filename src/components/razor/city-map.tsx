import { useEffect, useRef, useState } from "react";
import { cityMapOf, crewPoint, waypointRoute } from "@/game/city-map";
import { adjacentToPlayer, freeMuscle, hitOutlook, isGangId } from "@/game/logic";
import { districtPoint, districtPolygon } from "@/game/city-geometry";
import { useRazor } from "@/game/store";
import type { GameState, Owner } from "@/game/types";

const colors: Record<Owner, string> = {
  player: "#e0b15a", neutral: "#627d80", vultures: "#ee816f", lanterns: "#c6a2f5", saints: "#82b4e0", cobras: "#79c5a0",
};
// Neighborhood materials stay recognizable as faction ownership changes.
const districtTones = ["#4d9ba5", "#c18b63", "#a37acb", "#c55b98", "#6c91b0", "#c79e51", "#6ba47b", "#529b91", "#ad6d51", "#b69251", "#468faf", "#a76869"];
const roofTones = ["#64888c", "#a08067", "#846c9b", "#97627e", "#617b93", "#a28b63", "#688b70", "#527f78", "#926b58", "#8b7b5a", "#507a8d", "#8c6065"];
const control = "min-h-11 rounded-md border border-line px-3 py-2 text-sm disabled:opacity-40";

export function CityMap({ game, onManage, toast }: { game: GameState; onManage?: () => void; toast?: string | null }) {
  const scroll = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (zoom) return;
    const frame = requestAnimationFrame(() => {
      const el = scroll.current;
      const svg = el?.querySelector("svg");
      if (el && svg) {
        const p = districtPoint(selected);
        el.scrollTop = p.y / 620 * svg.getBoundingClientRect().height - el.clientHeight / 2;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [selected.id, zoom]);

  function choose(id: string) {
    select(id);
    if (planning && !busy) setStops(current => current.length < 6 && current[current.length - 1] !== id ? [...current, id] : current);
  }

  const pathPoints = route.map(id => {
    const d = game.districts.find(d => d.id === id)!;
    const p = districtPoint(d);
    return `${p.x},${p.y}`;
  }).join(" ");

  return (
    <div className="city-shell">
      <div className="city-heading">
        <span className="city-eyebrow">CITY OPERATIONS</span>
        <details className="city-key"><summary>Factions</summary><div>{Object.entries(colors).map(([id, color]) => <span key={id}><i style={{ background: color }} />{id === "player" ? "You" : id === "neutral" ? "Open" : game.gangs[id as keyof typeof game.gangs].name}</span>)}</div></details>
        <button type="button" className={control} aria-pressed={zoom} onClick={() => {
          setZoom(!zoom);
          if (!zoom) requestAnimationFrame(() => {
            const el = scroll.current;
            if (el) { const p = districtPoint(selected); el.scrollTo({ left: p.x / 660 * 900 - el.clientWidth / 2, top: p.y / 620 * 845 - el.clientHeight / 2 }); }
          });
        }}>{zoom ? "Fit city" : "Zoom +"}</button>
      </div>
      <div ref={scroll} className="city-scroll" tabIndex={zoom ? 0 : undefined} aria-label="City map; zoom and drag to explore streets">
        <svg className={`city-svg ${zoom ? "city-zoom" : ""}`} viewBox="0 0 660 620" aria-label="Razor City district map">
          <defs>
            <pattern id="water-lines" width="24" height="12" patternUnits="userSpaceOnUse"><path d="M0 6h12" stroke="#36748a" strokeWidth="1" /></pattern>
            <pattern id="city-grain" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M1 2h1m6 6h1" stroke="#98aaa0" strokeOpacity=".07" /></pattern>
          </defs>
          <rect width="660" height="620" fill="#103b50" />
          <rect width="660" height="620" fill="url(#water-lines)" />
          <path d="M10 10L654 6 660 540 615 569 565 560 512 590 455 579 409 590 357 562 302 585 236 572 175 594 97 565 16 575Z" fill="#263c40" stroke="#455b5b" strokeWidth="2" />
          <rect width="660" height="620" fill="url(#city-grain)" pointerEvents="none" />
          <text x="338" y="610" textAnchor="middle" className="city-water-label">HOLLOW HARBOR</text>
          <text x="627" y="26" fill="#94a8a6" fontSize="14">N ↑</text>
          {game.districts.map((d, index) => {
            const center = districtPoint(d);
            const polygon = districtPolygon(d).map(p => p.join(",")).join(" ");
            const on = d.id === selected.id;
            const color = colors[d.owner];
            return (
              <g key={d.id} className="city-region" role="button" tabIndex={0} aria-label={`${d.name}, ${d.owner === "neutral" ? "open" : d.owner === "player" ? "yours" : game.gangs[d.owner].name}`} aria-pressed={on} onClick={() => choose(d.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(d.id); } }}>
                <polygon points={polygon} fill={districtTones[index]} fillOpacity={on ? ".56" : ".32"} stroke={on ? "#ffe1a2" : color} strokeOpacity={on ? 1 : .75} strokeWidth={on ? 2.5 : 1.4} strokeDasharray={on ? "7 4" : d.owner === "neutral" ? "3 6" : undefined} />
                {Array.from({ length: 10 }, (_, b) => {
                  const side = b < 5 ? -1 : 1;
                  const bx = center.x - 65 + (b % 5) * 27 + ((index * 3 + b) % 5);
                  const by = center.y + side * 38 - 12;
                  const w = 15 + ((index + b * 3) % 9);
                  const h = 18 + ((index * 7 + b * 11) % 19);
                  if ((index === 1 || index === 6) && b % 4 === 0) return <g key={b} pointerEvents="none"><ellipse cx={bx + 7} cy={by + 8} rx="11" ry="15" fill="#265e46" /><circle cx={bx + 6} cy={by + 4} r="7" fill="#4d9164" /></g>;
                  return <g key={b} pointerEvents="none" transform={`rotate(${index % 2 ? -4 : 4},${bx},${by})`}><rect x={bx + 4} y={by + 5} width={w} height={h} fill="#070e13" opacity=".8" /><rect x={bx} y={by} width={w} height={h} fill={roofTones[index]} stroke="#b5b6a1" strokeWidth=".6" /><path d={`M${bx + 3} ${by + 4}h${w - 6}m${3 - w} 5h${w - 6}`} stroke={color} strokeOpacity=".85" strokeWidth="1.2" /><rect x={bx + w / 2 - 3} y={by + h / 2} width="6" height="6" fill={b % 3 === 0 ? "#e9c77e" : "#293c44"} /></g>;
                })}

              </g>
            );
          })}
          <g pointerEvents="none">
            {game.districts.flatMap(d => game.districts.filter(n => (n.col === d.col + 1 && n.row === d.row) || (n.row === d.row + 1 && n.col === d.col)).map(n => {
              const a = districtPoint(d), b = districtPoint(n);
              return <g key={`${d.id}-${n.id}`}><path d={`M${a.x} ${a.y}L${b.x} ${b.y}`} stroke="#81938b" strokeWidth="17" /><path d={`M${a.x} ${a.y}L${b.x} ${b.y}`} stroke="#273238" strokeWidth="14" /><path d={`M${a.x} ${a.y}L${b.x} ${b.y}`} stroke="#9c9b80" strokeWidth=".8" strokeDasharray="5 9" /></g>;
            }))}
            <path d="M27 40L39 194 23 370 41 538" stroke="#6a7976" strokeWidth="4" strokeDasharray="2 6" />
            {[100, 250, 405, 550].map((x, i) => <g key={x}><path d={`M${x} 555v34h25`} fill="none" stroke="#748485" strokeWidth="3" /><path d={`M${x} 580l28-18m-18 6v20`} stroke="#a2a080" fill="none" /><rect x={x + 7} y={552 + i % 2 * 4} width="28" height="10" fill="#4d6267" /></g>)}
          </g>
          <g pointerEvents="none">
            {game.districts.map(d => {
              const p = districtPoint(d);
              const words = d.short.split(" ");
              const lines = words.length > 1 ? [words.slice(0, -1).join(" "), words[words.length - 1]] : [d.short];
              const color = colors[d.owner];
              return <g key={d.id}>
                <rect x={p.x - 61} y={p.y - 82} width="122" height="36" rx="5" fill="#101e27" stroke={color} strokeOpacity=".75" />
                <path d={`M${p.x - 55} ${p.y - 47}h110`} stroke={color} strokeWidth="2" />
                <text x={p.x} fill={d.id === selected.id ? "#ffe1a2" : "#f1eee5"} textAnchor="middle" fontSize="12" fontWeight="700" letterSpacing=".7">
                  {lines.map((line, i) => <tspan key={line} x={p.x} y={p.y - (lines.length === 1 ? 60 : 67) + i * 14}>{line}</tspan>)}
                </text>
                <circle cx={p.x + 54} cy={p.y - 76} r="2.5" fill={color} />
              </g>;
            })}
          </g>
          <g pointerEvents="none">
            <polyline points={pathPoints} className={busy ? "city-route active" : "city-route"} />
            {!busy && stops.map((id, i) => {
              const d = game.districts.find(d => d.id === id)!;
              return <g key={`${id}-${i}`} transform={`translate(${districtPoint(d).x},${districtPoint(d).y})`}><circle r="10" fill="#e0b15a" /><text textAnchor="middle" y="4" fontSize="12" fill="#101915" fontWeight="bold">{i + 1}</text></g>;
            })}
            {[0, 1, 2].map(i => <rect key={i} className={`city-car city-car-${i}`} x="0" y={122 + i * 173} width="9" height="4" rx="1" fill={i === 1 ? "#d1b583" : "#668d9c"} />)}
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
        <div className="city-selection"><div><p className="city-eyebrow" style={{ color: colors[selected.owner] }}>{owner}</p><h3>{selected.name}</h3></div><span>{busy ? "ORDER ACTIVE" : `DEF ${selected.defense}`}</span></div>
        <div className="city-action-row">
          <button type="button" className={`${control} bg-gold text-ink font-semibold`} disabled={busy || game.phase !== "play" || route.length < 2} onClick={() => { travel(stops.length ? stops : [selected.id]); setStops([]); setPlanning(false); }}>Travel {stops.length ? "route" : "here"}</button>
          <button type="button" className={control} aria-pressed={planning} disabled={busy || game.phase !== "play"} onClick={() => { setPlanning(!planning); setStops([]); }}>{planning ? "Cancel route" : "Waypoints"}</button>
          <button type="button" className={control} onClick={onManage}>Manage</button>
        </div>
        {planning && <div className="city-plan-row"><span>Tap stops in order ({stops.length}/6)</span>{stops.length > 0 && <button type="button" onClick={() => setStops(stops.slice(0, -1))}>Undo</button>}</div>}
        {isGangId(selected.owner) && <div className="city-attack-row">
          <label>Soldiers <select aria-label="Attack soldiers" value={send} disabled={busy || !free} onChange={e => setSoldiers(Number(e.target.value))}>{free ? Array.from({ length: free }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>) : <option value={0}>0</option>}</select></label>
          <button type="button" className={`${control} border-blood text-blood`} disabled={busy || game.phase !== "play" || !free || game.ap < 1 || !adjacentToPlayer(game, selected.id)} onClick={() => { orderAttack(selected.id, send); setStops([]); setPlanning(false); }}>Attack · 1 move</button>
          <span>{adjacentToPlayer(game, selected.id) ? hitOutlook(game, selected.id, send) : "Border required"}</span>
        </div>}
        <div className={`city-readout ${toast ? "city-error" : ""}`} role="status" aria-live="polite">
          <span className={`city-live-dot ${fighting ? "battle" : ""}`} />
          <span>{toast ?? (busy ? `${fighting ? "Fighting in" : "Moving to"} ${target?.name} · ${Math.max(0, Math.ceil((order.endsAt - now) / 1000))}s` : map.report ?? "Tap a region. Travel scouts; attacks capture.")}</span>
        </div>
      </div>
    </div>
  );
}
