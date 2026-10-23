import type { EngineHost } from './engine.ts';
import type { TokenRange } from '../domain/codegen.ts';
import type { Hap, Repl } from '@strudel/core';

type Webaudio = typeof import('@strudel/webaudio');
type SampleBank = import('@strudel/webaudio').SampleBank;

interface PreloadJob {
  /** `name:index` in Kleinbuchstaben, wie superdough die Namen nachschlägt. */
  key: string;
  run(): Promise<void>;
}

/** Gleichzeitige Downloads beim Vorladen. */
const PRELOAD_PARALLEL = 4;

/**
 * Einzige Klang-Engine: Strudel selbst (`@strudel/core`, `@strudel/webaudio`, `@strudel/transpiler`,
 * erst beim ersten Abspielen, Anspielen oder Vorladen geladen). Strudel steht unter der AGPL-3.0-or-later.
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
 *
 * Vorladen: Sichtbare Klangsteine laden ihr Sample in Strudels eigenen Puffer-Cache (`getSampleBuffer`, nach Adresse),
 * danach die übrigen Varianten desselben Namens. Beim Abspielen findet superdough die Puffer dann schon dekodiert vor.
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
  /** Vorladen: `name:index`, die schon laufen oder fertig sind, und die Warteschlangen (sichtbare Steine zuerst). */
  private started = new Set<string>();
  private urgent: PreloadJob[] = [];
  private later: PreloadJob[] = [];
  private active = 0;

  constructor(private host: EngineHost) {}

  async start(): Promise<void> {
    if (!this.mod) this.announceLoading();
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
   * Einen Klang einmal anspielen (langes Drücken in der Palette, Tippen auf einen Stein), unabhängig von der Wiedergabe.
   * `url`: eigener Klang, der vorher bei Strudel angemeldet wird. Ein unbekannter Name bleibt still.
   * `note`: Tonhöhe wie im Code (`c#4`, `eb` oder eine MIDI-Zahl), sonst spielt der Klang in seiner eigenen Höhe.
   * `variant`: welches Sample des Namens (`bd:3` im Code), 0 = das erste.
   */
  async preview(name: string, url?: string, note?: string, variant = 0): Promise<void> {
    const wasLoaded = this.mod !== null;
    if (!wasLoaded) this.announceLoading();
    await this.ensureLoaded();
    const mod = this.mod as Webaudio;
    // Hat das Anspielen Strudel geladen, die Ladeanzeige wieder wegnehmen (beim Abspielen erledigt das `run`)
    if (!wasLoaded) this.host.setStatus(this.note ? { kind: 'info', text: this.note } : null);
    // iOS: ausserhalb einer Geste (langes Drücken läuft über einen Zeitgeber) springt der Kontext evtl. nicht an
    const ctx = mod.getAudioContext();
    if (ctx.state !== 'running') await ctx.resume().catch(() => {});
    if (url) await mod.samples({ [name]: url });
    this.applyVolume();
    const pitch = note === undefined ? {} : { note: Number.isNaN(Number(note)) ? note : Number(note) };
    await mod.superdough({ s: name, n: variant, ...pitch }, mod.getAudioContextCurrentTime() + 0.05, 0.5);
  }

  /**
   * Die Samples eines Klangs im Voraus laden: zuerst die Variante `variant`, danach die übrigen Varianten des Namens.
   * Lädt Strudel bei Bedarf, aber ohne Ladeanzeige. Synths, Soundfonts und unbekannte Namen haben nichts vorzuladen.
   * Fehler bleiben still, beim Abspielen versucht superdough es erneut und meldet sie dort.
   */
  async preload(name: string, variant = 0): Promise<void> {
    try {
      await this.ensureLoaded();
    } catch {
      return;
    }
    const data = (this.mod as Webaudio).getSound(name)?.data;
    if (data?.type !== 'sample' || !data.samples) return;
    this.enqueue(name, variant, data.samples, true);
  }

  /**
   * Wie viele Varianten ein Sample-Klang hat. Bei Klängen nach Tonhöhe (`piano`: Note zu Liste) die längste Liste,
   * superdough wählt die Variante in der Liste der nächsten Note.
   */
  private variantCount(bank: SampleBank): number {
    if (Array.isArray(bank)) return bank.length;
    const lists = Object.entries(bank).filter(([key]) => !key.startsWith('_'));
    return Math.max(0, ...lists.map(([, list]) => (typeof list === 'string' ? 1 : list.length)));
  }

  private enqueue(name: string, variant: number, bank: SampleBank, urgent: boolean): void {
    const count = this.variantCount(bank);
    if (count === 0) return;
    // superdough zählt über das Ende hinaus wieder von vorn (`bd:12` bei 9 Varianten ist `bd:3`)
    const index = variant % count;
    const key = `${name.toLowerCase()}:${index}`;
    if (this.started.has(key)) return;
    const waiting = this.later.findIndex((j) => j.key === key);
    if (waiting >= 0) {
      // Schon als Variante eingereiht, jetzt aber sichtbar: nach vorn
      if (!urgent) return;
      this.later.splice(waiting, 1);
    } else if (this.urgent.some((j) => j.key === key)) return;
    const job: PreloadJob = {
      key,
      run: async () => {
        await (this.mod as Webaudio).getSampleBuffer({ s: name, n: index }, bank);
        // Sobald die sichtbare Variante da ist, die übrigen dahinter einreihen
        if (urgent) for (let n = 0; n < count; n++) this.enqueue(name, n, bank, false);
      },
    };
    (urgent ? this.urgent : this.later).push(job);
    this.pump();
  }

  /** Höchstens wenige Downloads gleichzeitig, damit sichtbare Steine nicht hinter langen Variantenlisten warten. */
  private pump(): void {
    while (this.active < PRELOAD_PARALLEL) {
      const job = this.urgent.shift() ?? this.later.shift();
      if (!job) return;
      this.started.add(job.key);
      this.active++;
      job
        .run()
        // Fehlgeschlagen: beim nächsten Sichtbarwerden nochmals versuchen
        .catch(() => this.started.delete(job.key))
        .finally(() => {
          this.active--;
          this.pump();
        });
    }
  }

  private announceLoading(): void {
    this.host.setStatus({ kind: 'info', text: 'Lade Strudel und die Klänge …' });
  }

  /** Strudel nur einmal laden, auch wenn Abspielen, Anspielen und Vorladen gleichzeitig kommen. */
  private ensureLoaded(): Promise<void> {
    this.loading ??= this.load().catch((e) => {
      this.loading = null;
      throw e;
    });
    return this.loading;
  }

  private async load(): Promise<void> {
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
