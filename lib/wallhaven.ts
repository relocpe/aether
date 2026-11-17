export type WallhavenWallpaper = {
  id: string;
  resolution: string;
  fileSize: number;
  category: string;
  purity: string;
  page: string;
  thumb: string;
  image: string;
};

export type WallhavenPage = {
  total: number;
  page: number;
  pages: number;
  items: WallhavenWallpaper[];
};

export const WALLHAVEN_KEY = "aether.wallhaven.key";
export const WALLHAVEN_FAVORITES = "aether.wallhaven.favorites";

export const SORTS = [
  { id: "toplist", label: "Top List" },
  { id: "date_added", label: "Latest" },
  { id: "relevance", label: "Relevance" },
  { id: "random", label: "Random" },
  { id: "views", label: "Views" },
  { id: "favorites", label: "Favorites" },
] as const;

export const RESOLUTIONS = [
  { id: "1920x1080", label: "1920×1080+" },
  { id: "2560x1440", label: "2560×1440+" },
  { id: "3840x2160", label: "3840×2160+" },
  { id: "", label: "Any" },
] as const;

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

export function aspectRatio(resolution: string) {
  const [width, height] = resolution.split("x").map(Number);
  if (!width || !height) return "16 / 10";
  return `${width} / ${height}`;
}

const KEY_EVENT = "aether-wallhaven-key";
const FAVORITES_EVENT = "aether-wallhaven-favorites";
const EMPTY_FAVORITES: WallhavenWallpaper[] = [];
let keySnapshot = "";
let favoritesSnapshot: WallhavenWallpaper[] = EMPTY_FAVORITES;
let favoritesRaw = "";

export function readWallhavenKey() {
  keySnapshot = localStorage.getItem(WALLHAVEN_KEY) ?? "";
  return keySnapshot;
}

export function serverWallhavenKey() {
  return "";
}

export function subscribeWallhavenKey(onChange: () => void) {
  window.addEventListener(KEY_EVENT, onChange);
  return () => window.removeEventListener(KEY_EVENT, onChange);
}

export function writeWallhavenKey(key: string) {
  keySnapshot = key;
  if (key) localStorage.setItem(WALLHAVEN_KEY, key);
  else localStorage.removeItem(WALLHAVEN_KEY);
  window.dispatchEvent(new Event(KEY_EVENT));
}

export function readFavorites() {
  const raw = localStorage.getItem(WALLHAVEN_FAVORITES) ?? "";
  if (raw === favoritesRaw) return favoritesSnapshot;
  favoritesRaw = raw;
  if (!raw) {
    favoritesSnapshot = EMPTY_FAVORITES;
    return favoritesSnapshot;
  }
  try {
    const parsed = JSON.parse(raw) as WallhavenWallpaper[];
    favoritesSnapshot = Array.isArray(parsed) ? parsed : EMPTY_FAVORITES;
  } catch {
    favoritesSnapshot = EMPTY_FAVORITES;
  }
  return favoritesSnapshot;
}

export function serverFavorites() {
  return EMPTY_FAVORITES;
}

export function subscribeFavorites(onChange: () => void) {
  window.addEventListener(FAVORITES_EVENT, onChange);
  return () => window.removeEventListener(FAVORITES_EVENT, onChange);
}

export function writeFavorites(next: WallhavenWallpaper[]) {
  favoritesSnapshot = next.slice(0, 80);
  favoritesRaw = JSON.stringify(favoritesSnapshot);
  localStorage.setItem(WALLHAVEN_FAVORITES, favoritesRaw);
  window.dispatchEvent(new Event(FAVORITES_EVENT));
}
