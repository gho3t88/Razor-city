import { useEffect, useState } from "react";
import { combatMultiplier, combatOf, levelOf, MAX_LEVEL, trainingCost, WEAPONS, weaponOf, xpForLevel, ambushOutlook, escapeChance } from "@/game/combat";
import { money } from "@/game/logic";
import { useRazor } from "@/game/store";
import { CREDIT_PACKS, creditWallet, listCreditPacks, purchaseCredits } from "@/lib/credits";
import { CharacterPortrait, ContactDialog } from "./contacts";
import type { GameState } from "@/game/types";

export function CombatCenter({ game, close }: { game: GameState; close: () => void }) {
  const [tab, setTab] = useState<"weapons" | "training" | "credits">("weapons");
  const [products, setProducts] = useState<{ id: string; price: string }[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [message, setMessage] = useState("");
  const buy = useRazor(s => s.buyWeapon); const equip = useRazor(s => s.equipWeapon); const train = useRazor(s => s.trainCombat);
  const refreshWallet = useRazor(s => s.refreshWallet); const balance = useRazor(s => s.premiumBalance); const billingBusy = useRazor(s => s.billingBusy); const toast = useRazor(s => s.toast);
  const c = combatOf(game), level = levelOf(game), cost = trainingCost(game);
  const busy = purchasing || billingBusy || !!game.cityMap?.order || !!c.ambush || game.phase !== "play";
  useEffect(() => { void refreshWallet(); creditWallet().then(w => setEnabled(w.enabled)).catch(() => {}); }, [refreshWallet]);
  useEffect(() => { if (tab !== "credits") return; listCreditPacks().then(r => setProducts(r.products)).catch(() => setMessage("Credit packs will appear here when available through Google Play.")); }, [tab]);
  async function purchase(id: string) {
    if (purchasing || !enabled) return;
    setPurchasing(true); setMessage("Opening Google Play checkout…");
    try {
      const result = await purchaseCredits(id);
      await refreshWallet();
      setMessage(result.status === "purchased" ? "Street Credits added to your wallet." : result.status === "pending" ? "Payment pending. Credits arrive after Google Play confirms it." : "Purchase cancelled. No credits added.");
    } catch { setMessage("Purchase could not be completed. No new credits granted. You can retry through Google Play."); }
    finally { setPurchasing(false); }
  }
  return <ContactDialog title="BLACK MARKET & TRAINING" close={purchasing || billingBusy ? undefined : close}>
    <div className="combat-profile"><div><p className="contact-kicker">COMBAT LEVEL</p><strong>{level}<small> / {MAX_LEVEL}</small></strong></div><div><b>{weaponOf(game).name}</b><p>+{Math.round((combatMultiplier(game) - 1) * 100)}% fight power</p><p>{c.wins} wins · {c.losses} defeats</p></div></div>
    <progress className="combat-xp" aria-label="Combat experience" value={level === MAX_LEVEL ? 1 : c.xp - xpForLevel(level)} max={level === MAX_LEVEL ? 1 : xpForLevel(level + 1) - xpForLevel(level)} />
    <p className="contact-fine">{level === MAX_LEVEL ? "Maximum level reached" : `${c.xp} / ${xpForLevel(level + 1)} total XP to level ${level + 1}`} · Fight to earn XP and Street Credits.</p>
    <div className="combat-tabs">{(["weapons", "training", "credits"] as const).map(t => <button type="button" key={t} aria-pressed={tab === t} disabled={purchasing || billingBusy} onClick={() => setTab(t)}>{t === "weapons" ? "Weapons" : t === "training" ? "Training" : "Credit shop"}</button>)}</div>
    {tab === "weapons" && <><p className="contact-muted">Buy loadouts with game cash. Higher combat levels unlock stronger tiers. Your equipped loadout boosts block fights and ambush combat.</p><div className="weapon-list">{WEAPONS.map(w => {
      const owned = c.owned.includes(w.id); const locked = level < w.level;
      return <article key={w.id} className={`weapon-card tier-${w.tier}`}><div className="weapon-topline"><span>TIER {w.tier}</span><strong>+{Math.round(w.bonus * 100)}% power</strong></div><h3>{w.name}</h3><p>{w.description}</p><div className="weapon-buy"><span>{w.price ? money(w.price) : "Starting gear"}<small>Level {w.level}{locked ? " required" : " unlocked"}</small></span><button type="button" disabled={busy || locked || c.equipped === w.id || (!owned && game.cash < w.price)} className={owned ? "" : "contact-primary"} onClick={() => owned ? equip(w.id) : buy(w.id)}>{c.equipped === w.id ? "Equipped" : locked ? `Level ${w.level}` : owned ? "Equip" : "Buy & equip"}</button></div></article>;
    })}</div></>}
    {tab === "training" && <div className="training-panel"><p className="contact-kicker">STREET CREDITS</p><div className="training-balances"><div><strong>{c.credits}</strong><span>Earned in fights</span></div><div><strong>{balance}</strong><span>Purchased wallet</span></div></div><h3>{level === MAX_LEVEL ? "You've reached the top" : `Train to level ${level + 1}`}</h3><p>Each level adds 4% fight power and can unlock new weapon tiers. Earned credits are spent first.</p><button type="button" className="contact-primary" disabled={busy || level >= MAX_LEVEL || c.credits + balance < cost} onClick={() => void train()}>{billingBusy ? "Saving training…" : level >= MAX_LEVEL ? "Maximum level" : `Level up · ${cost} Street Credits`}</button><p className="contact-fine">Training applies to this crew's current run. Purchased credits remain in your wallet between runs. You can reach every combat level by fighting without buying credits.</p><button type="button" className="combat-shop-link" onClick={() => setTab("credits")}>Visit credit shop</button></div>}
    {tab === "credits" && <><p className="contact-kicker">OPTIONAL STREET CREDIT PACKS</p><p className="contact-muted">Use Street Credits for instant combat training. You can also earn them by fighting. All purchase prices come from Google Play.</p><p className="credit-wallet-balance">Purchased balance: <strong>{balance}</strong></p>{!enabled && <div className="contact-empty">Real-money credit packs are not activated in this preview. Fight to earn credits and test the training system.</div>}{CREDIT_PACKS.map(pack => {
      const product = products.find(p => p.id === pack.id);
      return <div className="credit-pack" key={pack.id}><div><strong>{pack.credits}</strong><span>Street Credits</span></div><button type="button" disabled={busy || !enabled || !product} onClick={() => void purchase(pack.id)}>{product ? product.price : "Not available"}</button></div>;
    })}<button type="button" className="combat-shop-link" disabled={purchasing} onClick={() => void refreshWallet()}>Refresh wallet</button></>}
    {(message || toast) && <p className="combat-feedback" role="status">{message || toast}</p>}
  </ContactDialog>;
}

export function AmbushPopup({ game }: { game: GameState }) {
  const resolve = useRazor(s => s.resolveAmbush); const a = combatOf(game).ambush;
  if (!a || game.cityMap?.order?.kind === "ambush") return null;
  const location = game.districts.find(d => d.id === a.location)?.name;
  const chance = Math.round(escapeChance(game) * 100);
  return <ContactDialog title="AMBUSH ON THE STREET"><div className="incoming-person"><CharacterPortrait id="jax" large /><div><p className="contact-kicker">TRIP INTERRUPTED</p><h3>{a.attackers} attackers</h3><p>Near {location}</p></div></div><blockquote>Jax: “We've got trouble. Call it, boss—run, stand our ground, or hand it over?”</blockquote><div className="ambush-loadout">Level {levelOf(game)} · {weaponOf(game).name} · Fight outlook: <strong>{ambushOutlook(game)}</strong></div><div className="ambush-choices"><button type="button" onClick={() => resolve("run")}><strong>Run · {chance}% escape chance</strong><span>Return to your starting block. A failed escape costs some cash and unreserved stock.</span></button><button type="button" className="ambush-fight" onClick={() => resolve("fight")}><strong>Fight · {ambushOutlook(game)}</strong><span>Win for loot, XP and Street Credits, then continue traveling. Defeat can cost soldiers, cash and stock.</span></button><button type="button" onClick={() => resolve("surrender")}><strong>Surrender</strong><span>Give up 10% of cash (up to $5,000) and 25% of unreserved stock. No soldier losses; return to your starting block.</span></button></div><p className="contact-fine">Reserved bulk-order stock and purchased Street Credits are protected.</p></ContactDialog>;
}
