import { hotkeyToString, stringToHotkey, matchHotkey, type Hotkey } from "../ui/menu";
import { readAriesPath, updateAriesPath } from "../utils/localStorage";

export type { Hotkey } from "../ui/menu";

type KeybindId = "gui.toggle-layout-creator";

const DEFAULT_KEYBINDS: Record<KeybindId, Hotkey | null> = {
  "gui.toggle-layout-creator": { code: "KeyL" },
};

const listeners = new Map<KeybindId, Set<(hk: Hotkey | null) => void>>();

function readKeybindMap(): Record<string, string> {
  return readAriesPath<Record<string, string>>("keybinds.bindings") || {};
}

function writeKeybindMap(next: Record<string, string>) {
  updateAriesPath("keybinds.bindings", next);
}

export function getKeybind(id: KeybindId): Hotkey | null {
  const map = readKeybindMap();
  if (map[id]) return stringToHotkey(map[id]);
  return DEFAULT_KEYBINDS[id] ?? null;
}

export function setKeybind(id: KeybindId, hk: Hotkey | null) {
  const map = readKeybindMap();
  if (hk) {
    map[id] = hotkeyToString(hk);
  } else {
    delete map[id];
  }
  writeKeybindMap(map);
  listeners.get(id)?.forEach((cb) => cb(getKeybind(id)));
}

export function onKeybindChange(id: KeybindId, cb: (hk: Hotkey | null) => void): () => void {
  const set = listeners.get(id) ?? new Set();
  set.add(cb);
  listeners.set(id, set);
  return () => {
    set.delete(cb);
  };
}

export function eventMatchesKeybind(id: KeybindId, ev: KeyboardEvent): boolean {
  const hk = getKeybind(id);
  return !!hk && matchHotkey(ev, hk);
}
