import { regionEvent } from "@/game/world-events";
import { useEffect, useRef, useState } from "react";
import { PRODUCT_IDS, PRODUCTS } from "@/game/content";
import { money } from "@/game/logic";
import { marketDemandVsSupplyPercent, regionMarket } from "@/game/region-economy";
import { cityMapOf } from "@/game/city-map";
import { useRazor } from "@/game/store";
import type { GameState, ProductId } from "@/game/types";

export function RegionMarket({ game, close, initialProduct = null }: { game: GameState; close: () => void; initialProduct?: ProductId | null }) {
  const selected = game.districts.find(d => d.id === game.selectedId)!;
  const local = regionMarket(game, selected.id);
  const trade = useRazor(s => s.tradeRegion);
  const travel = useRazor(s => s.travel);
  const select = useRazor(s => s.select);
  const toast = useRazor(s => s.toast);
  const [quantities, setQuantities] = useState<Record<ProductId, number | "">>(() => Object.fromEntries(
    PRODUCT_IDS.map(product => [product, Math.min(10, Math.max(0, game.stash[product] ?? 0))])
  ) as Record<ProductId, number | "">);
  const [compare, setCompare] = useState(false);
  const [confirmation, setConfirmation] = useState<{ region: string; product: ProductId; quantity: number; side: "buy" | "sell"; unitPrice: number } | null>(null);
  const dialog = useRef<HTMLElement>(null);
  const productRefs = useRef<Partial<Record<ProductId, HTMLElement | null>>>({});
  const present = cityMapOf(game).locationId === selected.id;
  const busy = !!cityMapOf(game).order || game.phase !== "play";
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    if (initialProduct) productRefs.current[initialProduct]?.scrollIntoView({ block: "start", behavior: "instant" });
    return () => previous?.focus();
  }, []);
  return <div className="region-market-backdrop"><section ref={dialog} role="dialog" aria-modal="true" aria-label="Regional market" className="region-market-dialog" tabIndex={-1} onKeyDown={e => {
    if (e.key === "Escape") { if (confirmation) setConfirmation(null); else close(); }
    if (e.key !== "Tab") return;
    const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? []).filter(node => !node.closest('[inert]'));
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (!first) return;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first.focus(); }
  }}>
    <header inert={!!confirmation} className="region-market-title"><div><p>LOCAL ECONOMY · WEEK {game.week}</p><h2>{selected.name}</h2></div><button type="button" aria-label="Close regional market" onClick={close}>✕</button></header>
    <div inert={!!confirmation} className="region-market-content">
      {regionEvent(game,selected.id)&&<div className="market-news market-world-event"><strong>{regionEvent(game,selected.id)!.name.toUpperCase()}</strong><p>{regionEvent(game,selected.id)!.description}</p></div>}
      <div className={`market-news ${local.event}`}><strong>{local.event === "surge" ? "PRICE SPIKE" : local.event === "slump" ? "PRICE DROP" : "MARKET WATCH"}</strong><p>{local.headline}</p></div>
      <div className="market-location"><span>{present ? "● Your crew is here" : "○ Travel here to buy or sell"}</span><button type="button" aria-pressed={compare} onClick={() => setCompare(!compare)}>{compare ? "Hide comparison" : "Compare regions"}</button></div>
      {!present && <button type="button" className="market-travel" disabled={busy} onClick={() => { travel([selected.id]); close(); }}>Travel to {selected.name}</button>}
      <p className="market-help">Quotes change each week and on arrival. Sales add police heat and reduce prices and buyer demand; buying raises prices. No move cost. Local stock and buyers replenish next week.</p>
      <p className="market-help" role="status">Available cash: <strong>{money(game.cash)}</strong> · Review quantity and total cost before buying.</p>
      <div className="inventory-market-summary"><strong>YOUR INVENTORY</strong><div>{PRODUCT_IDS.map(product => <button key={product} type="button" onClick={() => productRefs.current[product]?.scrollIntoView({ block: "start", behavior: "smooth" })}><span>{PRODUCTS[product].name}</span><b>{game.stash[product] ?? 0} units</b><small>{money((game.stash[product] ?? 0) * local.products[product].sell)} est.</small></button>)}</div></div>
      <div className="market-products">{PRODUCT_IDS.map(product => {
        const q = local.products[product];
        const draft = quantities[product];
        const quantity = draft === "" ? 0 : draft;
        const trend = Number.isFinite(q.previousSell) && q.previousSell > 0 ? Math.round((q.sell / q.previousSell - 1) * 100) : null;
        const demandVsSupply = marketDemandVsSupplyPercent(q);
        const canSell = Math.min(game.stash[product], q.buyers);
        const canBuy = Math.max(0, Math.min(q.supply, Math.floor(game.cash / q.buy)));
        return <article key={product} ref={node => { productRefs.current[product] = node; }} className="market-product">
          <div className="market-product-heading"><h3>{PRODUCTS[product].name}</h3><span className={trend !== null && trend > 0 ? "market-up" : trend !== null && trend < 0 ? "market-down" : ""}>Sell price change vs previous quote: {trend === null ? "No previous quote" : trend > 0 ? `▲ +${trend}%` : trend < 0 ? `▼ ${trend}%` : "0% (no change)"}</span></div>
          <div className="market-price-grid"><div><span>SELL / UNIT</span><strong>{money(q.sell)}</strong></div><div><span>BUY / UNIT</span><strong>{money(q.buy)}</strong></div><div><span>DEMAND VS SUPPLY</span><strong>{demandVsSupply === null ? "No stock" : `${demandVsSupply}%`}</strong></div></div>
          <p className="market-help">Demand vs supply = buyers wanting units ÷ local stock. Over 100% means buyers outnumber local supply.</p>
          <div className="market-stock"><span>Buyers want {q.buyers}</span><span>Local stock {q.supply}</span><span>You hold {game.stash[product]}</span><span>Affordable: {canBuy} units ({money(canBuy * q.buy)})</span></div>
          <div className="market-trade-controls"><label>Units<input aria-label={`${PRODUCTS[product].name} units`} type="number" min="0" max="9999" step="1" inputMode="numeric" value={draft} onChange={e => {
            const raw = e.currentTarget.value;
            // Keep an empty draft empty: never reinsert a default while the user types.
            if (raw === "") { setQuantities(v => ({ ...v, [product]: "" })); return; }
            if (!/^\d+$/.test(raw)) return;
            const next = Math.min(9999, Number(raw));
            setQuantities(v => ({ ...v, [product]: next }));
          }} /></label><button type="button" onClick={() => setQuantities(v => ({ ...v, [product]: Math.max(0, canSell) }))}>Max sell</button><button type="button" disabled={canBuy === 0} onClick={() => setQuantities(v => ({ ...v, [product]: canBuy }))}>Max buy · {canBuy} ({money(canBuy * q.buy)})</button></div>
          <div className="market-trade-buttons"><button type="button" className="market-sell" disabled={!present || busy || quantity < 1 || quantity > canSell} onClick={() => setConfirmation({ region: selected.id, product, quantity, side: "sell", unitPrice: q.sell })}>Sell {quantity} · {money(quantity * q.sell)}</button><button type="button" disabled={!present || busy || canBuy === 0 || quantity < 1 || quantity > canBuy} onClick={() => setConfirmation({ region: selected.id, product, quantity, side: "buy", unitPrice: q.buy })}>Buy {quantity} · {money(quantity * q.buy)}</button></div>
          {present && quantity > q.buyers && <p className="market-help">Local buyers cannot take that many this week.</p>}
          {compare && <div className="market-comparison"><p>BEST SELL PRICES · {PRODUCTS[product].name}</p>{[...game.districts].sort((a, b) => regionMarket(game, b.id).products[product].sell - regionMarket(game, a.id).products[product].sell).slice(0, 4).map(d => {
            const quote = regionMarket(game, d.id).products[product];
            return <button key={d.id} type="button" onClick={() => select(d.id)}><span>{d.name}</span><strong>{money(quote.sell)}</strong><small>{quote.buyers} buyers</small></button>;
          })}<small>Live quotes may move by the time you arrive.</small></div>}
        </article>;
      })}</div>
      {toast && <p className="market-feedback" role="status">{toast}</p>}
    </div>
      {confirmation && <div className="market-confirm-backdrop"><div role="alertdialog" aria-modal="true" aria-label="Confirm regional trade" className="market-news market-confirm-panel">
        <strong>CONFIRM {confirmation.side.toUpperCase()}</strong>
        <p>{confirmation.quantity} {PRODUCTS[confirmation.product].name} in {game.districts.find(d => d.id === confirmation.region)?.name} at {money(confirmation.unitPrice)} each. Total: <strong>{money(confirmation.quantity * confirmation.unitPrice)}</strong>.</p>
        <div className="market-trade-buttons">
          <button type="button" onClick={() => setConfirmation(null)}>Cancel</button>
          <button type="button" className="market-sell" onClick={() => {
            const pending = confirmation;
            setConfirmation(null);
            // Never execute at a price different from the one the player confirmed.
            const latest = useRazor.getState().game;
            const quote = latest ? regionMarket(latest, pending.region).products[pending.product] : null;
            if (!latest || !quote || (pending.side === "buy" ? quote.buy : quote.sell) !== pending.unitPrice) {
              useRazor.setState({ toast: "The quote changed. Review the new price before trading." });
              return;
            }
            // The game action also revalidates cash, demand, stock and location.
            trade(pending.region, pending.product, pending.quantity, pending.side);
          }}>Confirm {confirmation.side}</button>
        </div>
      </div></div>}
  </section></div>;
}
