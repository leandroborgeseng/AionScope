/** Chime curto (dois tons) gerado no cliente — sem arquivo binário. */

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

export async function desbloquearSomTv(): Promise<boolean> {
  const audio = audioContext();
  if (!audio) return false;
  if (audio.state === "suspended") {
    try {
      await audio.resume();
    } catch {
      return false;
    }
  }
  return audio.state === "running";
}

/** Dois senoides curtos (C5 → E5), volume baixo, ~0,4 s. */
export function tocarChimeNovaOs(): void {
  const audio = audioContext();
  if (!audio || audio.state !== "running") return;
  const agora = audio.currentTime;
  const notas: Array<{ freq: number; at: number }> = [
    { freq: 523.25, at: 0 },
    { freq: 659.25, at: 0.14 },
  ];
  for (const nota of notas) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = nota.freq;
    const t = agora + nota.at;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.28);
  }
}

export const SALA_SOM_STORAGE = "aion.sala.tv.som";
