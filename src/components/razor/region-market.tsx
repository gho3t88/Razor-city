import { useEffect, useRef, useState } from "react";
import { PRODUCT_IDS, PRODUCTS } from "@/game/content";
import { money } from "@/game/logic";
import { regionMarket } from "@/game/region-economy";
import { cityMapOf } from "@/game/city-map";
import { useRazor } from "@/game/store";
import type { GameState, ProductId } from "@/game/types";

export function RegionMarket({ game, close }: { game: GameState; close: () => void }) {
  const selected = game.districts.find(d => d.id === game.selectedId)!;
  const local = regionMarket(game, selected.id);
  const trade = useRazor(s => s.tradeRegion);
  const travel = useRazor(s => s.travel);
  const select = useRazor(s => s.select);
  const toast = useRazor(s => s.toast);
  const [quantities, setQuantities] = useState<Record<ProductId, number>>({ dust: 10, velvet: 10, ice: 10, grow: 10 });
  const [compare, setCompare] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const present = cityMapOf(game).locationId === selected.id;
  const busy = !!cityMapOf(game).order || game.phase !== "play";
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus(); return () => previous?.focus();
  }, []);
  return <div className="region-market-backdrop"><section ref={dialog} role="dialog" aria-modal="true" aria-label="Regional market" className="region-market-dialog" tabIndex={-1} onKeyDown={e => {
    if (e.key === "Escape") close();
    if (e.key !== "Tab") return;
    const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? []);
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (!first) return;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first.focus(); }
  }}>
    <header className="region-market-title"><div><p>LOCAL ECONOMY · WEEK {game.week}</p><h2>{selected.name}</h2></div><button type="button" aria-label="Close regional market" onClick={close}>✕</button></header>
    <div className="region-market-content">
      <div className={`market-news ${local.event}`}><strong>{local.event === "surge" ? "PRICE SPIKE" : local.event === "slump" ? "PRICE DROP" : "MARKET WATCH"}</strong><p>{local.headline}</p></div>
      <div className="market-location"><span>{present ? "● Your crew is here" : "○ Travel here to buy or sell"}</span><button type="button" aria-pressed={compare} onClick={() => setCompare(!compare)}>{compare ? "Hide comparison" : "Compare regions"}</button></div>
      {!present && <button type="button" className="market-travel" disabled={busy} onClick={() => { travel([selected.id]); close(); }}>Travel to {selected.name}</button>}
      <p className="market-help">Quotes change each week and on arrival. Sales add police heat and reduce prices and buyer demand; buying raises prices. No move cost. Local stock and buyers replenish next week.</p>
      <div className="market-products">{PRODUCT_IDS.map(product => {
        const q = local.products[product]; const quantity = quantities[product];
        const trend = Math.round((q.sell / q.previousSell - 1) * 100);
        const canSell = Math.min(game.stash[product], q.buyers);
        const canBuy = Math.min(q.supply, Math.floor(game.cash / q.buy));
        return <article key={product} className="market-product">
          <div className="market-product-heading"><h3>{PRODUCTS[product].name}</h3><span className={trend > 0 ? "market-up" : trend < 0 ? "market-down" : ""}>{trend > 0 ? "▲ +" : trend < 0 ? "▼ " : "— "}{trend}%</span></div>
          <div className="market-price-grid"><div><span>SELL / UNIT</span><strong>{money(q.sell)}</strong></div><div><span>BUY / UNIT</span><strong>{money(q.buy)}</strong></div><div><span>DEMAND</span><strong>{q.demand}%</strong></div></div>
          <div className="market-stock"><span>Buyers want {q.buyers}</span><span>Local stock {q.supply}</span><span>You hold {game.stash[product]}</span></div>
          <div className="market-trade-controls"><label>Units<input aria-label={`${PRODUCTS[product].name} units`} type="number" min="1" max="9999" step="1" value={quantity} onChange={e => setQuantities(v => ({ ...v, [product]: Math.min(9999, Math.max(1, Math.floor(Number(e.target.value) || 1))) }))} /></label><button type="button" onClick={() => setQuantities(v => ({ ...v, [product]: Math.max(1, canSell) }))}>Max sell</button><button type="button" onClick={() => setQuantities(v => ({ ...v, [product]: Math.max(1, canBuy) }))}>Max buy</button></div>
          <div className="market-trade-buttons"><button type="button" className="market-sell" disabled={!present || busy || quantity > canSell} onClick={() => trade(selected.id, product, quantity, "sell")}>Sell {quantity} · {money(quantity * q.sell)}</button><button type="button" disabled={!present || busy || quantity > canBuy} onClick={() => trade(selected.id, product, quantity, "buy")}>Buy {quantity} · {money(quantity * q.buy)}</button></div>
          {present && quantity > q.buyers && <p className="market-help">Local buyers cannot take that many this week.</p>}
          {compare && <div className="market-comparison"><p>BEST SELL PRICES · {PRODUCTS[product].name}</p>{[...game.districts].sort((a, b) => regionMarket(game, b.id).products[product].sell - regionMarket(game, a.id).products[product].sell).slice(0, 4).map(d => {
            const quote = regionMarket(game, d.id).products[product];
            return <button key={d.id} type="button" onClick={() => select(d.id)}><span>{d.name}</span><strong>{money(quote.sell)}</strong><small>{quote.buyers} buyers</small></button>;
          })}<small>Live quotes may move by the time you arrive.</small></div>}
        </article>;
      })}</div>
      {toast && <p className="market-feedback" role="status">{toast}</p>}
    </div>
  </section></div>;
}
