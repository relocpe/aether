"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Heart, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RESOLUTIONS,
  SORTS,
  formatBytes,
  readFavorites,
  readWallhavenKey,
  serverFavorites,
  serverWallhavenKey,
  subscribeFavorites,
  subscribeWallhavenKey,
  writeFavorites,
  writeWallhavenKey,
  type WallhavenPage,
  type WallhavenWallpaper,
} from "@/lib/wallhaven";
import { cn } from "@/lib/utils";

type WallhavenBrowserProps = {
  onPick: (item: WallhavenWallpaper) => void;
  onlyFavorites?: boolean;
};

export function WallhavenBrowser({ onPick, onlyFavorites = false }: WallhavenBrowserProps) {
  const [query, setQuery] = useState("");
  const [general, setGeneral] = useState(true);
  const [anime, setAnime] = useState(true);
  const [people, setPeople] = useState(true);
  const [sfw, setSfw] = useState(true);
  const [sketchy, setSketchy] = useState(false);
  const [nsfw, setNsfw] = useState(false);
  const [sorting, setSorting] = useState("toplist");
  const [atleast, setAtleast] = useState("1920x1080");
  const [page, setPage] = useState(1);
  const [favoritesOnly, setFavoritesOnly] = useState(onlyFavorites);
  const [data, setData] = useState<WallhavenPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const apiKey = useSyncExternalStore(subscribeWallhavenKey, readWallhavenKey, serverWallhavenKey);
  const favorites = useSyncExternalStore(subscribeFavorites, readFavorites, serverFavorites);
  const [draftKey, setDraftKey] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (favoritesOnly) return;
    const handle = window.setTimeout(() => {
      const categories = `${Number(general)}${Number(anime)}${Number(people)}`.replace("000", "100");
      const purity = `${Number(sfw)}${Number(sketchy)}${Number(nsfw)}`.replace("000", "100");
      const params = new URLSearchParams({
        q: query,
        categories,
        purity,
        sorting,
        atleast,
        page: String(page),
      });
      setLoading(true);
      fetch(`/api/wallhaven?${params}`, {
        headers: apiKey ? { "x-wallhaven-key": apiKey } : {},
      })
        .then(async (response) => {
          const body = (await response.json()) as WallhavenPage & { error?: string };
          if (!response.ok) throw new Error(body.error || "Поиск не прошёл");
          setData(body);
          setError("");
        })
        .catch((reason: unknown) => {
          setError(reason instanceof Error ? reason.message : "Поиск не прошёл");
        })
        .finally(() => setLoading(false));
    }, 280);
    return () => window.clearTimeout(handle);
  }, [query, general, anime, people, sfw, sketchy, nsfw, sorting, atleast, page, apiKey, favoritesOnly]);

  function saveKey() {
    const next = draftKey.trim();
    if (next && !/^[A-Za-z0-9]{8,80}$/.test(next)) {
      toast.error("Ключ Wallhaven — это буквы и цифры со страницы настроек.");
      return;
    }
    writeWallhavenKey(next);
    setSettingsOpen(false);
    toast.success(next ? "Ключ сохранён в этом браузере." : "Ключ убран.");
  }

  function toggleFavorite(item: WallhavenWallpaper) {
    const exists = favorites.some((entry) => entry.id === item.id);
    writeFavorites(exists ? favorites.filter((entry) => entry.id !== item.id) : [item, ...favorites]);
  }

  const favoriteIds = new Set(favorites.map((item) => item.id));
  const items = favoritesOnly ? favorites : (data?.items ?? []);
  const totalLabel = favoritesOnly
    ? `${favorites.length.toLocaleString("en-US")} favorites`
    : data
      ? `${data.total.toLocaleString("en-US")} results`
      : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          placeholder="Search wallpapers…"
          aria-label="Search wallpapers"
          className="min-w-48 flex-1"
          onChange={(event) => {
            if (!onlyFavorites) setFavoritesOnly(false);
            setQuery(event.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Sorting"
          value={sorting}
          className="h-8 rounded-lg border bg-background px-2 text-xs"
          onChange={(event) => {
            setSorting(event.target.value);
            setPage(1);
          }}
        >
          {SORTS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <Button type="button" onClick={() => setPage(1)}>
          Search
        </Button>
        <Button
          type="button"
          size="icon"
          variant={apiKey ? "secondary" : "outline"}
          aria-label="Wallhaven API key"
          onClick={() => {
            setDraftKey(apiKey);
            setSettingsOpen(true);
          }}
        >
          <Settings />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Filter on={general} label="General" onClick={() => { setGeneral((value) => !value); setPage(1); }} />
        <Filter on={anime} label="Anime" onClick={() => { setAnime((value) => !value); setPage(1); }} />
        <Filter on={people} label="People" onClick={() => { setPeople((value) => !value); setPage(1); }} />
        <span className="mx-1 h-4 w-px bg-border" />
        <Filter on={sfw} label="SFW" onClick={() => { setSfw((value) => !value); setPage(1); }} />
        <Filter on={sketchy} label="Sketchy" onClick={() => { setSketchy((value) => !value); setPage(1); }} />
        <Filter on={nsfw} label="NSFW" onClick={() => { setNsfw((value) => !value); setPage(1); }} />
        <span className="mx-1 h-4 w-px bg-border" />
        <select
          aria-label="Минимальное разрешение"
          value={atleast}
          className="h-7 rounded-lg border bg-background px-2 text-xs"
          onChange={(event) => {
            setAtleast(event.target.value);
            setPage(1);
          }}
        >
          {RESOLUTIONS.map((item) => (
            <option key={item.label} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        {onlyFavorites ? null : (
          <Filter on={favoritesOnly} label="Favorites" onClick={() => setFavoritesOnly((value) => !value)} />
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {loading && !favoritesOnly ? "Searching…" : totalLabel}
        </span>
      </div>

      {nsfw && !apiKey ? (
        <p className="text-xs text-muted-foreground">
          NSFW on Wallhaven needs an API key. The gear stores it in this browser only.
        </p>
      ) : null}
      {error && !favoritesOnly ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm">{error}</p>
      ) : null}
      {loading && !data && !favoritesOnly ? (
        <p className="px-1 py-8 text-sm text-muted-foreground">Loading Wallhaven…</p>
      ) : null}
      {!loading && items.length === 0 ? (
        <p className="px-1 py-8 text-sm text-muted-foreground">
          {favoritesOnly ? "No favorites yet. Use the heart on a wallpaper." : "No wallpapers for this search."}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
            <div key={item.id} className="group relative overflow-hidden rounded-md bg-muted ring-1 ring-white/10">
              <button type="button" className="block w-full text-left" onClick={() => onPick(item)}>
                <Image
                  src={item.thumb}
                  alt=""
                  width={480}
                  height={270}
                  unoptimized
                  className="aspect-video h-auto w-full object-cover"
                />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1 text-[10px] text-white">
                  <span>{item.resolution}</span>
                  <span>{formatBytes(item.fileSize)}</span>
                </span>
              </button>
              <button
                type="button"
                aria-label={favoriteIds.has(item.id) ? "Убрать из избранного" : "В избранное"}
                className={cn(
                  "absolute top-1 right-1 rounded-full bg-black/50 p-1 text-white",
                  favoriteIds.has(item.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
                onClick={() => toggleFavorite(item)}
              >
                <Heart className={cn("size-3.5", favoriteIds.has(item.id) && "fill-current")} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {data && !favoritesOnly && data.pages > 1 ? (
        <div className="flex shrink-0 items-center justify-between border-t bg-background pt-2 text-xs text-muted-foreground">
          <span>
            Page {data.page} of {data.pages}
          </span>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={data.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              Back
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={data.page >= data.pages} onClick={() => setPage((current) => current + 1)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ключ Wallhaven</DialogTitle>
            <DialogDescription>
              Необязателен. Без ключа хватает обычного поиска, около 45 запросов в минуту. Ключ берётся в аккаунте
              Wallhaven, в настройках, и хранится только в этом браузере.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="wallhaven-key">API key</Label>
            <Input
              id="wallhaven-key"
              type="password"
              autoComplete="off"
              value={draftKey}
              placeholder="Вставь ключ"
              onChange={(event) => setDraftKey(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraftKey("");
                writeWallhavenKey("");
                setSettingsOpen(false);
              }}
            >
              Убрать
            </Button>
            <Button type="button" onClick={saveKey}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Filter({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <Button type="button" size="xs" variant={on ? "default" : "ghost"} className={cn(!on && "text-muted-foreground")} onClick={onClick}>
      {label}
    </Button>
  );
}
