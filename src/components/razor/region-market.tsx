import { regionEvent } from "@/game/world-events";
import { useEffect, useRef, useState } from "react";
import { PRODUCT_IDS, PRODUCTS } from "@/game/content";
import { money } from "@/game/logic";
import { regionMarket } from "@/game/region-economy";
import { cityMapOf } from "@/game/city-map";
import { useRazor } from "@/game/store";
import { normalizeTradeQuantity, validTradeQuantity } from "@/game/quantity-input";
import type { GameState, ProductId } from "@/game/types";

export function RegionMarket({ game, close, initialProduct = null }: { game: GameState; close: () => void; initialProduct?: ProductId | null }) {
  const selected = game.districts.find(d => d.id === game.selectedId)!;
  const local = regionMarket(game, selected.id);
  const trade = useRazor(s => s.tradeRegion);
  const travel = useRazor(s => s.travel);
  const select = useRazor(s => s.select);
  const toast = useRazor(s => s.toast);
  const [sellQuantities, setSellQuantities] = useState<Partial<Record<ProductId, string>>>({});
  const [buyQuantities, setBuyQuantities] = useState<Partial<Record<ProductId, string>>>({});
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
      {regionEvent(game,selected.id)&&<div className="market-news market-world-event"><strong>{regionEvent(game,selected.id)!.name.toUpperCase()}</strong><p>{regionEvent(game,selected.id)!.description}</p></div>}
      <div className={`market-news ${local.event}`}><strong>{local.event === "surge" ? "PRICE SPIKE" : local.event === "slump" ? "PRICE DROP" : "MARKET WATCH"}</strong><p>{local.headline}</p></div>
      <div className="market-location"><span>{present ? "● Your crew is here" : "○ Travel here to buy or sell"}</span><button type="button" aria-pressed={compare} onClick={() => setCompare(!compare)}>{compare ? "Hide comparison" : "Compare regions"}</button></div>
      {!present && <button type="button" className="market-travel" disabled={busy} onClick={() => { travel([selected.id]); close(); }}>Travel to {selected.name}</button>}
      <p className="market-help">Quotes change each week and on arrival. Sales add police heat and reduce prices and buyer demand; buying raises prices. No move cost. Local stock and buyers replenish next week.</p>
      <p className="market-help">Demand index (0–100) describes market conditions, not the ratio of buyers to local stock. Buyers want is the remaining quantity buyers will take.</p>
      <p className="market-help" role="status">Available cash: <strong>{money(game.cash)}</strong> · Review quantity and total cost before buying.</p>
      <div className="inventory-market-summary"><strong>YOUR INVENTORY</strong><div>{PRODUCT_IDS.map(product => <button key={product} type="button" onClick={() => productRefs.current[product]?.scrollIntoView({ block: "start", behavior: "smooth" })}><span>{PRODUCTS[product].name}</span><b>{game.stash[product] ?? 0} units</b><small>{money((game.stash[product] ?? 0) * local.products[product].sell)} est.</small></button>)}</div></div>
      <div className="market-products">{PRODUCT_IDS.map(product => {
        const q = local.products[product];
        const trend = Math.round((q.sell / q.previousSell - 1) * 100);
        const canSell = Math.max(0, Math.min(9999, game.stash[product], q.buyers));
        const canBuy = Math.max(0, Math.min(9999, q.supply, Math.floor(game.cash / q.buy)));
        const bounded = (raw: string | undefined, cap: number, fallback: number) => cap === 0 ? "0" : raw === "" ? "" : String(Math.min(cap, Number(raw ?? fallback)));
        const sellText = bounded(sellQuantities[product], canSell, 10);
        const buyText = bounded(buyQuantities[product], canBuy, 1);
        const sellUnits = validTradeQuantity(sellText) ? Number(sellText) : 0;
        const buyUnits = validTradeQuantity(buyText) ? Number(buyText) : 0;
        return <article key={product} ref={node => { productRefs.current[product] = node; }} className="market-product">
          <div className="market-product-heading"><h3>{PRODUCTS[product].name}</h3><span className={trend > 0 ? "market-up" : trend < 0 ? "market-down" : ""}>{trend > 0 ? "▲ +" : trend < 0 ? "▼ " : "— "}{trend}%</span></div>
          <div className="market-price-grid"><div><span>SELL / UNIT</span><strong>{money(q.sell)}</strong></div><div><span>BUY / UNIT</span><strong>{money(q.buy)}</strong></div><div><span>DEMAND INDEX</span><strong>{q.demand}/100</strong></div></div>
          <div className="market-stock"><span>Buyers want {q.buyers}</span><span>Local stock {q.supply}</span><span>You hold {game.stash[product]}</span><span>Affordable: {canBuy} units ({money(canBuy * q.buy)})</span></div>
          <div className="market-trade-controls market-quantity-side"><label>Sell units<input aria-label={`${PRODUCTS[product].name} units`} type="number" min={canSell === 0 ? 0 : 1} max={canSell} step="1" disabled={canSell === 0} value={sellText} onChange={e => { const raw = e.target.value; if (/^\d{0,4}$/.test(raw)) setSellQuantities(v => ({ ...v, [product]: bounded(raw, canSell, 10) })); }} onBlur={() => setSellQuantities(v => ({ ...v, [product]: canSell === 0 ? "0" : String(Math.min(canSell, Number(normalizeTradeQuantity(sellText)))) }))} /></label><button type="button" disabled={canSell === 0} onClick={() => setSellQuantities(v => ({ ...v, [product]: String(canSell) }))}>Max sell</button></div>
          <div className="market-trade-buttons"><button type="button" className="market-sell" disabled={!present || busy || !sellUnits || sellUnits > canSell} onClick={() => setConfirmation({ region: selected.id, product, quantity: sellUnits, side: "sell", unitPrice: q.sell })}>Sell {sellUnits} · {money(sellUnits * q.sell)}</button></div>
          {canSell === 0 && <p className="market-help">{game.stash[product] === 0 ? "No units in your inventory." : "No remaining local buyers."}</p>}
          <div className="market-trade-controls market-quantity-side"><label>Buy units<input aria-label={`${PRODUCTS[product].name} buy units`} type="number" min={canBuy === 0 ? 0 : 1} max={canBuy} step="1" disabled={canBuy === 0} value={buyText} onChange={e => { const raw = e.target.value; if (/^\d{0,4}$/.test(raw)) setBuyQuantities(v => ({ ...v, [product]: bounded(raw, canBuy, 1) })); }} onBlur={() => setBuyQuantities(v => ({ ...v, [product]: canBuy === 0 ? "0" : String(Math.min(canBuy, Number(normalizeTradeQuantity(buyText)))) }))} /></label><button type="button" disabled={canBuy === 0} onClick={() => setBuyQuantities(v => ({ ...v, [product]: String(canBuy) }))}>Max buy · {canBuy} ({money(canBuy * q.buy)})</button></div>
          <div className="market-trade-buttons"><button type="button" disabled={!present || busy || !buyUnits || buyUnits > canBuy} onClick={() => setConfirmation({ region: selected.id, product, quantity: buyUnits, side: "buy", unitPrice: q.buy })}>Buy {buyUnits} · {money(buyUnits * q.buy)}</button></div>
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
