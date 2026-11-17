"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { hexToRgb, inkFor } from "@/lib/color";

type DesktopProps = {
  wallpaper: string;
  filter: string;
  vignette: number;
  temperature: number;
  blurWall: boolean;
  colors: string[];
  accent: string;
  light: boolean;
  taskbarAccent: boolean;
  titleAccent: boolean;
  transparency: boolean;
  themeName: string;
};

function ink(hex: string) {
  const rgb = hexToRgb(hex);
  return rgb ? inkFor(rgb) : "#111";
}

export function WindowsDesktop({
  wallpaper,
  filter,
  vignette,
  temperature,
  blurWall,
  colors,
  accent,
  light,
  taskbarAccent,
  titleAccent,
  transparency,
  themeName,
}: DesktopProps) {
  const [clock, setClock] = useState("12:00");
  const [day, setDay] = useState("17 нояб.");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        new Intl.DateTimeFormat("ru-RU", {
          timeZone: "Europe/Moscow",
          hour: "2-digit",
          minute: "2-digit",
        }).format(now),
      );
      setDay(
        new Intl.DateTimeFormat("ru-RU", {
          timeZone: "Europe/Moscow",
          day: "numeric",
          month: "short",
        }).format(now),
      );
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const bg = colors[0] ?? "#1a1b26";
  const fg = colors[7] ?? "#c0caf5";
  const red = colors[1] ?? "#f7768e";
  const green = colors[2] ?? "#9ece6a";
  const yellow = colors[3] ?? "#e0af68";
  const blue = colors[4] ?? "#7aa2f7";
  const magenta = colors[5] ?? "#bb9af7";
  const cyan = colors[6] ?? "#7dcfff";
  const muted = colors[8] ?? "#414868";
  const titleBg = titleAccent ? accent : light ? "#f3f3f3" : "#1f1f1f";
  const titleFg = titleAccent ? ink(accent) : light ? "#1a1a1a" : "#f2f2f2";
  const taskbarBg = taskbarAccent
    ? transparency
      ? `color-mix(in srgb, ${accent} 70%, ${light ? "#f4f4f4" : "#12100e"})`
      : accent
    : light
      ? "rgba(243,243,243,0.88)"
      : "rgba(32,32,32,0.72)";
  const taskbarFg = taskbarAccent ? ink(accent) : light ? "#1a1a1a" : "#f3f3f3";
  const chrome = light ? "#f7f7f7" : bg;
  const warm = temperature > 0;

  return (
    <div className="@container relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10">
      <Image
        src={wallpaper}
        alt=""
        fill
        unoptimized
        className="object-cover"
        style={{
          filter: `${filter}${blurWall ? " blur(18px)" : ""}`,
          transform: blurWall ? "scale(1.08)" : undefined,
        }}
      />
      {temperature !== 0 && (
        <div
          className="absolute inset-0"
          style={{
            background: warm ? "rgb(255, 140, 40)" : "rgb(40, 120, 255)",
            opacity: Math.min(0.45, Math.abs(temperature) * 0.28),
            mixBlendMode: "overlay",
          }}
        />
      )}
      {vignette > 0 && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,${vignette * 0.75}) 100%)`,
          }}
        />
      )}

      <div className="absolute top-[4%] left-[2.2%] flex flex-col gap-[1.4cqw] text-white">
        <DeskIcon label="Этот компьютер">
          <MonitorIcon />
        </DeskIcon>
        <DeskIcon label="Корзина">
          <BinIcon />
        </DeskIcon>
        <DeskIcon label={themeName}>
          <FolderIcon accent={yellow} />
        </DeskIcon>
      </div>

      <section
        className="absolute top-[6%] left-[4%] flex w-[44%] flex-col overflow-hidden rounded-[1.1cqw] shadow-[0_18px_50px_rgba(0,0,0,0.35)] ring-1 ring-black/20"
        style={{ background: chrome, color: light ? "#1a1a1a" : fg, bottom: "14%" }}
      >
        <TitleBar title="Проводник" bg={titleBg} fg={titleFg} />
        <div className="flex min-h-0 flex-1 text-[1.35cqw]">
          <div
            className="w-[34%] space-y-[0.7cqw] px-[1.2cqw] py-[1cqw]"
            style={{ background: light ? "#f3f3f3" : `color-mix(in srgb, ${bg} 82%, black)` }}
          >
            {["Главная", "Галерея", "Рабочий стол", "Загрузки", "Изображения"].map((item, index) => (
              <div
                key={item}
                className="rounded-[0.5cqw] px-[0.8cqw] py-[0.45cqw]"
                style={
                  index === 0
                    ? { background: accent, color: ink(accent) }
                    : undefined
                }
              >
                {item}
              </div>
            ))}
          </div>
          <div className="flex-1 space-y-[0.8cqw] px-[1.4cqw] py-[1.1cqw]">
            <div className="text-[1.15cqw] opacity-60">Изображения / Aether</div>
            {[
              ["Обои", "JPG"],
              ["Палитра", "JSON"],
              ["Скрипт", "PS1"],
            ].map(([name, kind]) => (
              <div key={name} className="flex items-center gap-[1cqw]">
                <span className="size-[1.7cqw] shrink-0">
                  <FolderIcon accent={kind === "JPG" ? yellow : blue} />
                </span>
                <span>{name}</span>
                <span className="ml-auto opacity-50">{kind}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="absolute top-[15%] left-[34%] flex w-[60%] flex-col overflow-hidden rounded-[1.1cqw] shadow-[0_24px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
        style={{ background: bg, color: fg, bottom: "13%" }}
      >
        <TitleBar title="Windows Terminal — Aether" bg={titleBg} fg={titleFg} />
        <div
          className="min-h-0 flex-1 space-y-[0.35cqw] overflow-hidden px-[1.6cqw] py-[1.2cqw] font-mono text-[1.45cqw] leading-snug"
          style={{ background: bg }}
        >
          <p>
            <span style={{ color: green }}>PS</span>{" "}
            <span style={{ color: cyan }}>C:\Users\John\Aether</span>
            <span style={{ color: fg }}>&gt; ls</span>
          </p>
          <p style={{ color: muted }}>Каталог: C:\Users\John\Aether</p>
          <p>
            <span style={{ color: blue }}>d----</span> src
          </p>
          <p>
            <span style={{ color: fg }}>a----</span> README.md
          </p>
          <p>
            <span style={{ color: yellow }}>a----</span> theme.json
          </p>
          <p className="pt-[0.4cqw]">
            <span style={{ color: green }}>PS</span>{" "}
            <span style={{ color: cyan }}>C:\Users\John\Aether</span>
            <span>&gt; git status</span>
          </p>
          <p>
            <span style={{ color: yellow }}>изменено</span> palette.ts
          </p>
          <p>
            <span style={{ color: green }}>новый</span> wallpaper.jpg
          </p>
          <p>
            <span style={{ color: red }}>ошибка</span>{" "}
            <span style={{ color: magenta }}>&quot;{themeName}&quot;</span> ещё не в репозитории
          </p>
          <div className="flex gap-[0.45cqw] pt-[0.8cqw]">
            {colors.map((color, index) => (
              <span
                key={`${color}-${index}`}
                className="h-[1.5cqw] flex-1 rounded-[0.25cqw]"
                style={{ background: color }}
              />
            ))}
          </div>
        </div>
      </section>

      <footer
        className="absolute inset-x-0 bottom-0 flex items-center px-[1.2cqw]"
        style={{
          height: "8.2%",
          background: taskbarBg,
          color: taskbarFg,
          backdropFilter: transparency ? "blur(18px)" : undefined,
        }}
      >
        <div className="flex flex-1 items-center justify-center gap-[0.7cqw]">
          <TaskIcon label="Пуск">
            <StartIcon />
          </TaskIcon>
          <div
            className="flex h-[4.6cqw] items-center gap-[0.6cqw] rounded-full px-[1.2cqw] text-[1.25cqw]"
            style={{ background: light ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.08)" }}
          >
            <SearchIcon />
            Поиск
          </div>
          <TaskIcon label="Проводник">
            <FolderIcon accent={yellow} />
          </TaskIcon>
          <TaskIcon label="Терминал" active={accent}>
            <PromptIcon />
          </TaskIcon>
          <TaskIcon label="Браузер">
            <EdgeIcon />
          </TaskIcon>
          <TaskIcon label="Код">
            <CodeIcon color={blue} />
          </TaskIcon>
        </div>
        <div className="absolute right-[1.4cqw] text-right leading-none">
          <div className="text-[1.35cqw]">{clock}</div>
          <div className="mt-[0.25cqw] text-[1.05cqw] opacity-80">{day}</div>
        </div>
      </footer>
    </div>
  );
}

function TitleBar({ title, bg, fg }: { title: string; bg: string; fg: string }) {
  return (
    <div
      className="flex items-center gap-[1cqw] px-[1.2cqw] py-[0.7cqw] text-[1.35cqw]"
      style={{ background: bg, color: fg }}
    >
      <span className="truncate">{title}</span>
      <span className="ml-auto flex items-center gap-[1.1cqw] font-mono text-[1.2cqw]">
        <span>—</span>
        <span>□</span>
        <span>×</span>
      </span>
    </div>
  );
}

function DeskIcon({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex w-[8.5cqw] flex-col items-center gap-[0.35cqw] text-center text-[1.15cqw] leading-tight drop-shadow">
      <div className="size-[3.4cqw]">{children}</div>
      <span className="line-clamp-2">{label}</span>
    </div>
  );
}

function TaskIcon({
  children,
  label,
  active,
}: {
  children: ReactNode;
  label: string;
  active?: string;
}) {
  return (
    <div
      className="grid size-[4.8cqw] place-items-center rounded-[0.7cqw]"
      title={label}
      style={active ? { boxShadow: `inset 0 -0.28cqw 0 ${active}` } : undefined}
    >
      <div className="size-[2.6cqw]">{children}</div>
    </div>
  );
}

function MonitorIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-full">
      <rect x="6" y="8" width="36" height="24" rx="3" fill="#d7e4f2" />
      <rect x="9" y="11" width="30" height="18" rx="1" fill="#3a7bd5" />
      <rect x="18" y="33" width="12" height="3" fill="#c5d0dc" />
      <rect x="14" y="36" width="20" height="3" rx="1" fill="#9aabbd" />
    </svg>
  );
}

function BinIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-full">
      <path d="M16 16h16l-1.5 20h-13z" fill="#8fd0ff" />
      <rect x="14" y="12" width="20" height="4" rx="1" fill="#d9ecff" />
      <rect x="20" y="9" width="8" height="3" rx="1" fill="#d9ecff" />
    </svg>
  );
}

function FolderIcon({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 48 48" className="size-full">
      <path d="M6 16h14l4 4h18v18H6z" fill={accent} />
      <path d="M6 20h36v18H6z" fill="#f4d48a" />
    </svg>
  );
}

function StartIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-full">
      <rect x="8" y="8" width="14" height="14" rx="2" fill="#4cc2ff" />
      <rect x="26" y="8" width="14" height="14" rx="2" fill="#4cc2ff" />
      <rect x="8" y="26" width="14" height="14" rx="2" fill="#4cc2ff" />
      <rect x="26" y="26" width="14" height="14" rx="2" fill="#4cc2ff" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-[1.6cqw]">
      <circle cx="20" cy="20" r="9" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M27 27 L36 36" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function PromptIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-full">
      <rect x="6" y="10" width="36" height="28" rx="3" fill="#1b1b1b" />
      <path d="M14 20 l8 4 l-8 4" fill="none" stroke="#6ee7a8" strokeWidth="3" />
      <path d="M26 30 h10" stroke="#e8e8e8" strokeWidth="3" />
    </svg>
  );
}

function EdgeIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-full">
      <circle cx="24" cy="24" r="16" fill="#0f7ad8" />
      <path d="M12 28c6 8 20 8 24-2-8 2-12-2-12-8 8 2 14 8 10 14-8 4-20 0-22-4z" fill="#3dd6c6" />
    </svg>
  );
}

function CodeIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 48 48" className="size-full">
      <path d="M18 14 L8 24 L18 34" fill="none" stroke={color} strokeWidth="4" />
      <path d="M30 14 L40 24 L30 34" fill="none" stroke={color} strokeWidth="4" />
    </svg>
  );
}
