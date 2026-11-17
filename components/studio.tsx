"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Download,
  ImagePlus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { TuneSlider } from "@/components/tune-slider";
import { WallhavenBrowser } from "@/components/wallhaven-browser";
import { WindowsDesktop } from "@/components/windows-desktop";
import { contrastGrade, hexToRgb } from "@/lib/color";
import type { WallhavenWallpaper } from "@/lib/wallhaven";
import {
  powershellScript,
  terminalScheme,
  vscodeSnippet,
  windowsThemeFile,
} from "@/lib/export-windows";
import {
  ANSI_NAMES,
  applyAdjustments,
  colorsToHex,
  defaultAdjustments,
  hexesToColors,
  medianCut,
  MODES,
  paletteFromClusters,
  paletteFromPixels,
  withOverrides,
  type ExtractMode,
  type PaletteAdjustments,
} from "@/lib/palette";
import {
  cssFilter,
  defaultImageAdjustments,
  IMAGE_PRESETS,
  type ImageAdjustments,
} from "@/lib/presets";
import { renderJpegBase64, sampleWallpaper } from "@/lib/sample";
import {
  readBlueprints,
  serverBlueprints,
  subscribeBlueprints,
  writeBlueprints,
  type StoredBlueprint,
} from "@/lib/storage";
import { LIBRARY, themeById } from "@/lib/themes";
import { WALLPAPERS } from "@/lib/wallpapers";
import { cn } from "@/lib/utils";

type Blueprint = StoredBlueprint;

const emptyOverrides = () => Array.from({ length: 16 }, () => null as string | null);

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function Studio() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [wallpaperSrc, setWallpaperSrc] = useState<string>(WALLPAPERS[0].src);
  const [wallpaperName, setWallpaperName] = useState<string>(WALLPAPERS[0].name);
  const [sampleId, setSampleId] = useState<string>(WALLPAPERS[0].id);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<ExtractMode>("normal");
  const [light, setLight] = useState(false);
  const [adjustments, setAdjustments] = useState<PaletteAdjustments>(defaultAdjustments);
  const [imageAdj, setImageAdj] = useState<ImageAdjustments>(defaultImageAdjustments);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [pixels, setPixels] = useState<Awaited<ReturnType<typeof sampleWallpaper>> | null>(null);
  const [sampling, setSampling] = useState(true);
  const [libraryId, setLibraryId] = useState<string | null>(null);
  const [customBase, setCustomBase] = useState<string[] | null>(null);
  const [overrides, setOverrides] = useState(emptyOverrides);
  const [accentIndex, setAccentIndex] = useState(4);
  const [taskbar, setTaskbar] = useState(true);
  const [titleBars, setTitleBars] = useState(true);
  const [transparency, setTransparency] = useState(true);
  const [blurWall, setBlurWall] = useState(false);
  const [themeName, setThemeName] = useState<string>(WALLPAPERS[0].name);
  const [dragging, setDragging] = useState(false);
  const [exporting, setExporting] = useState(false);
  const blueprints = useSyncExternalStore(subscribeBlueprints, readBlueprints, serverBlueprints);
  const [saveOpen, setSaveOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [view, setView] = useState<
    "editor" | "wallhaven" | "github" | "local" | "favorites" | "blueprints" | "omarchy"
  >("wallhaven");

  useEffect(() => {
    let cancel = false;
    const handle = window.setTimeout(() => {
      setSampling(true);
      sampleWallpaper(wallpaperSrc, imageAdj)
        .then((next) => {
          if (!cancel) setPixels(next);
        })
        .catch(() => {
          if (!cancel) toast.error("Браузер не смог открыть эту картинку. Попробуй JPG или PNG.");
        })
        .finally(() => {
          if (!cancel) setSampling(false);
        });
    }, 120);
    return () => {
      cancel = true;
      window.clearTimeout(handle);
    };
  }, [wallpaperSrc, imageAdj]);

  const openImage = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Нужен файл изображения.");
      return;
    }
    const url = URL.createObjectURL(file);
    setUploadUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return url;
    });
    const name = file.name.replace(/\.[^.]+$/, "") || "Свои обои";
    setWallpaperSrc(url);
    setWallpaperName(name);
    setThemeName(name);
    setSampleId("");
    setLibraryId(null);
    setCustomBase(null);
    setOverrides(emptyOverrides());
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((item) =>
        item.type.startsWith("image/"),
      );
      if (file) {
        event.preventDefault();
        openImage(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [openImage]);

  const liveExtract = libraryId === null && customBase === null;

  const baseHex = useMemo(() => {
    if (customBase) return customBase;
    if (libraryId) return themeById(libraryId).colors;
    if (!pixels || pixels.length === 0) return themeById("tokyo").colors;
    return colorsToHex(paletteFromPixels(pixels, mode, light));
  }, [customBase, libraryId, pixels, mode, light]);

  const colors = useMemo(() => {
    const adjusted = applyAdjustments(hexesToColors(baseHex), adjustments, light);
    return colorsToHex(withOverrides(adjusted, overrides));
  }, [baseHex, adjustments, light, overrides]);

  const strips = useMemo(() => {
    if (!pixels || pixels.length === 0) return null;
    const clusters = medianCut(pixels, 12);
    return Object.fromEntries(
      MODES.map((item) => [
        item.id,
        colorsToHex(paletteFromClusters(clusters, pixels, item.id, light)).slice(0, 8),
      ]),
    ) as Record<ExtractMode, string[]>;
  }, [pixels, light]);

  const accent = colors[accentIndex] ?? colors[4] ?? "#7aa2f7";
  const filter = cssFilter(imageAdj);

  function pickWallhaven(item: WallhavenWallpaper) {
    setView("editor");
    setSampleId("");
    setWallpaperSrc(item.image);
    setWallpaperName(item.id);
    setThemeName(`wallhaven-${item.id}`);
    setLibraryId(null);
    setCustomBase(null);
    setOverrides(emptyOverrides());
    setAdjustments(defaultAdjustments);
    setAccentIndex(4);
  }

  function chooseSample(id: string) {
    const wallpaper = WALLPAPERS.find((item) => item.id === id);
    if (!wallpaper) return;
    setSampleId(id);
    setWallpaperSrc(wallpaper.src);
    setWallpaperName(wallpaper.name);
    setThemeName(wallpaper.name);
    setLibraryId(null);
    setCustomBase(null);
    setOverrides(emptyOverrides());
  }

  function chooseMode(next: ExtractMode) {
    setMode(next);
    setLibraryId(null);
    setCustomBase(null);
    setOverrides(emptyOverrides());
  }

  function chooseLibrary(id: string) {
    const theme = themeById(id);
    setLibraryId(id);
    setCustomBase(null);
    setOverrides(emptyOverrides());
    setAdjustments(defaultAdjustments);
    setLight(theme.light);
    setThemeName(theme.name);
    setAccentIndex(4);
  }

  function updateImage<K extends keyof ImageAdjustments>(key: K, value: ImageAdjustments[K]) {
    setPresetId(null);
    setImageAdj((current) => ({ ...current, [key]: value }));
    if (liveExtract) setOverrides(emptyOverrides());
  }

  function updatePalette<K extends keyof PaletteAdjustments>(key: K, value: PaletteAdjustments[K]) {
    setAdjustments((current) => ({ ...current, [key]: value }));
  }

  function editColor(index: number, hex: string) {
    setOverrides((current) => current.map((item, itemIndex) => (itemIndex === index ? hex : item)));
    setAccentIndex(index);
  }

  async function downloadScript() {
    setExporting(true);
    try {
      const wallpaperBase64 = await renderJpegBase64(wallpaperSrc, imageAdj);
      const script = powershellScript({
        name: themeName || "Aether",
        colors,
        accent,
        light,
        taskbar,
        titleBars,
        transparency,
        wallpaperBase64,
      });
      downloadFile("aether-theme.ps1", script, "text/plain;charset=utf-8");
      toast.success("Скрипт скачан. На Windows запусти его в PowerShell.");
    } catch {
      toast.error("Не удалось собрать скрипт из этих обоев.");
    } finally {
      setExporting(false);
    }
  }

  function downloadTerminal() {
    const scheme = terminalScheme(themeName || "Aether", colors);
    downloadFile(
      "aether-terminal.json",
      JSON.stringify(scheme, null, 2),
      "application/json",
    );
    toast.success("Схема терминала скачана.");
  }

  function downloadCode() {
    downloadFile(
      "aether-vscode.json",
      JSON.stringify(vscodeSnippet(themeName || "Aether", colors, accent), null, 2),
      "application/json",
    );
    toast.success("Фрагмент для VS Code скачан.");
  }

  function downloadThemeFile() {
    downloadFile(
      "aether.theme",
      windowsThemeFile(themeName || "Aether", accent),
      "text/plain;charset=utf-8",
    );
    toast.success("Файл темы скачан. Надёжнее всё же скрипт: он сам кладёт обои.");
  }

  async function copyPalette() {
    const payload = Object.fromEntries(ANSI_NAMES.map((name, index) => [name, colors[index]]));
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast.success("Палитра скопирована.");
  }

  async function saveBlueprint() {
    const name = draftName.trim() || themeName || "Aether";
    let thumb: string | undefined;
    try {
      const raw = await renderJpegBase64(wallpaperSrc, imageAdj, 480, 0.6);
      thumb = `data:image/jpeg;base64,${raw}`;
    } catch {
      thumb = undefined;
    }
    const next: Blueprint = {
      id: crypto.randomUUID(),
      name,
      colors,
      accentIndex,
      light,
      taskbar,
      titleBars,
      transparency,
      blurWall,
      createdAt: Date.now(),
      thumb,
    };
    writeBlueprints([next, ...blueprints]);
    setSaveOpen(false);
    toast.success("Чертёж сохранён в этом браузере.");
  }

  function applyBlueprint(blueprint: Blueprint) {
    setCustomBase(blueprint.colors);
    setLibraryId(null);
    setOverrides(emptyOverrides());
    setAdjustments(defaultAdjustments);
    setAccentIndex(blueprint.accentIndex);
    setLight(blueprint.light);
    setTaskbar(blueprint.taskbar);
    setTitleBars(blueprint.titleBars);
    setTransparency(blueprint.transparency);
    setBlurWall(blueprint.blurWall);
    setThemeName(blueprint.name);
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex shrink-0 items-center gap-1 border-b px-3 py-2 sm:gap-2 sm:px-4">
        <div className="mr-2 flex items-center gap-2">
          <Mark />
          <div className="font-display text-sm tracking-[0.18em]">AETHER</div>
        </div>
        <nav className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
          {(
            [
              ["editor", "Editor"],
              ["wallhaven", "Wallhaven"],
              ["github", "GitHub"],
              ["local", "Local"],
              ["favorites", "Favorites"],
              ["blueprints", "Blueprints"],
              ["omarchy", "Omarchy"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={view === id ? "secondary" : "ghost"}
              className={cn(view === id && "text-primary")}
              onClick={() => setView(id)}
            >
              {label}
            </Button>
          ))}
        </nav>
        {view === "editor" ? (
        <Input
          value={themeName}
          onChange={(event) => setThemeName(event.target.value)}
          aria-label="Название темы"
          className="hidden max-w-56 md:block"
        />
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {view === "editor" ? (
          <div className="flex rounded-lg bg-muted p-0.5">
            <Button
              type="button"
              size="sm"
              variant={light ? "ghost" : "secondary"}
              onClick={() => {
                setLight(false);
                setLibraryId(null);
                setCustomBase(null);
                setOverrides(emptyOverrides());
              }}
            >
              Тёмная
            </Button>
            <Button
              type="button"
              size="sm"
              variant={light ? "secondary" : "ghost"}
              onClick={() => {
                setLight(true);
                setLibraryId(null);
                setCustomBase(null);
                setOverrides(emptyOverrides());
              }}
            >
              Светлая
            </Button>
          </div>
          ) : null}
          {view === "editor" ? (
          <Button type="button" onClick={downloadScript} disabled={exporting}>
            <Download />
            {exporting ? (
              "Собираю…"
            ) : (
              <>
                Скрипт
                <span className="hidden sm:inline"> для Windows</span>
              </>
            )}
          </Button>
          ) : null}
        </div>
      </header>

      {view === "wallhaven" || view === "favorites" ? (
        <WallhavenBrowser key={view} onPick={pickWallhaven} onlyFavorites={view === "favorites"} />
      ) : view === "local" ? (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="mb-3 text-sm text-muted-foreground">Local wallpapers. Drop your own file or pick a starter.</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {WALLPAPERS.map((wallpaper) => (
              <button
                key={wallpaper.id}
                type="button"
                onClick={() => {
                  chooseSample(wallpaper.id);
                  setView("editor");
                }}
                className="overflow-hidden rounded-lg text-left ring-1 ring-white/10 hover:ring-primary"
              >
                <Image src={wallpaper.src} alt="" width={320} height={200} unoptimized className="aspect-video h-auto w-full object-cover" />
                <span className="block truncate px-2 py-1 text-xs">{wallpaper.name}</span>
              </button>
            ))}
          </div>
          <Button type="button" className="mt-4" onClick={() => fileRef.current?.click()}>
            <ImagePlus />
            Choose file
          </Button>
        </div>
      ) : view === "blueprints" ? (
        <div className="min-h-0 flex-1 space-y-2 overflow-auto p-4">
          {blueprints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blueprints yet. Save one from the editor.</p>
          ) : (
            blueprints.map((blueprint) => (
              <button
                key={blueprint.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted"
                onClick={() => {
                  applyBlueprint(blueprint);
                  setView("editor");
                }}
              >
                <span className="flex-1 truncate text-sm">{blueprint.name}</span>
                <span className="flex gap-0.5">
                  {blueprint.colors.slice(0, 8).map((color, index) => (
                    <span key={`${blueprint.id}-${index}`} className="size-3 rounded-full" style={{ background: color }} />
                  ))}
                </span>
              </button>
            ))
          )}
        </div>
      ) : view === "github" ? (
        <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
          <p className="max-w-xl text-sm text-muted-foreground">
            Export the current palette for Windows Terminal, VS Code, and the Windows theme file.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={downloadTerminal}>Windows Terminal</Button>
            <Button type="button" variant="secondary" onClick={downloadCode}>VS Code</Button>
            <Button type="button" variant="secondary" onClick={downloadThemeFile}>.theme</Button>
          </div>
        </div>
      ) : view === "omarchy" ? (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <p className="mb-3 max-w-xl text-sm text-muted-foreground">
            Wallpapers come from Wallhaven. These are ready-made color themes.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {LIBRARY.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => {
                  chooseLibrary(theme.id);
                  setView("editor");
                }}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-left ring-1 ring-white/10 hover:ring-primary"
              >
                <span className="flex-1 truncate text-sm">{theme.name}</span>
                <span className="flex gap-0.5">
                  {theme.colors.slice(0, 8).map((color, index) => (
                    <span key={`${theme.id}-om-${index}`} className="size-3 rounded-full" style={{ background: color }} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto p-3 lg:grid-cols-[280px_minmax(0,1fr)_340px] lg:overflow-hidden">
        <aside className="space-y-5 lg:overflow-y-auto lg:pr-1">
          <section>
            <SectionTitle>Обои</SectionTitle>
            <Button type="button" variant="secondary" className="w-full justify-start" onClick={() => setView("wallhaven")}>
              Каталог Wallhaven
            </Button>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Общая библиотека — Wallhaven. Ключ API необязателен и задаётся шестерёнкой. Восемь картинок ниже работают без сети.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {WALLPAPERS.map((wallpaper) => (
                <button
                  key={wallpaper.id}
                  type="button"
                  onClick={() => chooseSample(wallpaper.id)}
                  className={cn(
                    "overflow-hidden rounded-lg text-left ring-1 ring-white/10",
                    sampleId === wallpaper.id && "ring-2 ring-primary",
                  )}
                >
                  <Image
                  src={wallpaper.src}
                  alt=""
                  width={320}
                  height={200}
                  unoptimized
                  className="aspect-[16/10] h-auto w-full object-cover"
                />
                  <span className="block truncate px-1.5 py-1 text-[11px]">{wallpaper.name}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "flex aspect-[16/10] flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-[11px] text-muted-foreground",
                  uploadUrl && sampleId === "" && "border-primary text-foreground",
                )}
              >
                <ImagePlus className="size-4" />
                Свой файл
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) openImage(file);
                event.target.value = "";
              }}
            />
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Можно перетащить картинку на превью или вставить её из буфера.
            </p>
          </section>

          <section>
            <SectionTitle
              extra={sampling ? "снимаю цвета…" : liveExtract ? wallpaperName : "палитра закреплена"}
            >
              Стиль
            </SectionTitle>
            <div className="space-y-1">
              {MODES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => chooseMode(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted",
                    liveExtract && mode === item.id && "bg-muted",
                  )}
                >
                  <span className="w-24 shrink-0 text-xs">{item.name}</span>
                  <span className="grid flex-1 grid-cols-8 gap-0.5">
                    {(strips?.[item.id] ?? colors.slice(0, 8)).map((color, index) => (
                      <span
                        key={`${item.id}-${index}`}
                        className="h-3 rounded-[2px]"
                        style={{ background: color }}
                      />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle>Библиотека</SectionTitle>
            <div className="space-y-1">
              {LIBRARY.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => chooseLibrary(theme.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted",
                    libraryId === theme.id && "bg-muted",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-xs">{theme.name}</span>
                  <span className="flex gap-0.5">
                    {theme.colors.slice(0, 6).map((color, index) => (
                      <span
                        key={`${theme.id}-${index}`}
                        className="size-2.5 rounded-full"
                        style={{ background: color }}
                      />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle>Чертежи</SectionTitle>
            {blueprints.length === 0 ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Сохранённых тем пока нет. Чертёж остаётся в этом браузере.
              </p>
            ) : (
              <div className="space-y-1">
                {blueprints.map((blueprint) => (
                  <div key={blueprint.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => applyBlueprint(blueprint)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                    >
                      {blueprint.thumb ? (
                        <Image
                        src={blueprint.thumb}
                        alt=""
                        width={32}
                        height={32}
                        unoptimized
                        className="size-8 rounded object-cover"
                      />
                      ) : null}
                      <span className="truncate text-xs">{blueprint.name}</span>
                    </button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Удалить ${blueprint.name}`}
                      onClick={() => writeBlueprints(blueprints.filter((item) => item.id !== blueprint.id))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>

        <main
          className={cn(
            "relative space-y-3 lg:overflow-y-auto lg:pr-1",
            dragging && "rounded-2xl ring-2 ring-primary",
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) openImage(file);
          }}
        >
          <WindowsDesktop
            wallpaper={wallpaperSrc}
            filter={filter}
            vignette={imageAdj.vignette}
            temperature={imageAdj.temperature}
            blurWall={blurWall}
            colors={colors}
            accent={accent}
            light={light}
            taskbarAccent={taskbar}
            titleAccent={titleBars}
            transparency={transparency}
            themeName={themeName || "Aether"}
          />
          {dragging && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-2xl bg-black/50 text-sm">
              Отпусти, чтобы снять цвета
            </div>
          )}

          <section className="rounded-2xl border bg-card/60 p-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <SectionTitle>Правка обоев</SectionTitle>
              <div className="ml-auto flex items-center gap-2">
                <Label htmlFor="blur-wall" className="text-xs font-normal text-muted-foreground">
                  Размыть на столе
                </Label>
                <Switch id="blur-wall" checked={blurWall} onCheckedChange={setBlurWall} size="sm" />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setImageAdj(defaultImageAdjustments);
                    setPresetId(null);
                  }}
                >
                  <RotateCcw />
                  Сброс
                </Button>
              </div>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {IMAGE_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  size="xs"
                  variant={presetId === preset.id ? "secondary" : "outline"}
                  onClick={() => {
                    setPresetId(preset.id);
                    setImageAdj(preset.values);
                    if (liveExtract) setOverrides(emptyOverrides());
                  }}
                >
                  {preset.name}
                </Button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TuneSlider label="Яркость" value={imageAdj.brightness} min={50} max={150} reset={100} onChange={(value) => updateImage("brightness", value)} />
              <TuneSlider label="Контраст" value={imageAdj.contrast} min={50} max={150} reset={100} onChange={(value) => updateImage("contrast", value)} />
              <TuneSlider label="Насыщенность" value={imageAdj.saturation} min={0} max={160} reset={100} onChange={(value) => updateImage("saturation", value)} />
              <TuneSlider label="Оттенок" value={imageAdj.hue} min={-180} max={180} reset={0} onChange={(value) => updateImage("hue", value)} />
              <TuneSlider label="Размытие" value={imageAdj.blur} min={0} max={8} step={0.1} reset={0} onChange={(value) => updateImage("blur", value)} />
              <TuneSlider label="Виньетка" value={Math.round(imageAdj.vignette * 100)} min={0} max={100} reset={0} onChange={(value) => updateImage("vignette", value / 100)} />
              <TuneSlider label="Температура" value={Math.round(imageAdj.temperature * 100)} min={-100} max={100} reset={0} onChange={(value) => updateImage("temperature", value / 100)} />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Цвета снимаются с отредактированной картинки. «Размыть на столе» мутит только
              превью рабочего стола, палитра остаётся от чёткого кадра.
            </p>
          </section>
        </main>

        <aside className="space-y-4 lg:overflow-y-auto lg:pr-1">
          <section>
            <div className="mb-2 flex items-center gap-2">
              <SectionTitle>Палитра</SectionTitle>
              {sampling && <span className="text-[11px] text-muted-foreground">считаю…</span>}
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="ml-auto"
                onClick={() => {
                  setAdjustments(defaultAdjustments);
                  setOverrides(emptyOverrides());
                }}
              >
                Сбросить тон
              </Button>
            </div>
            <div className="mb-2 grid grid-cols-8 gap-1">
              {colors.slice(0, 8).map((color, index) => (
                <button
                  key={`top-${index}`}
                  type="button"
                  title={ANSI_NAMES[index]}
                  onClick={() => setAccentIndex(index)}
                  className={cn(
                    "h-7 rounded-md ring-1 ring-black/20",
                    accentIndex === index && "ring-2 ring-white",
                  )}
                  style={{ background: color }}
                />
              ))}
            </div>
            <div className="mb-3 grid grid-cols-8 gap-1">
              {colors.slice(8).map((color, index) => (
                <button
                  key={`bot-${index}`}
                  type="button"
                  title={ANSI_NAMES[index + 8]}
                  onClick={() => setAccentIndex(index + 8)}
                  className={cn(
                    "h-7 rounded-md ring-1 ring-black/20",
                    accentIndex === index + 8 && "ring-2 ring-white",
                  )}
                  style={{ background: color }}
                />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {colors.map((color, index) => {
                const rgb = hexToRgb(color);
                const bg = hexToRgb(colors[0]);
                const grade = rgb && bg ? contrastGrade(rgb, bg) : "низкий";
                return (
                  <div
                    key={`row-${index}`}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-1.5 py-1",
                      accentIndex === index && "bg-muted",
                    )}
                  >
                    <label className="relative size-7 shrink-0 cursor-pointer">
                      <span
                        className="block size-7 rounded-md ring-1 ring-white/15"
                        style={{ background: color }}
                      />
                      <input
                        type="color"
                        value={color}
                        aria-label={ANSI_NAMES[index]}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        onChange={(event) => editColor(index, event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setAccentIndex(index)}
                    >
                      <span className="block truncate text-xs">{ANSI_NAMES[index]}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{color}</span>
                    </button>
                    {index !== 0 && (
                      <Badge variant={grade === "низкий" ? "destructive" : "outline"}>{grade}</Badge>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Клик по цвету делает его акцентом Windows. Клик по плашке открывает пипетку.
              Оценка контраста — цвет против фона.
            </p>
          </section>

          <section className="space-y-2 rounded-2xl border bg-card/60 p-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="taskbar">Акцент на панели задач и Пуске</Label>
              <Switch id="taskbar" checked={taskbar} onCheckedChange={setTaskbar} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="titles">Акцент на заголовках окон</Label>
              <Switch id="titles" checked={titleBars} onCheckedChange={setTitleBars} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="glass">Прозрачность</Label>
              <Switch id="glass" checked={transparency} onCheckedChange={setTransparency} />
            </div>
            {light && taskbar && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                В светлой теме Windows панель задач почти не красится акцентом. Для цветной
                панели оставь тёмный режим.
              </p>
            )}
          </section>

          <section className="grid gap-3">
            <TuneSlider label="Сочность" value={adjustments.vibrance} min={-50} max={50} reset={0} onChange={(value) => updatePalette("vibrance", value)} />
            <TuneSlider label="Насыщенность" value={adjustments.saturation} min={-100} max={100} reset={0} onChange={(value) => updatePalette("saturation", value)} />
            <TuneSlider label="Контраст" value={adjustments.contrast} min={-30} max={30} reset={0} onChange={(value) => updatePalette("contrast", value)} />
            <TuneSlider label="Яркость" value={adjustments.brightness} min={-30} max={30} reset={0} onChange={(value) => updatePalette("brightness", value)} />
            <TuneSlider label="Тени" value={adjustments.shadows} min={-50} max={50} reset={0} onChange={(value) => updatePalette("shadows", value)} />
            <TuneSlider label="Света" value={adjustments.highlights} min={-50} max={50} reset={0} onChange={(value) => updatePalette("highlights", value)} />
            <TuneSlider label="Сдвиг тона" value={adjustments.hue} min={-180} max={180} reset={0} onChange={(value) => updatePalette("hue", value)} />
            <TuneSlider label="Температура" value={adjustments.temperature} min={-50} max={50} reset={0} onChange={(value) => updatePalette("temperature", value)} />
            <p className="text-[11px] text-muted-foreground">Число справа сбрасывает ползунок.</p>
          </section>

          <section className="space-y-2">
            <SectionTitle>Забрать на Windows</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={downloadTerminal}>
                Терминал
              </Button>
              <Button type="button" variant="outline" onClick={downloadCode}>
                VS Code
              </Button>
              <Button type="button" variant="outline" onClick={downloadThemeFile}>
                Файл .theme
              </Button>
              <Button type="button" variant="outline" onClick={copyPalette}>
                Копировать
              </Button>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                setDraftName(themeName);
                setSaveOpen(true);
              }}
            >
              <Save />
              Сохранить чертёж
            </Button>
            <ol className="list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-muted-foreground">
              <li>Скачай скрипт и запусти его в PowerShell. Права администратора не нужны.</li>
              <li>Он положит обои в «Изображения\Aether», покрасит акцент и переключит светлую или тёмную тему.</li>
              <li>Схему терминала добавь в settings.json Windows Terminal, в массив schemes.</li>
              <li>Фрагмент VS Code вставь в settings.json редактора.</li>
            </ol>
          </section>
        </aside>
      </div>
      )}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сохранить чертёж</DialogTitle>
            <DialogDescription>
              Тема останется в этом браузере. На Windows её всё равно нужно применить скриптом.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            aria-label="Имя чертежа"
          />
          <DialogFooter>
            <Button type="button" onClick={saveBlueprint}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionTitle({
  children,
  extra,
}: {
  children: ReactNode;
  extra?: string;
}) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {children}
      </h2>
      {extra ? <span className="truncate text-[11px] text-foreground/50">{extra}</span> : null}
    </div>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1c1915" />
      <rect x="6" y="8" width="8" height="16" rx="2" fill="#e07a3d" />
      <rect x="16" y="8" width="4" height="16" rx="2" fill="#f2c14e" />
      <rect x="22" y="8" width="4" height="16" rx="2" fill="#7ec8c3" />
    </svg>
  );
}
