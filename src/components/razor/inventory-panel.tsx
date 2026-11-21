import { PRODUCT_IDS, PRODUCTS } from "@/game/content";
import { regionMarket } from "@/game/region-economy";
import { cityMapOf } from "@/game/city-map";
import { money } from "@/game/logic";
import type { GameState, ProductId } from "@/game/types";

export function inventoryRows(game: GameState) {
  const location = cityMapOf(game).locationId;
  const quote = regionMarket(game, location);
  return PRODUCT_IDS.map(product => {
    const units = game.stash[product] ?? 0;
    const price = quote.products[product].sell;
    const buyers = quote.products[product].buyers;
    return { product, units, price, buyers, potential: units * price, realizable: Math.min(units, buyers) * price };
  });
}

export function InventoryPanel({ game, close, openMarket }: { game: GameState; close: () => void; openMarket: (product: ProductId) => void }) {
  const rows = inventoryRows(game);
  const totalUnits = rows.reduce((n, r) => n + r.units, 0);
  const estimated = rows.reduce((n, r) => n + r.potential, 0);
  const realizable = rows.reduce((n, r) => n + r.realizable, 0);
  const location = game.districts.find(d => d.id === cityMapOf(game).locationId)?.name ?? "Current region";
  return <div className="inventory-backdrop" onClick={close}>
    <section role="dialog" aria-modal="true" aria-label="Your inventory" className="inventory-dialog" onClick={e => e.stopPropagation()}>
      <header className="inventory-header"><div><small>YOUR EMPIRE</small><h2>Inventory</h2></div><button type="button" aria-label="Close inventory" onClick={close}>✕</button></header>
      <div className="inventory-content">
        <div className="inventory-totals"><div><small>ON HAND</small><strong>{totalUnits.toLocaleString("en-US")} units</strong></div><div><small>ESTIMATED VALUE</small><strong>{money(estimated)}</strong></div></div>
        <p className="inventory-explain">Estimated using current sell prices in {location}. Actual proceeds depend on local demand and future prices. Cash on hand: {money(game.cash)}.</p>
        <div className="inventory-grid">{rows.map(r => <article key={r.product} className="inventory-item">
          <div className="inventory-item-top"><h3>{PRODUCTS[r.product].name}</h3><strong>{r.units.toLocaleString("en-US")} units</strong></div>
          <p>Sell price: <strong>{money(r.price)}/unit</strong></p>
          <p>Estimated value: <strong>{money(r.potential)}</strong></p>
          <p>Local buyers: {r.buyers} · Sellable now: {Math.min(r.units, r.buyers)}</p>
          <button type="button" onClick={() => openMarket(r.product)}>Trade {PRODUCTS[r.product].name}</button>
        </article>)}</div>
        <p className="inventory-explain">Up to {money(realizable)} can be sold here at current quotes and buyer limits. Other regions may offer different prices.</p>
      </div>
    </section>
  </div>;
}
