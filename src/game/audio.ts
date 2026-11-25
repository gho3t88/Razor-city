// Original AI-authored procedural sound design. No external audio or network requests.
export type Sound = "tick" | "cash" | "hit" | "bad" | "raid" | "win" | "buy" | "sell" | "travel" | "recruit" | "level" | "week" | "reward" | "deal" | "territory";
export type Scene = "menu" | "street" | "combat" | "territory";
export type Volumes = { master: number; music: number; effects: number; ambience: number };
export const defaultVolumes: Volumes = { master: 80, music: 35, effects: 75, ambience: 45 };
const KEY = "razor-city-audio-v2";
let volumes: Volumes = {...defaultVolumes};
let ctx: AudioContext | null = null;
let master: GainNode | null = null, effects: GainNode | null = null, music: GainNode | null = null, ambience: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false, scene: Scene = "menu", nextBeat = 0, step = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let resumePending: Promise<void> | null = null;
let ambientSource: AudioBufferSourceNode | null = null;
let loaded = false;
const clamp = (v: number) => Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
export function getAudioVolumes(): Volumes {
  if (!loaded) {
    loaded = true;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      for (const k of Object.keys(defaultVolumes) as (keyof Volumes)[]) {
        if (typeof saved[k] === "number" && Number.isFinite(saved[k])) volumes[k] = clamp(saved[k]);
      }
    } catch { /* defaults work without storage */ }
  }
  return {...volumes};
}
function mix() {
  if (!ctx || !master || !effects || !music || !ambience) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(muted ? 0 : volumes.master / 100 * 0.65, t, .025);
  effects.gain.setTargetAtTime(volumes.effects / 100, t, .025);
  music.gain.setTargetAtTime(volumes.music / 100, t, .06);
  ambience.gain.setTargetAtTime(volumes.ambience / 100 * (scene === "menu" ? .45 : .75), t, .1);
}
export function setAudioVolumes(value: Volumes) {
  getAudioVolumes();
  volumes = {master:clamp(value.master),music:clamp(value.music),effects:clamp(value.effects),ambience:clamp(value.ambience)};
  try { localStorage.setItem(KEY, JSON.stringify(volumes)); } catch { /* session only */ }
  mix();
}
export function setAudioMuted(value: boolean) { muted = value; mix(); }
function initialize() {
  if (ctx || typeof window === "undefined") return;
  const Ctx = window.AudioContext || (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
  if (!Ctx) return;
  ctx = new Ctx();
  getAudioVolumes();
  master = ctx.createGain(); effects = ctx.createGain(); music = ctx.createGain(); ambience = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12; limiter.ratio.value = 5;
  master.gain.value = 0;
  for (const bus of [effects,music,ambience]) bus.connect(master);
  master.connect(limiter); limiter.connect(ctx.destination);
  noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
  const d = noise.getChannelData(0);
  for(let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
  ambientSource = ctx.createBufferSource(); ambientSource.buffer=noise; ambientSource.loop=true;
  const low=ctx.createBiquadFilter(); low.type="lowpass";low.frequency.value=160;
  const gain=ctx.createGain();gain.gain.value=.075;
  ambientSource.connect(low);low.connect(gain);gain.connect(ambience);ambientSource.start();
  mix();
}
export function unlockAudio(): Promise<void> {
  try { initialize(); } catch { return Promise.resolve(); }
  if (!ctx || (typeof document !== "undefined" && document.visibilityState === "hidden")) return Promise.resolve();
  if (ctx.state === "running") { startClock(); return Promise.resolve(); }
  if (!resumePending) {
    resumePending = ctx.resume().then(()=>{if(ctx?.state==="running"){if(document.visibilityState==="hidden")pauseAudio();else startClock();}}).catch(()=>{}).finally(()=>{resumePending=null;});
  }
  return resumePending;
}
export function resumeAudio() { if (ctx) void unlockAudio(); }
export function pauseAudio() {
  if(timer!==null){clearInterval(timer);timer=null;}
  if(ctx?.state==="running")void ctx.suspend().catch(()=>{});
}
export function setAudioScene(value:Scene) {
  if(scene===value)return;
  scene=value; step=0; nextBeat=ctx?.currentTime ?? 0; mix();
}
function tone(bus:GainNode, time:number, freq:number, duration:number, type:OscillatorType, amp:number, end=freq) {
  if(!ctx)return;
  const osc=ctx.createOscillator(), g=ctx.createGain();
  osc.type=type;osc.frequency.setValueAtTime(Math.max(20,freq),time);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),time+duration);
  g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(Math.max(.0002,amp),time+Math.min(.014,duration/4));
  g.gain.exponentialRampToValueAtTime(.0001,time+duration);
  osc.connect(g);g.connect(bus);osc.start(time);osc.stop(time+duration+.015);
  osc.onended=()=>{osc.disconnect();g.disconnect();};
}
function grit(bus:GainNode,time:number,duration:number,frequency:number,amp:number,type:BiquadFilterType="bandpass") {
  if(!ctx||!noise)return;
  const src=ctx.createBufferSource(), filter=ctx.createBiquadFilter(), g=ctx.createGain();
  src.buffer=noise;filter.type=type;filter.frequency.value=frequency;filter.Q.value=.8;
  g.gain.setValueAtTime(Math.max(.0002,amp),time);g.gain.exponentialRampToValueAtTime(.0001,time+duration);
  src.connect(filter);filter.connect(g);g.connect(bus);src.start(time,Math.random()*.4);src.stop(time+duration);
  src.onended=()=>{src.disconnect();filter.disconnect();g.disconnect();};
}
const tracks: Record<Scene,{bpm:number; bass:number[]; melody:number[]; snare:number; hats:number; kick:number[]}> = {
  menu:{bpm:74,bass:[55,55,65.4,49],melody:[220,261.6,196,164.8],snare:.075,hats:.035,kick:[0,7,10]},
  street:{bpm:88,bass:[49,49,58.3,43.7],melody:[196,233.1,174.6,146.8],snare:.095,hats:.048,kick:[0,6,10,15]},
  combat:{bpm:124,bass:[55,58.3,49,46.2],melody:[220,233.1,196,185],snare:.13,hats:.065,kick:[0,3,6,8,11,14]},
  territory:{bpm:68,bass:[65.4,55,58.3,49],melody:[261.6,220,233.1,196],snare:.055,hats:.026,kick:[0,10]},
};
function startClock() {
  if(timer!==null||!ctx)return;
  nextBeat=ctx.currentTime+.04;
  const schedule=()=>{
    if(!ctx||!music||ctx.state!=="running"||document.visibilityState==="hidden")return;
    if(nextBeat<ctx.currentTime-.1)nextBeat=ctx.currentTime+.03;
    const p=tracks[scene];
    while(nextBeat<ctx.currentTime+.12){
      const beat=step%16, bar=Math.floor(step/16)%4, t=nextBeat, interval=60/p.bpm/4;
      if(p.kick.includes(beat))tone(music,t,110,.19,"sine",.24,42);
      if(beat===4||beat===12){grit(music,t,.13,1700,p.snare);tone(music,t,165,.09,"triangle",.05,85);}
      if(beat%2===0||scene==="combat")grit(music,t,.045,6800,p.hats*(beat%4===0?1:.65),"highpass");
      if(beat===0||beat===8)tone(music,t,p.bass[bar],interval*5.8,"triangle",.12,p.bass[bar]*.995);
      if(beat===2||beat===11) {
        const f=p.melody[bar]*(beat===11?1.5:1);
        tone(music,t,f,interval*3.3,"sine",.055);
        tone(music,t,f*2,interval*1.9,"triangle",.018);
      }
      if(beat===0){tone(music,t,p.melody[bar]/2,interval*13,"sine",.036);tone(music,t,p.melody[bar]*.75,interval*13,"sine",.022);}
      nextBeat+=interval;step++;
    }
  };
  schedule();timer=setInterval(schedule,45);
}
let lastTick=0;
export async function playSound(kind: Sound) {
  if(muted)return;
  await unlockAudio();
  if(!ctx||!effects||muted||ctx.state!=="running")return;
  const t=ctx.currentTime+.012,b=effects, r=.94+Math.random()*.12;
  const n=(f:number,d:number,a:number,delay=0,type:OscillatorType="triangle",end=f)=>tone(b,t+delay,f*r,d,type,a,end*r);
  const g=(d:number,f:number,a:number,delay=0)=>grit(b,t+delay,d,f,a);
  if(kind==="tick"){if(t-lastTick<.075)return;lastTick=t;g(.045,2400,.095);n(680,.055,.075,0,"sine",420);}
  else if(kind==="cash"||kind==="buy"||kind==="sell"||kind==="reward"){
    g(.08,3400,.14);g(.065,1900,.10,.08);n(440,.12,.14,.02);
    n(kind==="buy"?554:659,.15,.15,.10);n(880,.19,.12,.18,"sine");
    if(kind==="reward"||kind==="sell"){n(1047,.25,.12,.27);n(95,.27,.18,.03,"sine",48);}
  }else if(kind==="hit"){g(.19,1150,.32);g(.075,3800,.16,.1);n(105,.28,.33,0,"sine",37);n(180,.13,.09,.09,"triangle",60);}
  else if(kind==="bad"){n(196,.25,.15,0,"triangle",130);n(147,.28,.13,.13,"sine",73);}
  else if(kind==="raid"){n(620,.2,.12,0,"triangle",400);n(420,.22,.12,.19,"triangle",720);n(90,.4,.22,0,"sine",35);g(.18,1600,.12);}
  else if(kind==="win"||kind==="territory"||kind==="level"){
    n(110,.36,.20,0,"sine",55);[261.6,329.6,392,523.2].forEach((f,i)=>n(f,.24,.13,i*.10));g(.18,4400,.075,.26);
  }else if(kind==="travel"){g(.55,350,.21);n(72,.55,.13,0,"triangle",130);g(.20,1500,.075,.25);}
  else if(kind==="recruit"||kind==="deal"){g(.10,2300,.10);n(780,.09,.16);n(1040,.11,.12,.12,"sine");if(kind==="deal")n(780,.12,.13,.26);}
  else if(kind==="week"){g(.1,2200,.14);g(.1,2600,.12,.12);n(220,.23,.14);n(330,.23,.12,.14);n(440,.3,.12,.30);}
}
