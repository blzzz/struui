import { watchMidiOutputs } from '../audio/midi-ports.ts';
import type { MidiPorts } from '../audio/midi-ports.ts';

/**
 * Die MIDI-Ausgänge des Geräts. Erst geladen, wenn eine Spur MIDI wird, damit der Browser nicht schon beim Start
 * nach der Erlaubnis fragt.
 */
class Midi {
  /** null = noch nicht gefragt. */
  ports = $state<MidiPorts | null>(null);
  private started = false;

  load(): void {
    if (this.started) return;
    this.started = true;
    void watchMidiOutputs((ports) => (this.ports = ports));
  }
}

export const midi = new Midi();
