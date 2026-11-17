import { abgrDword, argbDword, hexToRgb, mix, rgbToHex, type RGB } from "./color";

const TERMINAL_KEYS = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "purple",
  "cyan",
  "white",
  "brightBlack",
  "brightRed",
  "brightGreen",
  "brightYellow",
  "brightBlue",
  "brightPurple",
  "brightCyan",
  "brightWhite",
] as const;

function shade(rgb: RGB, toward: number) {
  const target = toward > 0 ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
  return mix(rgb, target, Math.abs(toward));
}

export function accentShades(hex: string) {
  const rgb = hexToRgb(hex) ?? { r: 0, g: 120, b: 215 };
  return [
    shade(rgb, 0.72),
    shade(rgb, 0.48),
    shade(rgb, 0.24),
    rgb,
    shade(rgb, -0.18),
    shade(rgb, -0.38),
    shade(rgb, -0.58),
    rgb,
  ];
}

export function terminalScheme(name: string, colors: string[]) {
  const scheme: Record<string, string> = {
    name,
    background: colors[0],
    foreground: colors[7],
    cursorColor: colors[15],
    selectionBackground: colors[8],
  };
  TERMINAL_KEYS.forEach((key, index) => {
    scheme[key] = colors[index] ?? colors[0];
  });
  return scheme;
}

export function vscodeSnippet(name: string, colors: string[], accent: string) {
  const [bg, red, green, yellow, blue, magenta, cyan, fg, brightBlack] = colors;
  return {
    "workbench.colorCustomizations": {
      "editor.background": bg,
      "editor.foreground": fg,
      "editorCursor.foreground": colors[15],
      "editor.selectionBackground": `${blue}55`,
      "editorLineNumber.foreground": brightBlack,
      "editorLineNumber.activeForeground": fg,
      "sideBar.background": bg,
      "sideBar.foreground": fg,
      "activityBar.background": bg,
      "activityBar.foreground": accent,
      "titleBar.activeBackground": bg,
      "titleBar.activeForeground": fg,
      "statusBar.background": accent,
      "statusBar.foreground": "#111111",
      "tab.activeBorder": accent,
      "focusBorder": accent,
      "terminal.background": bg,
      "terminal.foreground": fg,
      "terminal.ansiBlack": colors[0],
      "terminal.ansiRed": red,
      "terminal.ansiGreen": green,
      "terminal.ansiYellow": yellow,
      "terminal.ansiBlue": blue,
      "terminal.ansiMagenta": magenta,
      "terminal.ansiCyan": cyan,
      "terminal.ansiWhite": fg,
      "terminal.ansiBrightBlack": colors[8],
      "terminal.ansiBrightRed": colors[9],
      "terminal.ansiBrightGreen": colors[10],
      "terminal.ansiBrightYellow": colors[11],
      "terminal.ansiBrightBlue": colors[12],
      "terminal.ansiBrightMagenta": colors[13],
      "terminal.ansiBrightCyan": colors[14],
      "terminal.ansiBrightWhite": colors[15],
    },
    "editor.tokenColorCustomizations": {
      textMateRules: [
        { scope: "comment", settings: { foreground: brightBlack, fontStyle: "italic" } },
        { scope: "string", settings: { foreground: green } },
        { scope: "constant.numeric", settings: { foreground: yellow } },
        { scope: "keyword", settings: { foreground: magenta } },
        { scope: "entity.name.function", settings: { foreground: blue } },
        { scope: "variable", settings: { foreground: fg } },
        { scope: "entity.name.type", settings: { foreground: cyan } },
        { scope: "invalid", settings: { foreground: red } },
      ],
    },
    _aether: name,
  };
}

export function windowsThemeFile(name: string, accent: string) {
  const rgb = hexToRgb(accent) ?? { r: 0, g: 120, b: 215 };
  const colorization = (0xc4000000 | (rgb.b << 16) | (rgb.g << 8) | rgb.r) >>> 0;
  const hilight = `${rgb.r} ${rgb.g} ${rgb.b}`;
  return `; Aether for Windows
; ${name}

[Theme]
DisplayName=${name}

[Control Panel\\Desktop]
Wallpaper=%USERPROFILE%\\Pictures\\Aether\\wallpaper.jpg
TileWallpaper=0
WallpaperStyle=10
Pattern=

[VisualStyles]
Path=%SystemRoot%\\resources\\Themes\\Aero\\Aero.msstyles
ColorStyle=NormalColor
Size=NormalSize
AutoColorization=0
ColorizationColor=0x${colorization.toString(16).padStart(8, "0")}
VisualStyleVersion=10

[MasterThemeSelector]
MTSM=RJSPBS

[Control Panel\\Colors]
Hilight=${hilight}
HotTrackingColor=${hilight}
`;
}

export type ApplyOptions = {
  name: string;
  colors: string[];
  accent: string;
  light: boolean;
  taskbar: boolean;
  titleBars: boolean;
  transparency: boolean;
  wallpaperBase64: string | null;
};

export function powershellScript(options: ApplyOptions) {
  const accent = hexToRgb(options.accent) ?? { r: 0, g: 120, b: 215 };
  const shades = accentShades(options.accent);
  const paletteBytes = shades
    .flatMap((color) => [
      Math.round(color.r),
      Math.round(color.g),
      Math.round(color.b),
      255,
    ])
    .join(",");
  const abgr = abgrDword(accent, 0xff);
  const argb = argbDword(accent, 0xc4);
  const solid = argbDword(accent, 0xff);
  const wallpaper = options.wallpaperBase64
    ? `
$destDir = Join-Path $env:USERPROFILE 'Pictures\\Aether'
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
$wallPath = Join-Path $destDir 'wallpaper.jpg'
$bytes = [Convert]::FromBase64String(($wallpaperB64 -replace '\\s',''))
[System.IO.File]::WriteAllBytes($wallPath, $bytes)

Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public static class AetherWall {
  [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
}
"@
Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name WallpaperStyle -Value '10'
Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name TileWallpaper -Value '0'
[AetherWall]::SystemParametersInfo(20, 0, $wallPath, 3) | Out-Null
Write-Host "Обои: $wallPath"
`
    : `
Write-Host "Картинка обоев не вложена — меняю только цвета."
`;

  const wrapped = options.wallpaperBase64
    ? options.wallpaperBase64.replace(/(.{120})/g, "$1\n")
    : "";
  const b64Block = options.wallpaperBase64
    ? `$wallpaperB64 = @'\n${wrapped}\n'@\n`
    : `$wallpaperB64 = ''\n`;

  const body = `# Aether for Windows
# Тема: ${options.name.replace(/[\r\n]/g, " ")}
# Запуск из PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\\aether-theme.ps1
# Скрипт пишет только в HKCU и в папку Pictures\\Aether. Права администратора не нужны.

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

${b64Block}
${wallpaper}

$accentKey = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent'
$personalize = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'
$dwm = 'HKCU:\\Software\\Microsoft\\Windows\\DWM'
New-Item -Path $accentKey -Force | Out-Null

$palette = [byte[]](${paletteBytes})
Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name AutoColorization -Value 0
Set-ItemProperty -Path $accentKey -Name AccentPalette -Type Binary -Value $palette
Set-ItemProperty -Path $accentKey -Name AccentColorMenu -Type DWord -Value ${abgr}
Set-ItemProperty -Path $accentKey -Name StartColorMenu -Type DWord -Value ${abgr}

$light = ${options.light ? 1 : 0}
Set-ItemProperty -Path $personalize -Name AppsUseLightTheme -Type DWord -Value $light
Set-ItemProperty -Path $personalize -Name SystemUsesLightTheme -Type DWord -Value $light
Set-ItemProperty -Path $personalize -Name EnableTransparency -Type DWord -Value ${options.transparency ? 1 : 0}
Set-ItemProperty -Path $personalize -Name ColorPrevalence -Type DWord -Value ${options.taskbar ? 1 : 0}

Set-ItemProperty -Path $dwm -Name ColorPrevalence -Type DWord -Value ${options.titleBars ? 1 : 0}
Set-ItemProperty -Path $dwm -Name AccentColor -Type DWord -Value ${abgr}
Set-ItemProperty -Path $dwm -Name ColorizationColor -Type DWord -Value ${argb}
Set-ItemProperty -Path $dwm -Name ColorizationAfterglow -Type DWord -Value ${argb}
Set-ItemProperty -Path $dwm -Name ColorizationColorBalance -Type DWord -Value 89
Set-ItemProperty -Path $dwm -Name EnableWindowColorization -Type DWord -Value ${options.titleBars ? 1 : 0}
Set-ItemProperty -Path $dwm -Name AccentColorInactive -Type DWord -Value ${solid} -ErrorAction SilentlyContinue

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class AetherNotify {
  [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)]
  public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr result);
}
"@
$result = [UIntPtr]::Zero
[AetherNotify]::SendMessageTimeout([IntPtr]0xffff, 0x001A, [UIntPtr]::Zero, 'ImmersiveColorSet', 2, 1500, [ref]$result) | Out-Null

Write-Host ''
Write-Host 'Тема «${options.name.replace(/'/g, "''")}» записана.'
Write-Host 'Акцент: ${rgbToHex(accent)}'
if (${options.light ? "$true" : "$false"}) {
  Write-Host 'Светлая тема Windows. Акцент на панели задач система показывает в основном в тёмном режиме.'
} else {
  Write-Host 'Тёмная тема Windows.'
}
Write-Host 'Если панель задач не перекрасилась, выйди из учётной записи и зайди снова.'
Write-Host 'Windows Terminal и VS Code этим скриптом не трогаются — для них есть отдельные файлы.'
`;

  return `\uFEFF${body}`;
}
