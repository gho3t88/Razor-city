import { regionEvent } from "@/game/world-events";
import { combatOf, levelOf, weaponOf } from "@/game/combat";
import { regionMarket } from "@/game/region-economy";
import { PRODUCTS } from "@/game/content";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

export function CityMap({ game, onManage, onTrade, onGear, toast }: { game: GameState; onManage?: () => void; onTrade?: () => void; onGear?: () => void; toast?: string | null }) {
  const scroll = useRef<HTMLDivElement>(null);
  const select = useRazor(s => s.select);
  const travel = useRazor(s => s.travel);
  const orderAttack = useRazor(s => s.orderAttack);
  const tick = useRazor(s => s.tickCity);
  const [now, setNow] = useState(Date.now());
  const [planning, setPlanning] = useState(false);
  const [stops, setStops] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const zoomAnchor = useRef<{ x: number; y: number; mapX: number; mapY: number } | null>(null);
  const pinch = useRef<{ distance: number; initialZoom: number } | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [soldiers, setSoldiers] = useState(4);
  const map = cityMapOf(game);
  const order = map.order;
  const selected = game.districts.find(d => d.id === game.selectedId) ?? game.districts[0];
  const localMarket = regionMarket(game, selected.id);
  const event = regionEvent(game, selected.id);
  const atSelected = map.locationId === selected.id;
  const route = order?.route ?? waypointRoute(game, stops.length ? stops : [selected.id]);
  const canTravel = route.length > 1 && (stops.length > 0 || !atSelected);
  const point = crewPoint(game, reducedMotion && order ? (now >= order.arrivesAt ? order.arrivesAt : order.startedAt) : now);
  const busy = !!order || !!combatOf(game).ambush;
  const fighting = !!order && (order.kind === "attack" || order.kind === "ambush") && now >= order.arrivesAt;
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

  // Keep the point between the fingers (or at the center for toolbar zoom) stationary.
  function changeZoom(next: number, clientX?: number, clientY?: number) {
    const el = scroll.current;
    const level = Math.round(Math.max(1, Math.min(3.25, next)) * 100) / 100;
    if (!el || level === zoomRef.current) return;
    const rect = el.getBoundingClientRect();
    const x = clientX == null ? el.clientWidth / 2 : clientX - rect.left;
    const y = clientY == null ? el.clientHeight / 2 : clientY - rect.top;
    zoomAnchor.current = {
      x, y,
      mapX: (el.scrollLeft + x) / (el.clientWidth * zoomRef.current),
      mapY: (el.scrollTop + y) / (el.clientHeight * zoomRef.current),
    };
    zoomRef.current = level;
    setZoom(level);
  }

  useLayoutEffect(() => {
    const el = scroll.current;
    const anchor = zoomAnchor.current;
    if (el && anchor) {
      el.scrollLeft = anchor.mapX * el.clientWidth * zoom - anchor.x;
      el.scrollTop = anchor.mapY * el.clientHeight * zoom - anchor.y;
      zoomAnchor.current = null;
    }
  }, [zoom]);

  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    const distance = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const start = (e: TouchEvent) => {
      if (e.touches.length === 2) pinch.current = { distance: Math.max(1, distance(e.touches)), initialZoom: zoomRef.current };
    };
    const move = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinch.current) return;
      e.preventDefault(); // Don't zoom the entire Android WebView.
      const x = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const y = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      changeZoom(pinch.current.initialZoom * distance(e.touches) / pinch.current.distance, x, y);
    };
    const end = (e: TouchEvent) => { if (e.touches.length < 2) pinch.current = null; };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, []);

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
        <button type="button" className={`${control} city-gear-button`} onClick={onGear} aria-label="Black market and training">Gear · L{levelOf(game)}</button>
        <details className="city-key"><summary>Factions</summary><div>{Object.entries(colors).map(([id, color]) => <span key={id}><i style={{ background: color }} />{id === "player" ? "You" : id === "neutral" ? "Open" : game.gangs[id as keyof typeof game.gangs].name}</span>)}</div></details>

      </div>
      <div className="city-map-frame">
        <div ref={scroll} className="city-scroll" tabIndex={0} aria-label="City map. Pinch with two fingers to zoom; drag to pan.">
        <svg className="city-svg" viewBox="0 0 660 620" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }} aria-label="Razor City district map">
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
              <g key={d.id} className="city-region" role="button" tabIndex={0} aria-label={`${d.name}, ${d.owner === "neutral" ? "open" : d.owner === "player" ? "yours" : game.gangs[d.owner].name}${regionEvent(game, d.id)?.kind === "lockdown" ? ", police lockdown" : ""}`} aria-pressed={on} onClick={() => choose(d.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(d.id); } }}>
                <polygon points={polygon} fill={districtTones[index]} fillOpacity={on ? ".56" : ".32"} stroke={on ? "#ffe1a2" : color} strokeOpacity={on ? 1 : .75} strokeWidth={on ? 2.5 : 1.4} strokeDasharray={on ? "7 4" : d.owner === "neutral" ? "3 6" : undefined} />
                {regionEvent(game, d.id)?.kind === "lockdown" && <polygon points={polygon} className="city-lockdown-region" pointerEvents="none" />}
                {Array.from({ length: d.wealth > 1.3 ? 12 : d.lab ? 8 : 10 }, (_, b) => {
                  const split = d.wealth > 1.3 ? 6 : d.lab ? 4 : 5;
                  const side = b < split ? -1 : 1;
                  const col = b % split;
                  const bx = center.x - 58 + col * (split === 6 ? 22 : split === 4 ? 34 : 27) + ((index * 7 + b * 3) % 7 - 3);
                  // Leave a clear junction for the crew, route, and status icon.
                  const by = center.y + (side < 0 ? -76 : 51) + ((index * 5 + b) % 7 - 3);
                  const w = 12 + ((index + b * 3) % 10);
                  const h = 14 + ((index * 7 + b * 11) % 15);
                  if ((d.id === "cobra" || d.id === "sinks" || d.id === "glass") && b % 3 === 0) {
                    return <g key={b} pointerEvents="none"><ellipse cx={bx + 8} cy={by + 9} rx="13" ry="14" fill="#255744" stroke="#39745b" /><circle cx={bx + 3} cy={by + 5} r="6" fill="#63a475" /><circle cx={bx + 13} cy={by + 11} r="7" fill="#4b9369" /></g>;
                  }
                  if (d.id === "hollow" && b % 3 === 0) {
                    return <g key={b} pointerEvents="none"><rect x={bx} y={by} width={w + 5} height="9" rx="1" fill="#bd865c" /><rect x={bx + 2} y={by + 11} width={w + 4} height="9" rx="1" fill="#628d9b" /><path d={`M${bx + 6} ${by}v20m8-20v20`} stroke="#273f47" strokeWidth="1.3" /></g>;
                  }
                  if (d.lab && b % 3 === 0) {
                    return <g key={b} pointerEvents="none"><rect x={bx + 3} y={by + 5} width={w + 2} height={h + 1} fill="#080e13" opacity=".7" /><rect x={bx} y={by} width={w + 2} height={h} fill="#536e70" stroke="#9b9d8a" strokeWidth=".8" /><path d={`M${bx + 5} ${by - 8}v12h5v-7h4v7`} fill="none" stroke="#abb2a5" strokeWidth="3" /><path d={`M${bx + 2} ${by + 8}h${w - 2}`} stroke="#e2a65a" strokeWidth="2" /></g>;
                  }
                  return <g key={b} pointerEvents="none" transform={`rotate(${(index + b) % 3 === 0 ? -7 : (index + b) % 3 === 1 ? 4 : 9},${bx},${by})`}><rect x={bx + 4} y={by + 5} width={w} height={h} fill="#070e13" opacity=".8" /><rect x={bx} y={by} width={w} height={h} fill={roofTones[(index + Math.floor(b / 4)) % roofTones.length]} stroke="#b5b6a1" strokeWidth=".6" /><path d={`M${bx + 3} ${by + 4}h${w - 6}m${3 - w} 5h${w - 6}`} stroke={color} strokeOpacity=".85" strokeWidth="1.2" /><rect x={bx + w / 2 - 3} y={by + h / 2} width="6" height="6" fill={b % 3 === 0 ? "#e9c77e" : "#293c44"} /></g>;
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
                {regionEvent(game, d.id)?.kind === "lockdown" && <g transform={`translate(${p.x + 46},${p.y - 33})`} className="city-lockdown-badge"><title>Police lockdown in ${d.name}</title><circle r="12" fill="#792725" stroke="#ffb29c" strokeWidth="2" /><text y="5" textAnchor="middle" fontSize="16" fontWeight="900" fill="#fff2de">!</text></g>}
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
        <div className="city-zoom-controls" role="group" aria-label="Map zoom">
          <button type="button" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => changeZoom(zoomRef.current / 1.4)}>−</button>
          <button type="button" aria-label="Zoom in" disabled={zoom >= 3.25} onClick={() => changeZoom(zoomRef.current * 1.4)}>+</button>
          <button type="button" aria-label="Reset map view" disabled={zoom <= 1} onClick={() => changeZoom(1)}>Fit</button>
        </div>
      </div>
      <div className="city-orders">
        <div className="city-selection"><div><p className="city-eyebrow" style={{ color: colors[selected.owner] }}>{owner}</p><h3>{selected.name}</h3></div><span>{busy ? "ORDER ACTIVE" : `DEF ${selected.defense}`}</span></div>
        {event && <p className={`city-event-strip ${event.kind === "lockdown" ? "lockdown" : ""}`} role={event.kind === "lockdown" ? "alert" : undefined}>{event.kind === "lockdown" ? "⚠ " : ""}{event.name.toUpperCase()} · {event.description}</p>}
        <div className="city-market-note"><span>{localMarket.eventProduct ? `${PRODUCTS[localMarket.eventProduct].name} ${localMarket.event === "surge" ? "▲ PRICE SPIKE" : "▼ PRICE DROP"}` : "LOCAL PRICES & DEMAND"}</span><span>Dust ${localMarket.products.dust.sell}/unit</span></div>
        <div className="city-action-row">
          <button type="button" className={`${control} bg-gold text-ink font-semibold`} disabled={busy || game.phase !== "play" || !canTravel} onClick={() => { travel(stops.length ? stops : [selected.id]); setStops([]); setPlanning(false); }}>{stops.length ? "Travel route" : atSelected ? "Already here" : "Travel here"}</button>
          <button type="button" className={control} aria-pressed={planning} disabled={busy || game.phase !== "play"} onClick={() => { setPlanning(!planning); setStops([]); }}>{planning ? "Cancel route" : "Waypoints"}</button>
          <button type="button" className={control} onClick={onTrade}>Trade</button>
          <button type="button" className={control} onClick={onManage}>Manage</button>
        </div>
        {planning && <div className="city-plan-row"><span>Tap stops in order ({stops.length}/6)</span>{stops.length > 0 && <button type="button" onClick={() => setStops(stops.slice(0, -1))}>Undo</button>}</div>}
        {selected.owner !== "player" && <div className="city-attack-row">
          <label>Soldiers <select aria-label="Attack soldiers" value={send} disabled={busy || !free} onChange={e => setSoldiers(Number(e.target.value))}>{free ? Array.from({ length: free }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>) : <option value={0}>0</option>}</select></label>
          <button type="button" className={`${control} border-blood text-blood`} disabled={busy || game.phase !== "play" || !free || game.ap < 1 || !adjacentToPlayer(game, selected.id)} onClick={() => { orderAttack(selected.id, send); setStops([]); setPlanning(false); }}>Attack · 1 move</button>
          <span>{adjacentToPlayer(game, selected.id) ? hitOutlook(game, selected.id, send) : "Border required"}</span>
        </div>}
        <div className={`city-readout ${toast ? "city-error" : ""}`} role="status" aria-live="polite">
          <span className={`city-live-dot ${fighting ? "battle" : ""}`} />
          <span>{toast ?? (order ? `${fighting ? "Fighting in" : "Moving to"} ${target?.name} · ${Math.max(0, Math.ceil((order.endsAt - now) / 1000))}s` : map.report ?? "Tap a region. Travel scouts; attacks capture.")}</span>
        </div>
      </div>
    </div>
  );
}
