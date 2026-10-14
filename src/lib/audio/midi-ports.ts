/**
 * Namen der MIDI-Ausgänge über die Web-MIDI-API des Browsers, für die Auswahl im Spurkopf.
 * Senden tut Strudel selbst (`@strudel/midi`, `.midi('Name')`); es findet den Ausgang über seinen Namen.
 * Safari kennt Web MIDI nicht, Chrome und Firefox fragen beim ersten Zugriff nach der Erlaubnis.
 */
export type MidiPorts = { ok: true; names: string[] } | { ok: false; reason: 'unsupported' | 'denied' };

/** Ruft `onChange` sofort und bei jedem An- oder Abstecken eines Geräts. Gibt eine Funktion zum Abmelden zurück. */
export async function watchMidiOutputs(onChange: (ports: MidiPorts) => void): Promise<() => void> {
  if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
    onChange({ ok: false, reason: 'unsupported' });
    return () => {};
  }
  let access: MIDIAccess;
  try {
    access = await navigator.requestMIDIAccess();
  } catch (e) {
    console.warn('MIDI', e);
    onChange({ ok: false, reason: 'denied' });
    return () => {};
  }
  const report = () => {
    const names = [...access.outputs.values()].filter((o) => o.state !== 'disconnected').map((o) => o.name ?? o.id);
    onChange({ ok: true, names });
  };
  report();
  access.addEventListener('statechange', report);
  return () => access.removeEventListener('statechange', report);
}
