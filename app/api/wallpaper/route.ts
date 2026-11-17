import { connection } from "next/server";

const HOSTS = new Set(["w.wallhaven.cc", "th.wallhaven.cc"]);
const MAX_BYTES = 28_000_000;

function safeWallhavenUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;
  if (url.pathname.includes("..") || url.search || url.hash) return null;
  if (!/\.(jpe?g|png|webp)$/i.test(url.pathname)) return null;
  return url;
}

export async function GET(request: Request) {
  await connection();
  const target = safeWallhavenUrl(new URL(request.url).searchParams.get("url") ?? "");
  if (!target) return new Response("Некорректный адрес обоев", { status: 400 });

  const upstream = await fetch(target, { redirect: "error", cache: "force-cache" });
  if (!upstream.ok || !upstream.body) {
    return new Response("Обои не скачались", { status: upstream.status || 502 });
  }
  const length = Number(upstream.headers.get("content-length") ?? "0");
  if (length > MAX_BYTES) return new Response("Файл слишком большой", { status: 413 });
  const type = upstream.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) return new Response("Это не изображение", { status: 415 });

  return new Response(upstream.body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400",
      ...(length > 0 ? { "Content-Length": String(length) } : {}),
    },
  });
}
