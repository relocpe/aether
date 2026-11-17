import type { ImageAdjustments } from "./presets";
import type { RGB } from "./color";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = src;
  });
}

function paint(
  image: HTMLImageElement,
  width: number,
  height: number,
  adjustments: ImageAdjustments,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas");
  ctx.filter = [
    `brightness(${adjustments.brightness / 100})`,
    `contrast(${adjustments.contrast / 100})`,
    `saturate(${adjustments.saturation / 100})`,
    `hue-rotate(${adjustments.hue}deg)`,
    adjustments.blur > 0 ? `blur(${adjustments.blur}px)` : "",
  ]
    .filter(Boolean)
    .join(" ");
  ctx.drawImage(image, 0, 0, width, height);
  ctx.filter = "none";
  if (adjustments.temperature !== 0) {
    const warm = adjustments.temperature > 0;
    const alpha = Math.min(0.55, Math.abs(adjustments.temperature) * 0.38);
    ctx.fillStyle = warm
      ? `rgba(255, 132, 42, ${alpha})`
      : `rgba(48, 122, 255, ${alpha})`;
    ctx.globalCompositeOperation = "overlay";
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "source-over";
  }
  if (adjustments.vignette > 0) {
    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      width * 0.18,
      width / 2,
      height / 2,
      width * 0.72,
    );
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, `rgba(0,0,0,${adjustments.vignette * 0.88})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  return ctx;
}

export async function sampleWallpaper(
  src: string,
  adjustments: ImageAdjustments,
  maxEdge = 280,
) {
  const image = await loadImage(src);
  const scale = Math.min(maxEdge / image.width, maxEdge / image.height, 1);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const ctx = paint(image, width, height, adjustments);
  const data = ctx.getImageData(0, 0, width, height).data;
  const pixels: RGB[] = [];
  for (let i = 0; i < data.length; i += 16) {
    if (data[i + 3] < 200) continue;
    pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
  }
  return pixels;
}

export async function renderJpegBase64(
  src: string,
  adjustments: ImageAdjustments,
  maxEdge = 1600,
  quality = 0.82,
) {
  const image = await loadImage(src);
  const scale = Math.min(maxEdge / image.width, maxEdge / image.height, 1);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const ctx = paint(image, width, height, { ...adjustments, blur: adjustments.blur });
  const url = ctx.canvas.toDataURL("image/jpeg", quality);
  return url.split(",")[1] ?? "";
}
