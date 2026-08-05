"use client";

import { useRef } from "react";
import type { CropRect } from "@/features/form-rm/signature";

type Dir = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const MIN = 0.06; // ukuran crop minimum (pecahan)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const HANDLES: { dir: Dir; style: React.CSSProperties }[] = [
  { dir: "nw", style: { left: 0, top: 0, cursor: "nwse-resize" } },
  { dir: "n", style: { left: "50%", top: 0, transform: "translate(-50%,-50%)", cursor: "ns-resize" } },
  { dir: "ne", style: { right: 0, top: 0, cursor: "nesw-resize" } },
  { dir: "e", style: { right: 0, top: "50%", transform: "translate(50%,-50%)", cursor: "ew-resize" } },
  { dir: "se", style: { right: 0, bottom: 0, cursor: "nwse-resize" } },
  { dir: "s", style: { left: "50%", bottom: 0, transform: "translate(-50%,50%)", cursor: "ns-resize" } },
  { dir: "sw", style: { left: 0, bottom: 0, cursor: "nesw-resize" } },
  { dir: "w", style: { left: 0, top: "50%", transform: "translate(-50%,-50%)", cursor: "ew-resize" } },
];

/**
 * Pemotong gambar interaktif. `crop` & `onChange` dalam pecahan 0..1 terhadap
 * gambar (bebas resolusi). Seret badan kotak untuk geser, seret pegangan untuk
 * ubah ukuran; area luar diredupkan.
 */
export function ImageCropper({
  src,
  crop,
  onChange,
}: {
  src: string;
  crop: CropRect;
  onChange: (c: CropRect) => void;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ dir: Dir; startFx: number; startFy: number; start: CropRect } | null>(null);

  function frac(e: React.PointerEvent) {
    const el = boxRef.current;
    if (!el) return { fx: 0, fy: 0 };
    const r = el.getBoundingClientRect();
    return {
      fx: clamp((e.clientX - r.left) / r.width, 0, 1),
      fy: clamp((e.clientY - r.top) / r.height, 0, 1),
    };
  }

  function onDown(e: React.PointerEvent, dir: Dir) {
    e.preventDefault();
    e.stopPropagation();
    const { fx, fy } = frac(e);
    drag.current = { dir, startFx: fx, startFy: fy, start: { ...crop } };
    boxRef.current?.setPointerCapture(e.pointerId);
  }

  function onMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const { fx, fy } = frac(e);
    const s = d.start;
    let { x, y, w, h } = s;

    if (d.dir === "move") {
      x = clamp(s.x + (fx - d.startFx), 0, 1 - s.w);
      y = clamp(s.y + (fy - d.startFy), 0, 1 - s.h);
    } else {
      const right = s.x + s.w;
      const bottom = s.y + s.h;
      if (d.dir.includes("e")) w = clamp(fx, s.x + MIN, 1) - s.x;
      if (d.dir.includes("s")) h = clamp(fy, s.y + MIN, 1) - s.y;
      if (d.dir.includes("w")) {
        const nx = clamp(fx, 0, right - MIN);
        w = right - nx;
        x = nx;
      }
      if (d.dir.includes("n")) {
        const ny = clamp(fy, 0, bottom - MIN);
        h = bottom - ny;
        y = ny;
      }
    }
    onChange({ x, y, w, h });
  }

  function onUp() {
    drag.current = null;
  }

  const pct = (v: number) => `${v * 100}%`;

  return (
    <div
      ref={boxRef}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      className="relative mx-auto max-h-[240px] w-fit touch-none select-none overflow-hidden rounded-[var(--radius-md)] bg-white"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Sumber tanda tangan" draggable={false} className="block max-h-[240px] w-auto" />

      {/* Area luar crop diredupkan (trik box-shadow besar). */}
      <div
        onPointerDown={(e) => onDown(e, "move")}
        style={{
          left: pct(crop.x),
          top: pct(crop.y),
          width: pct(crop.w),
          height: pct(crop.h),
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
        }}
        className="absolute cursor-move border border-white/90 outline outline-1 outline-black/60"
      >
        {HANDLES.map((hd) => (
          <span
            key={hd.dir}
            onPointerDown={(e) => onDown(e, hd.dir)}
            style={hd.style}
            className="absolute size-3 rounded-full border border-black/70 bg-white shadow"
          />
        ))}
      </div>
    </div>
  );
}
