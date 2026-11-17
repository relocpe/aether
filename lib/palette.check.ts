import { contrastRatio, hexToRgb, hueDistance, rgbToHsl } from "./color";
import { defaultAdjustments, paletteFromPixels, applyAdjustments } from "./palette";

function push(pixels: { r: number; g: number; b: number }[], color: { r: number; g: number; b: number }, n: number) {
  for (let i = 0; i < n; i++) pixels.push(color);
}

const pixels: { r: number; g: number; b: number }[] = [];
push(pixels, { r: 18, g: 14, b: 32 }, 5000);
push(pixels, { r: 214, g: 64, b: 78 }, 900);
push(pixels, { r: 52, g: 168, b: 92 }, 900);
push(pixels, { r: 224, g: 186, b: 64 }, 700);
push(pixels, { r: 64, g: 112, b: 214 }, 1000);
push(pixels, { r: 196, g: 72, b: 176 }, 600);
push(pixels, { r: 42, g: 186, b: 186 }, 600);
push(pixels, { r: 232, g: 228, b: 220 }, 500);

const dark = paletteFromPixels(pixels, "normal", false);
const light = paletteFromPixels(pixels, "normal", true);
const colorful = paletteFromPixels(pixels, "colorful", false);
const muted = paletteFromPixels(pixels, "muted", false);

function assert(cond: unknown, message: string) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

assert(dark.length === 16, "dark palette has 16 colors");
assert(light.length === 16, "light palette has 16 colors");

const bg = rgbToHsl(dark[0]);
const fg = rgbToHsl(dark[7]);
assert(bg.l < fg.l, "dark background is darker than foreground");
assert(rgbToHsl(light[0]).l > rgbToHsl(light[15]).l, "light mode swaps anchors");

const redHue = rgbToHsl(dark[1]).h;
assert(hueDistance(redHue, 6) < 28, `red hue near 6, got ${redHue}`);
const greenHue = rgbToHsl(dark[2]).h;
assert(hueDistance(greenHue, 132) < 28, `green hue near 132, got ${greenHue}`);
const blueHue = rgbToHsl(dark[4]).h;
assert(hueDistance(blueHue, 226) < 36, `blue hue near 226, got ${blueHue}`);
assert(hueDistance(rgbToHsl(dark[5]).h, rgbToHsl(dark[1]).h) > 40, "magenta is not a copy of red");

const bgRgb = dark[0];
assert(contrastRatio(dark[7], bgRgb) >= 7, "foreground contrast");
assert(contrastRatio(dark[1], bgRgb) >= 3, "red contrast");

function meanSat(colors: { r: number; g: number; b: number }[]) {
  const body = colors.slice(1, 7);
  return body.reduce((sum, color) => sum + rgbToHsl(color).s, 0) / body.length;
}
assert(meanSat(colorful) > meanSat(muted) + 0.2, "colorful is more saturated than muted");

const adjusted = applyAdjustments(dark, { ...defaultAdjustments, saturation: 40 }, false);
assert(adjusted.length === 16, "adjustments keep 16 colors");
assert(hexToRgb("#ff00aa"), "hex parse");

if (process.exitCode) {
  console.error("palette checks failed");
} else {
  console.log("palette checks ok");
  console.log("dark", dark.map((c) => `${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)}`).join(" | "));
}
