import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  Coins,
  Flame,
  Minus,
  Plus,
  Shield,
  Store,
  Swords,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { resumeAudio } from "@/game/audio";
import { showInterstitial, showRewarded } from "@/lib/ads";
import { TipSupport } from "./tip-support";
import { GANG_IDS, PRODUCTS } from "@/game/content";
import {
  adjacentToPlayer,
  aliveGangs,
  bribe,
  bribeCost,
  buy,
  cook,
  fortify,
  fortifyCost,
  freeDealers,
  freeMuscle,
  heatWord,
  hit,
  hitOutlook,
  isGangId,
  layLow,
  money,
  moveIn,
  moveInCost,
  neighborsOf,
  netWorth,
  previewSales,
  recruit,
  relationWord,
  setFocus,
  setStation,
  shake,
  truce,
  truceCost,
  wealthWord,
  WIN_BLOCKS,
  WIN_RESPECT,
  WIN_WORTH,
} from "@/game/logic";
import { useRazor } from "@/game/store";
import type { District, GangId, GameState, Owner, ProductId, Tone } from "@/game/types";

const btn = "min-h-11 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-40";
const btnGold = `${btn} bg-gold text-ink`;
const btnGhost = `${btn} border border-line bg-panel-2 text-paper`;
const btnDanger = `${btn} border border-blood bg-panel text-blood`;

function toneClass(tone: Tone): string {
  if (tone === "gold") return "text-gold";
  if (tone === "blood") return "text-blood";
  if (tone === "mute") return "text-mute";
  return "text-paper";
}

function ownerWord(state: GameState, owner: Owner): string {
  if (owner === "player") return "Yours";
  if (owner === "neutral") return "Open";
  return state.gangs[owner].tag;
}

function markClass(owner: Owner): string {
  return `mark-${owner}`;
}

function tileClass(owner: Owner): string {
  return `tile-${owner}`;
}

function tense(state: GameState, d: District): boolean {
  if (d.owner === "player") {
    return neighborsOf(state, d.id).some((n) => isGangId(n.owner) && state.gangs[n.owner].alive && state.gangs[n.owner].relation < -20 && state.gangs[n.owner].truceWeeks === 0);
  }
  if (isGangId(d.owner) && state.gangs[d.owner].relation < -20 && state.gangs[d.owner].truceWeeks === 0) {
    return neighborsOf(state, d.id).some((n) => n.owner === "player");
  }
  return false;
}

export function RazorApp() {
  const boot = useRazor((s) => s.boot);
  const screen = useRazor((s) => s.screen);

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") resumeAudio();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return screen === "game" ? <PlayScreen /> : <StartScreen />;
}

function StartScreen() {
  const startNew = useRazor((s) => s.startNew);
  const continueGame = useRazor((s) => s.continueGame);
  const hasSave = useRazor((s) => s.hasSave);
  const saveMeta = useRazor((s) => s.saveMeta);
  const legacy = useRazor((s) => s.legacy);
  const [boss, setBoss] = useState("Reyes");
  const [crew, setCrew] = useState("Hollow Kings");
  const [difficulty, setDifficulty] = useState<"street" | "war">("street");
  const [art, setArt] = useState(true);

  return (
    <main className="relative min-h-dvh bg-ink">
      {art ? (
        <img
          src="/art/hero.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setArt(false)}
        />
      ) : null}
      <div className="absolute inset-0 bg-ink/80" />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col justify-end gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:py-10">
        <div className="max-w-xl">
          <p className="text-xs font-medium tracking-widest text-gold">DRUG EMPIRE SIMULATION</p>
          <h1 className="mt-2 font-display text-6xl leading-none text-paper sm:text-8xl">
            RAZOR
            <span className="block">CITY</span>
          </h1>
          <p className="mt-3 max-w-md text-base text-paper">
            A fictional port. Four crews. Your lab on the docks. Take blocks before the city takes you.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-mute">
            <li>Stock product and station dealers. Corners pay when you close the week.</li>
            <li>Three moves a week. Spend them to expand, hire, bribe, or hit a rival.</li>
            <li>Heat brings raids. Three raids end you. Eight blocks crown the city.</li>
          </ul>
          {legacy.runs > 0 ? (
            <p className="mt-4 text-sm text-gold">
              Legacy: {legacy.wins} crown{legacy.wins === 1 ? "" : "s"}
              {legacy.bestWeek != null ? ` · fastest week ${legacy.bestWeek}` : ""} · best book {money(legacy.bestWorth)}
            </p>
          ) : null}
        </div>
        <form
          className="w-full max-w-md rounded-xl border border-line bg-panel/95 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            startNew({ boss, crew, difficulty });
          }}
        >
          <div className="mb-4 flex items-center gap-3">
            <img src="/art/reyes.jpg" alt="" className="size-14 rounded-md object-cover" />
            <div>
              <p className="font-display text-xl tracking-wide text-paper">OPEN THE BOOKS</p>
              <p className="text-sm text-mute">Name the boss. Name the crew.</p>
            </div>
          </div>
          <label className="mb-3 block text-sm text-mute">
            Your name
            <input
              value={boss}
              maxLength={18}
              autoComplete="off"
              onChange={(e) => setBoss(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-md border border-line bg-ink px-3 text-paper outline-none focus-visible:border-gold"
            />
          </label>
          <label className="mb-3 block text-sm text-mute">
            Crew name
            <input
              value={crew}
              maxLength={22}
              autoComplete="off"
              onChange={(e) => setCrew(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-md border border-line bg-ink px-3 text-paper outline-none focus-visible:border-gold"
            />
          </label>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={difficulty === "street"}
              onClick={() => setDifficulty("street")}
              className={difficulty === "street" ? btnGold : btnGhost}
            >
              Street
              <span className="mt-0.5 block text-xs font-normal opacity-80">Fair heat, room to learn</span>
            </button>
            <button
              type="button"
              aria-pressed={difficulty === "war"}
              onClick={() => setDifficulty("war")}
              className={difficulty === "war" ? btnGold : btnGhost}
            >
              War
              <span className="mt-0.5 block text-xs font-normal opacity-80">Hungrier gangs, hotter cops</span>
            </button>
          </div>
          <button type="submit" className={`${btnGold} w-full font-display text-lg tracking-wide`}>
            Take the docks
          </button>
          {hasSave && saveMeta ? (
            <button type="button" onClick={continueGame} className={`${btnGhost} mt-2 w-full`}>
              Continue {saveMeta.crew} · week {saveMeta.week} · {money(saveMeta.cash)}
              {saveMeta.phase === "won" ? " · crowned" : saveMeta.phase === "lost" ? " · finished" : ""}
            </button>
          ) : null}
          <div className="mt-3 text-center"><TipSupport /></div>
        </form>
      </div>
    </main>
  );
}

function PlayScreen() {
  const game = useRazor((s) => s.game);
  const modal = useRazor((s) => s.modal);
  const toast = useRazor((s) => s.toast);
  const pulse = useRazor((s) => s.pulse);
  const muted = useRazor((s) => s.muted);
  const select = useRazor((s) => s.select);
  const setModal = useRazor((s) => s.setModal);
  const toggleMute = useRazor((s) => s.toggleMute);
  const clearToast = useRazor((s) => s.clearToast);
  const closeWeek = useRazor((s) => s.closeWeek);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(clearToast, 2400);
    return () => window.clearTimeout(t);
  }, [toast, clearToast]);

  useEffect(() => {
    if (pulse === 0) return;
    setShaking(true);
    const t = window.setTimeout(() => setShaking(false), 320);
    return () => window.clearTimeout(t);
  }, [pulse]);

  if (!game) return null;
  const selected = game.districts.find((d) => d.id === game.selectedId) ?? game.districts[0];
  const preview = previewSales(game);
  const playing = game.phase === "play";

  return (
    <main className={`min-h-dvh bg-ink ${shaking ? "shake" : ""}`}>
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-3 px-3 py-3">
          <div>
            <p className="font-display text-2xl leading-none tracking-wide text-gold">RAZOR CITY</p>
            <p className="mt-1 text-sm text-paper">
              {game.crew} · {game.boss}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="text-right">
              <p className="font-display text-2xl leading-none">WK {String(game.week).padStart(2, "0")}</p>
              <p className="text-xs tracking-widest text-mute">{game.difficulty === "war" ? "WAR" : "STREET"}</p>
            </div>
            <TipSupport />
            <button type="button" aria-label={muted ? "Unmute" : "Mute"} onClick={toggleMute} className={`${btnGhost} px-3`}>
              {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
          </div>
        </div>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2 px-3 pb-3 sm:grid-cols-4">
          <Stat icon={<Coins className="size-4 text-gold" />} label="Cash" value={money(game.cash)} />
          <div className="rounded-md border border-line bg-ink px-3 py-2">
            <div className="flex items-center justify-between text-xs text-mute">
              <span className="inline-flex items-center gap-1">
                <Flame className={`size-4 ${game.heat >= 60 ? "text-blood heat-hot" : "text-gold"}`} /> Heat
              </span>
              <span className="text-paper">{Math.round(game.heat)}</span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-panel-2"
              role="meter"
              aria-label="Police heat"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(game.heat)}
            >
              <div
                className={`h-full ${game.heat >= 60 ? "bg-blood" : "bg-gold"}`}
                style={{ width: `${Math.max(0, Math.min(100, game.heat))}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-mute">
              Strikes {game.strikes}/3
              {game.heat >= 48 ? " · cool it or the raid comes" : ""}
            </p>
          </div>
          <Stat icon={<Shield className="size-4 text-paper" />} label="Respect" value={String(game.respect)} />
          <div className="rounded-md border border-line bg-ink px-3 py-2">
            <p className="text-xs text-mute">Moves</p>
            <p className="font-display text-xl leading-none text-paper">
              {game.ap}
              <span className="text-mute">/{game.maxAp}</span>
            </p>
            <p className="mt-1 text-xs text-mute">
              {game.crewCounts.muscle} muscle · {game.crewCounts.dealers} dealers
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-3 px-3 py-3 pb-24 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <div className="mb-2 flex flex-wrap gap-2 text-xs text-mute">
            <Legend owner="player" label="You" />
            <Legend owner="neutral" label="Open" />
            <Legend owner="vultures" label="Vultures" />
            <Legend owner="lanterns" label="Lanterns" />
            <Legend owner="saints" label="Saints" />
            <Legend owner="cobras" label="Cobras" />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {game.districts.map((d) => {
              const on = d.id === selected?.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => select(d.id)}
                  className={`min-h-20 rounded-md border bg-panel px-1.5 py-2 text-left ${tileClass(d.owner)} ${on ? "tile-on border-gold" : "border-line"}`}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span className={`h-1.5 w-6 rounded-full ${markClass(d.owner)}`} />
                    {tense(game, d) ? <Swords className="size-3 text-blood" aria-label="Border tension" /> : null}
                  </span>
                  <span className="mt-1 block truncate font-display text-xs tracking-wide text-paper">{d.short}</span>
                  <span className="block truncate text-xs text-mute">{ownerWord(game, d.owner)}</span>
                  {d.owner === "player" ? (
                    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-panel-2">
                      <span className="block h-full bg-gold" style={{ width: `${d.loyalty}%` }} />
                    </span>
                  ) : (
                    <span className="mt-1 block text-xs text-mute">DEF {d.defense}</span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-mute">
            If the week closed now: {money(preview.cash)} across {preview.lines.length} block
            {preview.lines.length === 1 ? "" : "s"}, about +{Math.round(preview.heat)} heat.
          </p>
          <div className="mt-2 space-y-1">
            {game.log.slice(0, 3).map((line) => (
              <p key={line.id} className={`text-sm ${toneClass(line.tone)}`}>
                {line.text}
              </p>
            ))}
          </div>
          {toast ? (
            <p role="status" className="mt-2 text-sm text-blood">
              {toast}
            </p>
          ) : (
            <p className="mt-2 min-h-5 text-sm text-mute"> </p>
          )}
        </section>

        <section className="lg:col-span-2">
          {selected ? <Inspector game={game} district={selected} preview={preview} playing={playing} /> : null}
        </section>
      </div>

      {playing ? (
        <div className="sticky bottom-0 border-t border-line bg-panel">
          <div className="mx-auto flex max-w-6xl gap-2 px-3 py-2">
            <button type="button" className={`${btnGhost} inline-flex flex-1 items-center justify-center gap-2`} onClick={() => setModal("market")}>
              <Store className="size-4" /> Market
            </button>
            <button type="button" className={`${btnGhost} inline-flex flex-1 items-center justify-center gap-2`} onClick={() => setModal("ledger")}>
              <BookOpen className="size-4" /> Ledger
            </button>
            <button type="button" className={`${btnGold} flex-[1.4] font-display text-base tracking-wide`} onClick={closeWeek}>
              Close week
            </button>
          </div>
        </div>
      ) : (
        <div className="sticky bottom-0 border-t border-line bg-panel">
          <div className="mx-auto flex max-w-6xl px-3 py-2">
            <button type="button" className={`${btnGhost} inline-flex w-full items-center justify-center gap-2`} onClick={() => setModal("ledger")}>
              <BookOpen className="size-4" /> Ledger
            </button>
          </div>
        </div>
      )}

      {modal === "market" && playing ? <MarketSheet game={game} /> : null}
      {modal === "ledger" ? <LedgerSheet game={game} /> : null}
      {game.phase === "event" && game.pending ? <EventSheet /> : null}
      {game.phase === "summary" && game.report ? <SummarySheet /> : null}
      {game.phase === "won" || game.phase === "lost" ? <EndingSheet /> : null}
    </main>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-ink px-3 py-2">
      <p className="flex items-center gap-1 text-xs text-mute">
        {icon}
        {label}
      </p>
      <p className="font-display text-xl leading-none text-paper">{value}</p>
    </div>
  );
}

function Legend({ owner, label }: { owner: Owner; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-2 w-4 rounded-full ${markClass(owner)}`} />
      {label}
    </span>
  );
}

function Inspector({
  game,
  district,
  preview,
  playing,
}: {
  game: GameState;
  district: District;
  preview: ReturnType<typeof previewSales>;
  playing: boolean;
}) {
  const commit = useRazor((s) => s.commit);
  const [armed, setArmed] = useState<string | null>(null);
  const [send, setSend] = useState(4);
  const quote = preview.lines.find((l) => l.districtId === district.id);
  const freeM = freeMuscle(game);
  const freeD = freeDealers(game);
  const adj = adjacentToPlayer(game, district.id);
  const fortCost = fortifyCost(district.corners);
  const gang = isGangId(district.owner) ? game.gangs[district.owner] : null;

  useEffect(() => {
    setArmed(null);
    setSend(Math.max(1, Math.min(4, freeM || 1)));
  }, [district.id, freeM]);

  const noMove = !playing ? "The week is closed." : game.ap < 1 ? "No moves left." : null;

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-widest text-mute">{ownerWord(game, district.owner).toUpperCase()}</p>
          <h2 className="font-display text-3xl leading-none text-paper">{district.name}</h2>
        </div>
        {gang ? <Portrait src={gang.portrait} alt="" /> : district.owner === "player" ? <Portrait src="/art/reyes.jpg" alt="" /> : null}
      </div>
      <p className="mt-2 text-sm text-mute">{district.blurb}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-mute">Purse</dt>
          <dd className="text-paper">{wealthWord(district.wealth)}</dd>
        </div>
        <div>
          <dt className="text-xs text-mute">Cops</dt>
          <dd className="text-paper">{heatWord(district.heatMod)}</dd>
        </div>
        <div>
          <dt className="text-xs text-mute">Defense</dt>
          <dd className="text-paper">{district.defense}</dd>
        </div>
      </dl>
      <div className="mt-3 space-y-1.5">
        {(Object.keys(PRODUCTS) as ProductId[]).map((id) => (
          <div key={id} className="grid grid-cols-5 items-center gap-2 text-xs">
            <span className="col-span-2 text-mute">{PRODUCTS[id].name}</span>
            <span className="col-span-3 h-1.5 overflow-hidden rounded-full bg-ink">
              <span className="block h-full bg-gold" style={{ width: `${district.demand[id]}%` }} />
            </span>
          </div>
        ))}
      </div>

      {district.owner === "player" ? (
        <div className="mt-4 space-y-3 border-t border-line pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-mute">Loyalty</span>
            <span className="text-paper">{district.loyalty}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink">
            <div className="h-full bg-gold" style={{ width: `${district.loyalty}%` }} />
          </div>
          <p className="text-sm text-mute">
            Corners {district.corners}/3
            {district.lab ? " · lab on site" : ""}
            {quote
              ? ` · about ${quote.units} ${PRODUCTS[quote.product].name} for ${money(quote.cash)}`
              : " · this block will not sell"}
          </p>
          <Stepper
            label={`Muscle here · ${freeM} free`}
            value={district.stationMuscle}
            disableMinus={!playing || district.stationMuscle <= 0}
            disablePlus={!playing || freeM <= 0}
            onMinus={() => commit(setStation(game, district.id, "muscle", district.stationMuscle - 1))}
            onPlus={() => commit(setStation(game, district.id, "muscle", district.stationMuscle + 1))}
          />
          <Stepper
            label={`Dealers here · ${freeD} free`}
            value={district.stationDealers}
            disableMinus={!playing || district.stationDealers <= 0}
            disablePlus={!playing || freeD <= 0}
            onMinus={() => commit(setStation(game, district.id, "dealers", district.stationDealers - 1))}
            onPlus={() => commit(setStation(game, district.id, "dealers", district.stationDealers + 1))}
          />
          <div>
            <p className="mb-1 text-xs text-mute">Push</p>
            <div className="flex flex-wrap gap-1">
              <FocusChip
                on={district.focus === "auto"}
                label="Auto"
                disabled={!playing}
                onClick={() => commit(setFocus(game, district.id, "auto"))}
              />
              {(Object.keys(PRODUCTS) as ProductId[]).map((id) => (
                <FocusChip
                  key={id}
                  on={district.focus === id}
                  label={PRODUCTS[id].name.split(" ")[0] ?? id}
                  disabled={!playing}
                  onClick={() => commit(setFocus(game, district.id, id))}
                />
              ))}
            </div>
          </div>
          <Action
            label={fortCost == null ? "Corner is maxed" : armed === "fort" ? `Confirm fortify · ${money(fortCost)}` : `Fortify corner · ${money(fortCost)}`}
            detail="One move. Raises what this block can sell."
            disabled={!!noMove || fortCost == null}
            kind="ghost"
            onClick={() => {
              if (armed !== "fort") {
                setArmed("fort");
                return;
              }
              setArmed(null);
              commit(fortify(game, district.id));
            }}
          />
          {district.lab ? (
            <div className="grid grid-cols-2 gap-2">
              <Action
                label="Cook Dust · $560"
                detail="14 units, one move."
                disabled={!!noMove}
                kind="ghost"
                onClick={() => commit(cook(game, district.id, "dust"))}
              />
              <Action
                label="Cook Grow · $392"
                detail="14 units, one move."
                disabled={!!noMove}
                kind="ghost"
                onClick={() => commit(cook(game, district.id, "grow"))}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {district.owner === "neutral" ? (
        <div className="mt-4 space-y-2 border-t border-line pt-3">
          <Action
            label={armed === "move" ? `Confirm quiet take · ${money(moveInCost(district))}` : `Move in quiet · ${money(moveInCost(district))}`}
            detail={adj ? "Needs 2 free muscle and a free dealer." : "Border it with one of your blocks first."}
            disabled={!!noMove || !adj}
            kind="gold"
            onClick={() => {
              if (armed !== "move") {
                setArmed("move");
                return;
              }
              setArmed(null);
              commit(moveIn(game, district.id));
            }}
          />
          <Action
            label={armed === "shake" ? "Confirm the shake · $500" : "Shake the block · $500"}
            detail="Cheaper, louder, easier to fail."
            disabled={!!noMove || !adj}
            kind="danger"
            onClick={() => {
              if (armed !== "shake") {
                setArmed("shake");
                return;
              }
              setArmed(null);
              commit(shake(game, district.id));
            }}
          />
        </div>
      ) : null}

      {gang ? (
        <div className="mt-4 space-y-2 border-t border-line pt-3">
          <p className="text-sm text-paper">
            {gang.name} · {gang.boss}
          </p>
          <p className="text-sm text-mute">
            {relationWord(gang.relation, gang.truceWeeks)} · {gang.muscle} muscle
            {gang.truceWeeks > 0 ? ` · truce ${gang.truceWeeks}w` : ""}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-mute">Send</span>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-md border border-line"
              onClick={() => setSend((n) => Math.max(1, n - 1))}
              aria-label="Fewer soldiers"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-6 text-center font-display text-xl">{Math.min(send, Math.max(1, freeM))}</span>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-md border border-line"
              onClick={() => setSend((n) => Math.min(freeM, n + 1))}
              aria-label="More soldiers"
            >
              <Plus className="size-4" />
            </button>
            <span className="text-sm text-mute">{hitOutlook(game, district.id, Math.min(send, Math.max(1, freeM)))}</span>
          </div>
          <Action
            label={armed === "hit" ? "Confirm the hit" : "Hit the block"}
            detail={adj ? "One move. Free muscle only. Losses are real." : "You need a bordering block."}
            disabled={!!noMove || !adj || freeM < 1}
            kind="danger"
            onClick={() => {
              if (armed !== "hit") {
                setArmed("hit");
                return;
              }
              setArmed(null);
              commit(hit(game, district.id, Math.min(send, freeM)));
            }}
          />
          <Action
            label={`Buy a truce · ${money(truceCost(gang))}`}
            detail="Four quieter weeks. Costs a move and a little respect."
            disabled={!!noMove || !gang.alive}
            kind="ghost"
            onClick={() => commit(truce(game, gang.id))}
          />
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3">
        <Action label="Hire muscle · $700" detail={`${freeM} free of ${game.crewCounts.muscle}`} disabled={!!noMove} kind="ghost" onClick={() => commit(recruit(game, "muscle"))} />
        <Action label="Hire dealer · $1,500" detail={`${freeD} free of ${game.crewCounts.dealers}`} disabled={!!noMove} kind="ghost" onClick={() => commit(recruit(game, "dealers"))} />
        <Action label="Lay low" detail="Drop heat. Lose a scrap of respect." disabled={!!noMove || game.heat < 8} kind="ghost" onClick={() => commit(layLow(game))} />
        <Action label={`Bribe · ${money(bribeCost(game))}`} detail="A sergeant looks away." disabled={!!noMove} kind="ghost" onClick={() => commit(bribe(game))} />
      </div>
      {noMove ? <p className="mt-2 text-sm text-mute">{noMove}</p> : null}
    </div>
  );
}

function Action({
  label,
  detail,
  disabled,
  kind,
  onClick,
}: {
  label: string;
  detail: string;
  disabled: boolean;
  kind: "gold" | "ghost" | "danger";
  onClick: () => void;
}) {
  const cls = kind === "gold" ? btnGold : kind === "danger" ? btnDanger : btnGhost;
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`${cls} w-full text-left`}>
      <span className="block">{label}</span>
      <span className="mt-0.5 block text-xs font-normal opacity-80">{detail}</span>
    </button>
  );
}

function Stepper({
  label,
  value,
  disableMinus,
  disablePlus,
  onMinus,
  onPlus,
}: {
  label: string;
  value: number;
  disableMinus: boolean;
  disablePlus: boolean;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-mute">{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" aria-label={`Less ${label}`} disabled={disableMinus} onClick={onMinus} className="inline-flex size-11 items-center justify-center rounded-md border border-line disabled:opacity-40">
          <Minus className="size-4" />
        </button>
        <span className="w-6 text-center font-display text-xl">{value}</span>
        <button type="button" aria-label={`More ${label}`} disabled={disablePlus} onClick={onPlus} className="inline-flex size-11 items-center justify-center rounded-md border border-line disabled:opacity-40">
          <Plus className="size-4" />
        </button>
      </span>
    </div>
  );
}

function FocusChip({ on, label, disabled, onClick }: { on: boolean; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-11 rounded-md border px-3 text-sm disabled:opacity-40 ${on ? "border-gold text-gold" : "border-line text-mute"}`}
    >
      {label}
    </button>
  );
}

function Portrait({ src, alt }: { src: string; alt: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return <div className="size-14 shrink-0 rounded-md bg-panel-2" />;
  return <img src={src} alt={alt} className="size-14 shrink-0 rounded-md object-cover" onError={() => setOk(false)} />;
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/80 p-3 sm:items-center">
      <article className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-xl border border-line bg-panel">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="font-display text-2xl tracking-wide">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-md border border-line">
            <X className="size-4" />
          </button>
        </header>
        <div className="overflow-y-auto p-4">{children}</div>
      </article>
    </div>
  );
}

function MarketSheet({ game }: { game: GameState }) {
  const commit = useRazor((s) => s.commit);
  const setModal = useRazor((s) => s.setModal);
  const grantAdReward = useRazor((s) => s.grantAdReward);
  const [adBusy, setAdBusy] = useState(false);
  const claimSponsorBonus = async () => {
    if (adBusy) return;
    setAdBusy(true);
    const earned = await showRewarded();
    if (earned) grantAdReward();
    setAdBusy(false);
  };
  return (
    <Sheet title="WHOLESALE" onClose={() => setModal("none")}>
      <p className="mb-3 text-sm text-mute">Buying is free of moves. Prices drift every week. You hold the stash, corners spend it.</p>
      <button type="button" disabled={adBusy} className={`${btnGold} mb-3 w-full`} onClick={claimSponsorBonus}>
        {adBusy ? "Loading sponsor…" : "Watch ad · get $1,000 bonus"}
      </button>
      <ul className="space-y-3">
        {(Object.keys(PRODUCTS) as ProductId[]).map((id) => {
          const p = PRODUCTS[id];
          const price = game.prices[id].wholesale;
          const afford = Math.floor(game.cash / price);
          return (
            <li key={id} className="rounded-md border border-line bg-ink p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-display text-xl">{p.name}</p>
                <p className="text-gold">{money(price)}</p>
              </div>
              <p className="text-sm text-mute">{p.blurb}</p>
              <p className="mt-1 text-sm text-paper">
                Street {money(game.prices[id].street)} · you hold {game.stash[id]}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button type="button" className={btnGhost} disabled={afford < 5} onClick={() => commit(buy(game, id, 5))}>
                  Buy 5
                </button>
                <button type="button" className={btnGhost} disabled={afford < 10} onClick={() => commit(buy(game, id, 10))}>
                  Buy 10
                </button>
                <button type="button" className={btnGold} disabled={afford < 1} onClick={() => commit(buy(game, id, Math.min(40, afford)))}>
                  Fill
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

function LedgerSheet({ game }: { game: GameState }) {
  const setModal = useRazor((s) => s.setModal);
  const abandon = useRazor((s) => s.abandon);
  const blocks = game.districts.filter((d) => d.owner === "player").length;
  const worth = netWorth(game);
  return (
    <Sheet title="LEDGER" onClose={() => setModal("none")}>
      <div className="mb-4 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-md bg-ink p-2">
          <p className="text-xs text-mute">Blocks</p>
          <p className="font-display text-xl">{blocks}/{WIN_BLOCKS}</p>
        </div>
        <div className="rounded-md bg-ink p-2">
          <p className="text-xs text-mute">Book</p>
          <p className="font-display text-xl">{money(worth)}</p>
        </div>
        <div className="rounded-md bg-ink p-2">
          <p className="text-xs text-mute">Respect</p>
          <p className="font-display text-xl">{game.respect}/{WIN_RESPECT}</p>
        </div>
      </div>
      <p className="mb-4 text-sm text-mute">
        Crown the city with {WIN_BLOCKS} blocks, a book of {money(WIN_WORTH)} at {WIN_RESPECT} respect, or by ending every rival crew. Three raids bury you.
      </p>
      <ul className="space-y-3">
        {GANG_IDS.map((id: GangId) => {
          const g = game.gangs[id];
          const held = game.districts.filter((d) => d.owner === id).length;
          return (
            <li key={id} className="flex gap-3 rounded-md border border-line p-2">
              <Portrait src={g.portrait} alt="" />
              <div className="min-w-0">
                <p className="font-display text-lg leading-none">
                  {g.name}
                  {!g.alive ? " · gone" : ""}
                </p>
                <p className="text-sm text-mute">{g.boss}</p>
                <p className="text-sm text-paper">
                  {relationWord(g.relation, g.truceWeeks)} · {g.muscle} muscle · {held} block{held === 1 ? "" : "s"}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <h3 className="mt-4 font-display text-lg tracking-wide">The tape</h3>
      <ul className="mt-2 space-y-1">
        {game.log.slice(0, 18).map((line) => (
          <li key={line.id} className={`text-sm ${toneClass(line.tone)}`}>
            <span className="text-mute">W{line.week} </span>
            {line.text}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-mute">
        Earned {money(game.stats.earned)} · spent {money(game.stats.spent)} · sold {game.stats.productSold} · raids {game.stats.raids}
      </p>
      <button type="button" className={`${btnDanger} mt-4 w-full`} onClick={abandon}>
        Burn this save
      </button>
    </Sheet>
  );
}

function EventSheet() {
  const game = useRazor((s) => s.game);
  const choose = useRazor((s) => s.choose);
  if (!game?.pending) return null;
  const ev = game.pending;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/80 p-3 sm:items-center">
      <article className="w-full max-w-lg rounded-xl border border-gold bg-panel p-4">
        <p className="text-xs tracking-widest text-gold">THE CITY ASKS</p>
        <h2 className="mt-1 font-display text-3xl leading-none">{ev.title}</h2>
        <p className="mt-3 text-sm text-paper">{ev.body}</p>
        <div className="mt-4 space-y-2">
          {ev.options.map((opt) => (
            <button key={opt.id} type="button" className={`${btnGhost} w-full text-left`} onClick={() => choose(opt.id)}>
              <span className="block">{opt.label}</span>
              <span className="mt-0.5 block text-xs font-normal text-mute">{opt.detail}</span>
            </button>
          ))}
        </div>
      </article>
    </div>
  );
}

function SummarySheet() {
  const game = useRazor((s) => s.game);
  const nextWeek = useRazor((s) => s.nextWeek);
  if (!game?.report) return null;
  const report = game.report;
  const delta = report.cashAfter - report.cashBefore;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/80 p-3 sm:items-center">
      <article className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-xl border border-line bg-panel">
        <div className="overflow-y-auto p-4">
          <p className="text-xs tracking-widest text-gold">WEEK {report.closedWeek} CLOSED</p>
          <h2 className="mt-1 font-display text-3xl leading-none">The books</h2>
          <p className={`mt-3 font-display text-2xl ${delta >= 0 ? "text-gold" : "text-blood"}`}>
            {delta >= 0 ? "+" : ""}
            {money(delta)}
          </p>
          <p className="text-sm text-mute">
            Cash {money(report.cashAfter)} · heat {report.heatBefore} to {report.heatAfter}
          </p>
          <ul className="mt-3 space-y-1">
            {report.lines.map((line) => (
              <li key={line.id} className={`text-sm ${toneClass(line.tone)}`}>
                {line.text}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-mute">Alive crews: {aliveGangs(game).length}. Your blocks: {game.districts.filter((d) => d.owner === "player").length}.</p>
        </div>
        <div className="border-t border-line p-3">
          <button type="button" className={`${btnGold} w-full font-display text-lg tracking-wide`} onClick={async () => {
            if (game.week > 1 && game.week % 3 === 0) await showInterstitial();
            nextWeek();
          }}>
            Begin week {game.week}
          </button>
        </div>
      </article>
    </div>
  );
}

function EndingSheet() {
  const game = useRazor((s) => s.game);
  const abandon = useRazor((s) => s.abandon);
  if (!game) return null;
  const won = game.phase === "won";
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/85 p-3 sm:items-center">
      <article className="w-full max-w-lg rounded-xl border border-gold bg-panel p-4">
        <p className="text-xs tracking-widest text-gold">{won ? "THE CITY KNEELS" : "THE BOOK CLOSES"}</p>
        <h2 className="mt-1 font-display text-4xl leading-none">{won ? game.crew : "Finished"}</h2>
        <p className="mt-3 text-base text-paper">{game.ending}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-mute">Weeks</dt>
            <dd className="font-display text-2xl">{game.week}</dd>
          </div>
          <div>
            <dt className="text-mute">Book</dt>
            <dd className="font-display text-2xl">{money(netWorth(game))}</dd>
          </div>
          <div>
            <dt className="text-mute">Blocks</dt>
            <dd className="font-display text-2xl">{game.districts.filter((d) => d.owner === "player").length}</dd>
          </div>
          <div>
            <dt className="text-mute">Raids</dt>
            <dd className="font-display text-2xl">{game.stats.raids}</dd>
          </div>
        </dl>
        {game.report ? (
          <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto">
            {game.report.lines.slice(0, 8).map((line) => (
              <li key={line.id} className={`text-sm ${toneClass(line.tone)}`}>
                {line.text}
              </li>
            ))}
          </ul>
        ) : null}
        <button type="button" className={`${btnGold} mt-4 w-full font-display text-lg tracking-wide`} onClick={abandon}>
          New empire
        </button>
      </article>
    </div>
  );
}
