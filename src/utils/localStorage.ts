export const ARIES_STORAGE_KEY = "aries_mod";

type AnyRecord = Record<string, any>;

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readRoot(): AnyRecord {
  const storage = getStorage();
  if (!storage) return {};
  const raw = storage.getItem(ARIES_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeRoot(next: AnyRecord) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(ARIES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function toPath(path?: string | Array<string | number>): Array<string | number> {
  if (!path) return [];
  return Array.isArray(path) ? path.slice() : path.split(".").map((k) => (k.match(/^\d+$/) ? Number(k) : k));
}

function getAtPath(root: AnyRecord, path: Array<string | number>) {
  let cur: any = root;
  for (const seg of path) {
    if (cur == null) return undefined;
    cur = cur[seg as any];
  }
  return cur;
}

function setAtPath(root: AnyRecord, path: Array<string | number>, value: any) {
  if (!path.length) return value;
  const clone: AnyRecord = Array.isArray(root) ? root.slice() : { ...(root ?? {}) };
  let cur: any = clone;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const src = cur[key as any];
    const next = typeof src === "object" && src !== null ? (Array.isArray(src) ? src.slice() : { ...src }) : {};
    cur[key as any] = next;
    cur = next;
  }
  cur[path[path.length - 1] as any] = value;
  return clone;
}

export function readAriesPath<T = any>(path: string | Array<string | number>): T | undefined {
  const root = readRoot();
  return getAtPath(root, toPath(path)) as T | undefined;
}

export function writeAriesPath(path: string | Array<string | number>, value: any) {
  const root = readRoot();
  const next = setAtPath(root, toPath(path), value);
  writeRoot(next as AnyRecord);
}

export function updateAriesPath(path: string | Array<string | number>, value: any) {
  writeAriesPath(path, value);
}
