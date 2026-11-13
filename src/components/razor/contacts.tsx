import { useEffect, useRef, type ReactNode } from "react";
import { CHARACTERS, character, type CharacterId, type Deal } from "@/game/encounters";
import { PRODUCTS } from "@/game/content";
import { money } from "@/game/logic";
import { useRazor } from "@/game/store";
import type { GameState } from "@/game/types";

function ContactDialog({ title, children, close }: { title: string; children: ReactNode; close?: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => previous?.focus();
  }, []);
  return <div className="contact-backdrop"><section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="contact-dialog" onKeyDown={event => {
    if (event.key === "Escape" && close) close();
    if (event.key !== "Tab") return;
    const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]') ?? []);
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
  }}><header className="contact-title"><h2>{title}</h2>{close && <button type="button" aria-label="Close contacts" onClick={close}>✕</button>}</header><div className="contact-content">{children}</div></section></div>;
}
export function CharacterPortrait({ id, large = false }: { id: CharacterId; large?: boolean }) {
  const c = character(id);
  return <div role="img" aria-label={`${c.name}, ${c.role}`} className={`contact-portrait ${large ? "large" : ""}`} style={{ backgroundPosition: `${c.tile % 4 / 3 * 100}% ${Math.floor(c.tile / 4) * 100}%`, borderColor: c.color }} />;
}
function DealCard({ game, deal: d }: { game: GameState; deal: Deal }) {
  const decide = useRazor(s => s.decideDeal);
  const deliver = useRazor(s => s.deliverDeal);
  const active = d.status === "active";
  const available = Math.min(game.stash[d.product], d.quantity - d.delivered);
  const busy = !!game.cityMap?.order || game.phase !== "play";
  return <article className="deal-card">
    <div className="contact-person"><CharacterPortrait id={d.buyer} /><div><h3>{character(d.buyer).name}</h3><p>{PRODUCTS[d.product].name} · {d.quantity} units</p></div><span className={`deal-status ${d.status}`}>{d.status}</span></div>
    <div className="deal-value"><strong>{money(d.payment)}</strong><span>+ $10,000 completion bonus</span></div>
    <p className="deal-deadline">{active || d.status === "offered" ? `Due by end of week ${d.dueWeek} · ${d.dueWeek - game.week + 1} week${d.dueWeek === game.week ? "" : "s"} left` : d.status === "completed" ? "Paid in full, including bonus" : d.status === "expired" ? "Deadline missed · reserved stock returned" : "Offer declined · no penalty"}</p>
    {(active || d.status === "completed") && <><progress value={d.delivered} max={d.quantity} aria-label={`${d.delivered} of ${d.quantity} units reserved`} /><p className="contact-muted">{d.delivered}/{d.quantity} reserved · {game.stash[d.product]} in stash</p></>}
    {active && <><button type="button" className="contact-primary" disabled={busy || available <= 0} onClick={() => deliver(d.id)}>{available > 0 ? `${d.delivered + available === d.quantity ? "Complete order" : "Reserve stock"} · ${available} units` : "Buy or produce stock to deliver"}</button><p className="contact-fine">Reserved stock is protected from street sales. Payment arrives when the full order is filled. No move cost.</p></>}
    {d.status === "offered" && <div className="contact-buttons"><button type="button" className="contact-primary" disabled={busy} onClick={() => decide(d.id, true)}>Accept deal</button><button type="button" disabled={busy} onClick={() => decide(d.id, false)}>Decline</button></div>}
  </article>;
}
export function ContactsPanel({ game, close }: { game: GameState; close: () => void }) {
  const deals = game.encounters?.deals ?? [];
  const active = deals.filter(d => d.status === "active" || d.status === "offered");
  return <ContactDialog title="CONTACTS & DEALS" close={close}>
    <p className="contact-kicker">ACTIVE DEALS · {active.length}/3</p>
    <p className="contact-muted">Buyers call at random while you play. Every completed order earns an extra $10,000. Deadlines use game weeks, not real time.</p>
    {active.length ? active.map(d => <DealCard key={d.id} game={game} deal={d} />) : <div className="contact-empty">No active orders. Keep building your empire—your phone will ring.</div>}
    <h3 className="contact-kicker">THE NEIGHBORHOOD</h3>
    <div className="contact-roster">{CHARACTERS.map(c => <div key={c.id} className="contact-roster-card"><CharacterPortrait id={c.id} /><div><strong>{c.name}</strong><p>{c.role}</p></div></div>)}</div>
    {deals.some(d => d.status !== "active" && d.status !== "offered") && <details className="contact-history"><summary>Deal history · {game.encounters?.completed ?? 0} completed</summary>{[...deals].reverse().filter(d => d.status !== "active" && d.status !== "offered").slice(0, 8).map(d => <DealCard key={d.id} game={game} deal={d} />)}</details>}
  </ContactDialog>;
}
export function ContactPopup({ game }: { game: GameState }) {
  const reply = useRazor(s => s.replyToCrew);
  const pending = game.encounters?.pending;
  if (!pending || game.phase !== "play") return null;
  if (pending.kind === "buyer") {
    const deal = game.encounters?.deals.find(d => d.id === pending.dealId);
    if (!deal || deal.status !== "offered") return null;
    const c = character(deal.buyer);
    return <ContactDialog title="INCOMING CALL"><div className="incoming-person"><CharacterPortrait id={c.id} large /><div><p className="contact-kicker">BULK BUYER</p><h3>{c.name}</h3><p>{c.role}</p></div></div><blockquote>“{c.line}”</blockquote><DealCard game={game} deal={deal} /><p className="contact-fine">No deposit or penalty for declining. Accepted orders are tracked in Contacts & Deals.</p></ContactDialog>;
  }
  const talk = pending.talk;
  return <ContactDialog title="CREW CONVERSATION"><p className="contact-kicker">WEEK {game.week} · INSIDE YOUR CREW</p><h3 className="talk-heading">{talk.title}</h3><div className="talk-lines">{talk.lines.map((line, i) => <div key={i} className="talk-line"><CharacterPortrait id={line.speaker} /><div><strong style={{ color: character(line.speaker).color }}>{character(line.speaker).name}</strong><p>{line.text}</p></div></div>)}</div><div className="talk-choices">{talk.choices.map(choice => <button type="button" key={choice.id} disabled={game.cash < choice.cash} onClick={() => reply(choice.id)}><strong>{choice.label}</strong><span>{choice.detail}</span></button>)}</div></ContactDialog>;
}
