"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { processDrawing } from "@/features/form-rm/signature";
import { cn } from "@/lib/cn";

/** Pegangan kanvas untuk induk: bersihkan, cek tinta, ambil PNG hasil. */
export type PeganganKanvasTtd = {
  bersihkan: () => void;
  adaTinta: () => boolean;
  /** PNG hitam-di-atas-transparan yang sudah dirapatkan ke tinta; "" bila kosong. */
  ambil: () => Promise<string>;
};

/** Sisi terpanjang PNG yang dikirim — jauh di atas ukuran tampil/cetak, body tetap kecil. */
const MAKS_SISI_PNG = 1200;

/**
 * Kanvas tanda tangan sentuh (dipakai `/sign` dan `/ttd-siaga`). Diekstrak dari
 * `MobileSignView`: event Touch + Mouse NATIVE dipasang langsung ke kanvas
 * (`{ passive:false }` + `preventDefault`, terbukti di Chrome Android), konteks
 * diskala DPR sekali (koordinat CSS-px), coretan dipertahankan saat ukuran
 * berubah. Tanpa atribut `style` inline — aman untuk halaman ber-CSP nonce
 * (`touch-action:none` dari kelas `touch-none`).
 */
export function KanvasTtd({
  ref,
  onMulai,
  className,
}: {
  ref?: Ref<PeganganKanvasTtd>;
  /** Dipanggil setiap goresan dimulai (mis. menghapus pesan). */
  onMulai?: () => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const inked = useRef(false);
  const mulaiRef = useRef(onMulai);
  useEffect(() => {
    mulaiRef.current = onMulai;
  });

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    // --- ukuran buffer (DPR), cat latar putih, pertahankan coretan saat resize ---
    const fit = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (w < 1 || h < 1) return;
      const nw = Math.round(w * ratio);
      const nh = Math.round(h * ratio);
      if (c.width === nw && c.height === nh) return;
      const snap = inked.current ? c.toDataURL("image/png") : null;
      c.width = nw;
      c.height = nh;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); // koordinat CSS-px
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      configureStroke(ctx);
      if (snap) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, w, h);
        img.src = snap;
      }
    };
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => fit());
      ro.observe(c);
    }
    const raf = requestAnimationFrame(fit);
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    fit();

    // --- menggambar (native listeners) ---
    const at = (clientX: number, clientY: number) => {
      const r = c.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    };
    const begin = (x: number, y: number) => {
      const ctx = c.getContext("2d");
      if (!ctx) return;
      drawing.current = true;
      last.current = { x, y };
      inked.current = true;
      mulaiRef.current?.();
      ctx.beginPath();
      ctx.fillStyle = "#000";
      ctx.arc(x, y, (ctx.lineWidth || 2.6) / 2, 0, Math.PI * 2);
      ctx.fill();
    };
    const extend = (x: number, y: number) => {
      if (!drawing.current) return;
      const ctx = c.getContext("2d");
      if (!ctx || !last.current) return;
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      last.current = { x, y };
    };
    const finish = () => {
      drawing.current = false;
      last.current = null;
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      const p = at(t.clientX, t.clientY);
      begin(p.x, p.y);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      const p = at(t.clientX, t.clientY);
      extend(p.x, p.y);
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      finish();
    };
    const onMouseDown = (e: MouseEvent) => {
      const p = at(e.clientX, e.clientY);
      begin(p.x, p.y);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!drawing.current) return;
      const p = at(e.clientX, e.clientY);
      extend(p.x, p.y);
    };
    const onMouseUp = () => finish();

    c.addEventListener("touchstart", onTouchStart, { passive: false });
    c.addEventListener("touchmove", onTouchMove, { passive: false });
    c.addEventListener("touchend", onTouchEnd, { passive: false });
    c.addEventListener("touchcancel", onTouchEnd, { passive: false });
    c.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      ro?.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
      c.removeEventListener("touchstart", onTouchStart);
      c.removeEventListener("touchmove", onTouchMove);
      c.removeEventListener("touchend", onTouchEnd);
      c.removeEventListener("touchcancel", onTouchEnd);
      c.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      bersihkan() {
        const c = canvasRef.current;
        const ctx = c?.getContext("2d");
        if (!c || !ctx) return;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
        configureStroke(ctx);
        inked.current = false;
      },
      adaTinta: () => inked.current,
      async ambil() {
        const c = canvasRef.current;
        if (!c || !inked.current) return "";
        return perkecil(await processDrawing(c.toDataURL("image/png")), MAKS_SISI_PNG);
      },
    }),
    [],
  );

  return (
    <canvas
      ref={canvasRef}
      onContextMenu={(e) => e.preventDefault()}
      className={cn("block touch-none select-none", className)}
    />
  );
}

function configureStroke(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

/** Perkecil PNG bila sisi terpanjangnya melebihi `maks` (layar ber-DPR tinggi menghasilkan PNG besar). */
async function perkecil(dataUrl: string, maks: number): Promise<string> {
  if (!dataUrl) return "";
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Gagal memuat gambar"));
    i.src = dataUrl;
  });
  const sisi = Math.max(img.width, img.height);
  if (sisi <= maks) return dataUrl;
  const skala = maks / sisi;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.width * skala));
  c.height = Math.max(1, Math.round(img.height * skala));
  const ctx = c.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}
