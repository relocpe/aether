export type RGB = { r: number; g: number; b: number };
export type HSL = { h: number; s: number; l: number };

export function clamp(n: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n));
}

export function wrapHue(h: number) {
  return ((h % 360) + 360) % 360;
}

export function hueDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

export function hueDistance(a: number, b: number) {
  return Math.abs(hueDelta(a, b));
}

export function rgbToHex({ r, g, b }: RGB) {
  const byte = (n: number) =>
    Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`.toLowerCase();
}

export function hexToRgb(hex: string): RGB | null {
  const m = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case rn:
      h = (gn - bn) / d + (gn < bn ? 6 : 0);
      break;
    case gn:
      h = (bn - rn) / d + 2;
      break;
    default:
      h = (rn - gn) / d + 4;
  }
  return { h: h * 60, s, l };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const hue = wrapHue(h);
  const sat = clamp(s);
  const lig = clamp(l);
  if (sat === 0) {
    const v = Math.round(lig * 255);
    return { r: v, g: v, b: v };
  }
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = hue / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = lig - c / 2;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function linearize(channel: number) {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(rgb: RGB) {
  return (
    0.2126 * linearize(rgb.r) +
    0.7152 * linearize(rgb.g) +
    0.0722 * linearize(rgb.b)
  );
}

export function contrastRatio(a: RGB, b: RGB) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export type ContrastGrade = "AAA" | "AA" | "A" | "низкий";

export function contrastGrade(fg: RGB, bg: RGB): ContrastGrade {
  const ratio = contrastRatio(fg, bg);
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "A";
  return "низкий";
}

export function inkFor(rgb: RGB) {
  return relativeLuminance(rgb) > 0.42 ? "#1c1915" : "#f6f1e8";
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

export function average(pixels: RGB[]): RGB {
  if (pixels.length === 0) return { r: 0, g: 0, b: 0 };
  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of pixels) {
    r += p.r;
    g += p.g;
    b += p.b;
  }
  const n = pixels.length;
  return { r: r / n, g: g / n, b: b / n };
}

export function signedDword(unsigned: number) {
  const u = unsigned >>> 0;
  return u > 0x7fffffff ? u - 0x100000000 : u;
}

/** Explorer accent keys store 0xAABBGGRR. */
export function abgrDword(rgb: RGB, alpha = 0xff) {
  return signedDword((alpha << 24) | (rgb.b << 16) | (rgb.g << 8) | rgb.r);
}

/** DWM ColorizationColor stores 0xAARRGGBB. */
export function argbDword(rgb: RGB, alpha = 0xc4) {
  return signedDword((alpha << 24) | (rgb.r << 16) | (rgb.g << 8) | rgb.b);
}

export function ensureContrast(color: RGB, bg: RGB, minRatio: number) {
  let hsl = rgbToHsl(color);
  const bgIsLight = relativeLuminance(bg) > 0.45;
  const dir = bgIsLight ? -1 : 1;
  for (let i = 0; i < 28; i++) {
    if (contrastRatio(hslToRgb(hsl), bg) >= minRatio) break;
    hsl = { ...hsl, l: clamp(hsl.l + dir * 0.03, 0.04, 0.97) };
  }
  return hslToRgb(hsl);
}
