"use client";

import { useRef, useState } from "react";
import { Check, Eraser, Loader2, PenLine, Send } from "lucide-react";
import { cn } from "@/lib/cn";
import { KanvasTtd, type PeganganKanvasTtd } from "./KanvasTtd";

type Phase = "draw" | "sending" | "done" | "error";

/**
 * Halaman tanda tangan di HP (dibuka via QR dari PC). Menggambar TTD dengan jari
 * → proses hitam-di-atas-transparan → kirim ke server (token). Kanvasnya
 * komponen bersama `KanvasTtd` (juga dipakai tablet siaga `/ttd-siaga`).
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
  const kanvas = useRef<PeganganKanvasTtd | null>(null);
  const [phase, setPhase] = useState<Phase>("draw");
  const [message, setMessage] = useState("");

  function clear() {
    kanvas.current?.bersihkan();
    setMessage("");
  }

  async function send() {
    if (!kanvas.current?.adaTinta()) {
      setMessage("Bubuhkan tanda tangan dulu.");
      return;
    }
    setPhase("sending");
    setMessage("");
    try {
      const payload = await kanvas.current.ambil();
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
        <KanvasTtd ref={kanvas} onMulai={() => setMessage("")} className="absolute inset-0 size-full" />
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
