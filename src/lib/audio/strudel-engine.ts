import type { EngineHost } from './engine.ts';
import type { TokenRange } from '../domain/codegen.ts';
import type { Hap, Repl } from '@strudel/core';

type Webaudio = typeof import('@strudel/webaudio');

/**
 * Einzige Klang-Engine: Strudel selbst (`@strudel/core`, `@strudel/webaudio`, `@strudel/transpiler`,
 * erst beim ersten Abspielen geladen). Strudel steht unter der AGPL-3.0-or-later.
 *
 * Bewusst nicht `@strudel/web`: Dieses Paket bündelt eine eigene Kopie von Strudel. Das Prebake aus `@strudel/repl`
 * arbeitet mit den einzelnen Paketen, überschreibt die globalen Funktionen (`s`, …) und meldet die Klänge dort an.
 * Mit zwei Kopien fehlt den Mustern `.p` (für `$:`) und die Ausgabe findet die Klänge nicht.
 *
 * Klangquellen: Wir übernehmen nichts von Hand. Das Prebake kommt aus dem offiziellen Paket `@strudel/repl`
 * (passende Version zu `@strudel/webaudio`) und lädt, was die Strudel-Oberfläche lädt: Drum Machines, Piano, Dirt-Samples,
 * Mridangam, VCSL, das uzu-Drumkit (liefert `bd`, `sd`, `hh` …), ZZFX, Soundfonts, Synth-Klänge und die Alias-Liste.
 * Beim Aktualisieren von Strudel ändern sich die Klangquellen so automatisch mit.
 *
 * Aufleuchten der Steine: Strudel meldet pro Ereignis die Zeichenposition im Code (`hap.context.locations`).
 * Weil der Code von `codegen` stammt, kennen wir die Position jedes Klangnamens und finden so den Stein.
 */
export class StrudelEngine {
  private mod: Webaudio | null = null;
  private loading: Promise<void> | null = null;
  private repl: Repl | null = null;
  private note: string | null = null;
  private evalError: Error | null = null;
  private timer: number | undefined;
  private raf: number | undefined;
  private ranges: TokenRange[] = [];
  private flashes: { at: number; ids: string[] }[] = [];
  private lastLit = new Set<string>();

  constructor(private host: EngineHost) {}

  async start(): Promise<void> {
    await this.ensureLoaded();
    await this.run();
    this.raf = requestAnimationFrame(this.highlight);
  }

  stop(): void {
    window.clearTimeout(this.timer);
    if (this.raf !== undefined) cancelAnimationFrame(this.raf);
    this.repl?.stop();
    this.flashes = [];
    this.lastLit = new Set();
    this.host.setLit(this.lastLit);
    this.host.setCycle(null);
  }

  /**
   * Hauptlautstärke auf Strudels Ausgang (`destinationGain` im Audio-Controller von superdough). Strudel kann diesen
   * Knoten ersetzen, deshalb bei jeder Auswertung erneut setzen.
   */
  applyVolume(): void {
    if (!this.mod) return;
    const gain = this.mod.getSuperdoughAudioController().output.destinationGain?.gain;
    gain?.setTargetAtTime(this.host.getVolume(), this.mod.getAudioContextCurrentTime(), 0.02);
  }

  /** Änderungen gebündelt an Strudel schicken. Strudel übernimmt sie zum nächsten Zyklus. */
  changed(): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.run(), 200);
  }

  /**
   * Einen Klang einmal anspielen (langes Drücken in der Palette), unabhängig von der Wiedergabe.
   * `url`: eigener Klang, der vorher bei Strudel angemeldet wird. Ein unbekannter Name bleibt still.
   */
  async preview(name: string, url?: string): Promise<void> {
    const wasLoaded = this.mod !== null;
    await this.ensureLoaded();
    const mod = this.mod as Webaudio;
    // Hat das Anspielen Strudel geladen, die Ladeanzeige wieder wegnehmen (beim Abspielen erledigt das `run`)
    if (!wasLoaded) this.host.setStatus(this.note ? { kind: 'info', text: this.note } : null);
    // iOS: ausserhalb einer Geste (langes Drücken läuft über einen Zeitgeber) springt der Kontext evtl. nicht an
    const ctx = mod.getAudioContext();
    if (ctx.state !== 'running') await ctx.resume().catch(() => {});
    if (url) await mod.samples({ [name]: url });
    this.applyVolume();
    await mod.superdough({ s: name }, mod.getAudioContextCurrentTime() + 0.05, 0.5);
  }

  /** Strudel nur einmal laden, auch wenn Abspielen und Anspielen gleichzeitig kommen. */
  private ensureLoaded(): Promise<void> {
    this.loading ??= this.load().catch((e) => {
      this.loading = null;
      throw e;
    });
    return this.loading;
  }

  private async load(): Promise<void> {
    this.host.setStatus({ kind: 'info', text: 'Lade Strudel und die Klänge …' });
    const [core, mod, { transpiler }, mini, { prebake }] = await Promise.all([
      import('@strudel/core'),
      import('@strudel/webaudio'),
      import('@strudel/transpiler'),
      import('@strudel/mini'),
      import('@strudel/repl/prebake.mjs'),
    ]);
    // Wie `initStrudel` aus `@strudel/web`, aber mit den einzelnen Paketen, die auch das Prebake benutzt
    void mod.initAudioOnFirstClick();
    mini.miniAllStrings();
    const repl = mod.webaudioRepl({
      transpiler,
      defaultOutput: (hap, deadline, duration, cps, t) => {
        this.onHap(hap, t);
        return mod.webaudioOutput(hap, deadline, duration, cps, t);
      },
      onEvalError: (e) => {
        this.evalError = e;
      },
    });
    core.setTime(() => repl.scheduler.now());
    // Das Prebake meldet Kern, Mini-Notation, Webaudio usw. global an und lädt die Klangquellen
    try {
      await prebake();
    } catch (e) {
      this.note = `Nicht alle Klangquellen konnten geladen werden (${(e as Error)?.message ?? e}). Manche Klänge fehlen oder klingen anders als auf strudel.cc.`;
    }
    this.repl = repl;
    this.mod = mod;
  }

  private async run(): Promise<void> {
    if (!this.repl) return;
    const program = this.host.getProgram();
    this.evalError = null;
    try {
      this.applyVolume();
      await this.repl.evaluate(program.code);
      if (this.evalError) throw this.evalError;
      this.ranges = program.ranges;
      this.host.setStatus(this.note ? { kind: 'info', text: this.note } : null);
    } catch (e) {
      this.host.setStatus({ kind: 'error', text: `Strudel meldet einen Fehler: ${(e as Error)?.message ?? e}` });
    }
  }

  /** Wird von Strudel für jedes Ereignis aufgerufen, `t` ist die Zeit auf der Audio-Uhr. */
  private onHap(hap: Hap, t: number): void {
    const locations = hap.context?.locations;
    if (!locations || locations.length === 0) return;
    const ids: string[] = [];
    for (const loc of locations) {
      const range = this.ranges.find((r) => loc.start >= r.start && loc.start < r.end);
      if (range) ids.push(range.tokenId);
    }
    if (ids.length > 0) this.flashes.push({ at: t, ids });
  }

  private highlight = (): void => {
    if (!this.mod) return;
    // Abspielkopf: Strudels Scheduler kennt die Position in Zyklen
    if (this.repl) this.host.setCycle(this.repl.scheduler.now());
    const now = this.mod.getAudioContextCurrentTime();
    this.flashes = this.flashes.filter((f) => f.at + 0.15 > now);
    const lit = new Set(this.flashes.filter((f) => f.at <= now).flatMap((f) => f.ids));
    const same = lit.size === this.lastLit.size && [...lit].every((id) => this.lastLit.has(id));
    if (!same) {
      this.lastLit = lit;
      this.host.setLit(lit);
    }
    this.raf = requestAnimationFrame(this.highlight);
  };
}
