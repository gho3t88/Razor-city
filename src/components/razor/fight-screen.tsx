import { useEffect, useState } from "react";
import { useRazor } from "@/game/store";
import { ContactDialog, CharacterPortrait } from "./contacts";
import { empireOf, RECRUITS, crewLevel } from "@/game/empire";
import { money } from "@/game/logic";
import type { GameState } from "@/game/types";

export function FightScreen({ game }: { game: GameState }) {
  const scene = game.fightScene;
  const dismiss = useRazor(s => s.dismissFight);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!scene || scene.status !== "active") return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [scene?.id, scene?.status]);
  if (!scene || scene.dismissed) return null;

  const active = scene.status === "active";
  const approaching = active && now < scene.startedAt;
  const progress = active ? Math.max(0, Math.min(100, (now - scene.startedAt) / Math.max(1, scene.endsAt - scene.startedAt) * 100)) : 100;
  const region = game.districts.find(d => d.id === scene.region)?.name ?? scene.region;
  const report = scene.afterAction;

  return <ContactDialog title={active ? "STREET BATTLE" : "AFTER-ACTION REPORT"} close={dismiss}>
    <p className="contact-kicker">{scene.kind === "ambush" ? "AMBUSH" : scene.kind === "retaliation" ? "COUNTERATTACK" : "BLOCK CAPTURE"} · {region.toUpperCase()}</p>
    <h3 className="battle-headline">{active ? (approaching ? "Moving into position" : "Shots exchanged") : scene.status === "won" ? "Your crew won" : "Your crew pulled back"}</h3>
    <div className={`battle-stage ${active && !approaching ? "is-fighting" : ""}`} aria-label={active ? "Animated street battle" : "Street battle result"}>
      <div className="battle-road"/>
      <span className="battle-building b-one"/><span className="battle-building b-two"/><span className="battle-building b-three"/><span className="battle-building b-four"/>
      <div className="battle-team friendly">{Array.from({ length: Math.max(1, Math.min(6, scene.allies)) }, (_, i) => <span key={i} className={`battle-figure fighter-${i}`}><i/><b/></span>)}</div>
      <div className="battle-team enemy">{Array.from({ length: Math.max(2, Math.min(6, Math.ceil(scene.enemyPower / 6))) }, (_, i) => <span key={i} className={`battle-figure fighter-${i}`}><i/><b/></span>)}</div>
      <div className="battle-tracers"><i/><i/><i/></div>
      <span className="battle-side-label left">YOUR CREW</span><span className="battle-side-label right">{scene.enemy.toUpperCase()}</span>
    </div>
    <div className="battle-power">
      <div><span>YOUR POWER</span><strong>{Math.round(scene.playerPower)}</strong><small>{scene.allies} crew · Level {scene.level}</small></div>
      <b>VS</b>
      <div><span>ENEMY POWER</span><strong>{Math.round(scene.enemyPower)}</strong><small>{scene.enemy}</small></div>
    </div>
    <p className="battle-loadout">Equipped: <strong>{scene.weapon}</strong></p>
    <div className="battle-named-crew">{empireOf(game).crew.map(c => <span key={c.id}><CharacterPortrait id={c.id}/><small>{RECRUITS.find(r => r.id === c.id)!.name} · L{crewLevel(c)}</small></span>)}</div>
    {active ? <>
      <progress className="combat-xp" aria-label="Fight progress" value={progress} max="100"/>
      <p className="contact-fine">{approaching ? "The crew is approaching. The fight starts on arrival." : "Combat is resolving with your soldiers, loadout and specialist bonuses."} Closing this screen keeps the order running.</p>
    </> : <div className={`battle-result ${scene.status}`}>
      <strong>{scene.status === "won" ? "VICTORY" : "DEFEAT"}</strong>
      <p>{scene.summary}</p>
      {report ? <>
        <h4 className="contact-kicker">AFTER-ACTION REPORT</h4>
        <div className="aar-grid" aria-label="Battle casualties">
          <div><span>Deployed</span><strong>{report.deployed}</strong></div>
          <div><span>Survived</span><strong>{report.survivors}</strong></div>
          <div className="aar-danger"><span>Killed</span><strong>{report.killed}</strong></div>
          <div className="aar-warning"><span>Wounded</span><strong>{report.wounded}</strong></div>
        </div>
        <p className="aar-territory"><strong>Territory:</strong> {report.territory}</p>
        <div className="aar-rewards"><span>+{report.xpEarned} XP</span><span>+{report.creditsEarned} Street Credits</span><span>{report.cashChange > 0 ? "+" : ""}{money(report.cashChange)} cash</span></div>
        {report.wounded > 0 && <p className="aar-medical-note">Wounded soldiers cannot fight. Open Gear → Soldiers to pay for treatment by the end of next week, or they will die.</p>}
      </> : <p className="contact-fine">Your battle result and rewards are recorded in the ledger.</p>}
    </div>}
    <button type="button" className="contact-primary" onClick={dismiss}>Back to city</button>
  </ContactDialog>;
}
