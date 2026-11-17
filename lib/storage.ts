export type StoredBlueprint = {
  id: string;
  name: string;
  colors: string[];
  accentIndex: number;
  light: boolean;
  taskbar: boolean;
  titleBars: boolean;
  transparency: boolean;
  blurWall: boolean;
  createdAt: number;
  thumb?: string;
};

const STORAGE_KEY = "aether.blueprints.v1";
const EVENT = "aether-blueprints";
const EMPTY: StoredBlueprint[] = [];

let snapshot: StoredBlueprint[] = EMPTY;
let snapshotRaw = "";

export function readBlueprints() {
  const raw = localStorage.getItem(STORAGE_KEY) ?? "";
  if (raw === snapshotRaw) return snapshot;
  snapshotRaw = raw;
  if (!raw) {
    snapshot = EMPTY;
    return snapshot;
  }
  try {
    const parsed = JSON.parse(raw) as StoredBlueprint[];
    snapshot = Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    snapshot = EMPTY;
  }
  return snapshot;
}

export function serverBlueprints() {
  return EMPTY;
}

export function subscribeBlueprints(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function writeBlueprints(next: StoredBlueprint[]) {
  const raw = JSON.stringify(next.slice(0, 16));
  localStorage.setItem(STORAGE_KEY, raw);
  snapshot = next.slice(0, 16);
  snapshotRaw = raw;
  window.dispatchEvent(new Event(EVENT));
}
