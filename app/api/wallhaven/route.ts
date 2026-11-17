import { connection } from "next/server";
import type { WallhavenPage, WallhavenWallpaper } from "@/lib/wallhaven";

const SORTS = new Set(["toplist", "date_added", "relevance", "random", "views", "favorites"]);
const RANGES = new Set(["1d", "3d", "1w", "1M", "3M", "6M", "1y"]);
const RESOLUTIONS = new Set(["", "1920x1080", "2560x1440", "3840x2160"]);

type Upstream = {
  data?: Array<{
    id?: string;
    url?: string;
    path?: string;
    resolution?: string;
    file_size?: number;
    category?: string;
    purity?: string;
    thumbs?: { small?: string; large?: string; original?: string };
  }>;
  meta?: { current_page?: number; last_page?: number; total?: number };
  error?: string;
};

function bits(value: string | null, fallback: string) {
  if (value && /^[01]{3}$/.test(value) && value !== "000") return value;
  return fallback;
}

function imageProxy(remote: string | undefined) {
  if (!remote) return "";
  return `/api/wallpaper?url=${encodeURIComponent(remote)}`;
}

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const sorting = SORTS.has(url.searchParams.get("sorting") ?? "")
    ? (url.searchParams.get("sorting") as string)
    : "toplist";
  const atleast = RESOLUTIONS.has(url.searchParams.get("atleast") ?? "")
    ? (url.searchParams.get("atleast") ?? "")
    : "1920x1080";
  const page = Math.min(200, Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1));
  const key = request.headers.get("x-wallhaven-key")?.trim() ?? "";
  if (key && !/^[A-Za-z0-9]{8,80}$/.test(key)) {
    return Response.json({ error: "Ключ Wallhaven выглядит неверно." }, { status: 400 });
  }

  const params = new URLSearchParams({
    q: (url.searchParams.get("q") ?? "").slice(0, 160),
    categories: bits(url.searchParams.get("categories"), "111"),
    purity: bits(url.searchParams.get("purity"), "100"),
    sorting,
    order: url.searchParams.get("order") === "asc" ? "asc" : "desc",
    page: String(page),
  });
  if (atleast) params.set("atleast", atleast);
  if (sorting === "toplist") {
    const range = url.searchParams.get("topRange") ?? "1M";
    params.set("topRange", RANGES.has(range) ? range : "1M");
  }
  if (key) params.set("apikey", key);

  let upstream: Response;
  try {
    upstream = await fetch(`https://wallhaven.cc/api/v1/search?${params}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch {
    return Response.json({ error: "Wallhaven не ответил. Проверь сеть." }, { status: 502 });
  }

  if (upstream.status === 429) {
    return Response.json(
      { error: "Wallhaven ограничил запросы. Подожди минуту или укажи API-ключ." },
      { status: 429 },
    );
  }
  if (!upstream.ok) {
    return Response.json({ error: "Поиск Wallhaven не прошёл." }, { status: 502 });
  }

  const body = (await upstream.json()) as Upstream;
  const items: WallhavenWallpaper[] = (body.data ?? [])
    .filter((item) => item.id && item.thumbs?.small && item.path)
    .map((item) => ({
      id: item.id as string,
      resolution: item.resolution || "",
      fileSize: item.file_size ?? 0,
      category: item.category || "",
      purity: item.purity || "sfw",
      page: item.url || `https://wallhaven.cc/w/${item.id}`,
      thumb: imageProxy(item.thumbs?.small),
      image: imageProxy(item.thumbs?.large || item.path),
    }));

  const result: WallhavenPage = {
    total: body.meta?.total ?? items.length,
    page: body.meta?.current_page ?? page,
    pages: body.meta?.last_page ?? 1,
    items,
  };
  return Response.json(result);
}
