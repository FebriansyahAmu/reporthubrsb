"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Eraser, Loader2, PenLine, Send } from "lucide-react";
import { processDrawing } from "@/features/form-rm/signature";
import { cn } from "@/lib/cn";

type Phase = "draw" | "sending" | "done" | "error";

/**
 * Halaman tanda tangan di HP (dibuka via QR dari PC). Menggambar TTD dengan jari
 * → proses hitam-di-atas-transparan → kirim ke server (token).
 *
 * Menggambar pakai native Touch + Mouse events yang dipasang langsung ke canvas
 * (`{ passive:false }` + `preventDefault`). Konteks diskala DPR sekali (koordinat
 * CSS-px); layout `fixed inset-0` + `touch-action:none` menahan scroll.
 *
 * NB: agar halaman ini ter-hydrate saat dibuka dari IP LAN di `next dev`, IP-nya
 * WAJIB ada di `allowedDevOrigins` (next.config.ts). Tanpa itu JS client diblok.
 */
export function MobileSignView({
  token,
  label,
  context,
}: {
  token: string;
  label: string;
  context: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const inked = useRef(false);
  const [phase, setPhase] = useState<Phase>("draw");
  const [message, setMessage] = useState("");

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
      setMessage("");
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

  function clear() {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
    configureStroke(ctx);
    inked.current = false;
    setMessage("");
  }

  async function send() {
    const c = canvasRef.current;
    if (!c || !inked.current) {
      setMessage("Bubuhkan tanda tangan dulu.");
      return;
    }
    setPhase("sending");
    setMessage("");
    try {
      const payload = await processDrawing(c.toDataURL("image/png"));
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(j?.error?.message ?? "Gagal mengirim tanda tangan");
      }
      setPhase("done");
    } catch (e) {
      setPhase("error");
      setMessage(e instanceof Error ? e.message : "Gagal mengirim");
    }
  }

  if (phase === "done") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-bg px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
          <Check className="size-8" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-fg">Tanda tangan terkirim</h1>
        <p className="mt-1 max-w-xs text-sm text-fg-muted">
          Terima kasih. Silakan kembalikan HP kepada petugas.
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex select-none flex-col overscroll-none bg-bg px-4 py-4">
      <header className="mb-3 shrink-0">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-brand">
          <PenLine className="size-3.5" /> {label}
        </p>
        {context && <h1 className="mt-0.5 text-base font-semibold text-fg">{context}</h1>}
        <p className="mt-1 text-xs text-fg-muted">Bubuhkan tanda tangan pada kotak di bawah.</p>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-white shadow-xs">
        <canvas
          ref={canvasRef}
          onContextMenu={(e) => e.preventDefault()}
          style={{ touchAction: "none" }}
          className="absolute inset-0 block size-full touch-none"
        />
        <span className="pointer-events-none absolute inset-x-0 bottom-6 mx-auto h-px w-4/5 bg-border" />
      </div>

      {message && phase !== "sending" && (
        <p className="mt-2 shrink-0 text-center text-sm text-danger">{message}</p>
      )}

      <div className="mt-3 grid shrink-0 grid-cols-2 gap-3">
        <button
          type="button"
          onClick={clear}
          disabled={phase === "sending"}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface text-sm font-medium text-fg transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          <Eraser className="size-4" /> Bersihkan
        </button>
        <button
          type="button"
          onClick={send}
          disabled={phase === "sending"}
          className={cn(
            "inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand text-sm font-semibold text-brand-fg transition-colors hover:bg-brand-hover disabled:opacity-60",
          )}
        >
          {phase === "sending" ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Mengirim…
            </>
          ) : (
            <>
              <Send className="size-4" /> Kirim
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function configureStroke(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}
