export type Sound = "tick" | "cash" | "hit" | "bad" | "raid" | "win";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

export function setAudioMuted(value: boolean) {
  muted = value;
  if (!master || !ctx) return;
  master.gain.setTargetAtTime(value ? 0 : 0.22, ctx.currentTime, 0.02);
}

export function unlockAudio() {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  if (!ctx) {
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.22;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
}

export function resumeAudio() {
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0) {
  if (!ctx || !master || muted) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp);
  amp.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.03);
  osc.onended = () => {
    osc.disconnect();
    amp.disconnect();
  };
}

export function playSound(kind: Sound) {
  unlockAudio();
  if (kind === "tick") tone(540, 0.05, "square", 0.04);
  if (kind === "cash") {
    tone(420, 0.08, "triangle", 0.07);
    tone(640, 0.1, "triangle", 0.06, 0.07);
  }
  if (kind === "hit") {
    tone(92, 0.16, "sawtooth", 0.07);
    tone(180, 0.08, "square", 0.04, 0.02);
  }
  if (kind === "bad") tone(160, 0.14, "square", 0.05);
  if (kind === "raid") {
    tone(760, 0.12, "sawtooth", 0.045);
    tone(480, 0.16, "sawtooth", 0.04, 0.13);
  }
  if (kind === "win") {
    tone(523, 0.1, "triangle", 0.07);
    tone(659, 0.11, "triangle", 0.07, 0.09);
    tone(784, 0.18, "triangle", 0.07, 0.18);
  }
}
