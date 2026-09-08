"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import {
  X,
  Coins,
  CheckCircle,
  ArrowSquareOut,
  Spinner,
  Bank,
} from "@phosphor-icons/react";
import { API_BASE, getToken } from "@/lib/auth";
import { dict } from "@/lib/i18n";
import { useLocale } from "@/lib/useLocale";

interface TopUpModalProps {
  onClose: () => void;
  onPaid?: () => void;
}

type Stage = "pick" | "pay" | "success";

interface Payment {
  txn_id: number;
  amount: number;
  credits: number;
  pool_drops: number;
  qr_string: string;
  payment_url: string;
  expires_in_minutes: number;
  sandbox: boolean;
}

export function TopUpModal({ onClose, onPaid }: TopUpModalProps) {
  const { locale } = useLocale();
  const t = dict[locale].payments;
  const [stage, setStage] = useState<Stage>("pick");
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [customAmount, setCustomAmount] = useState("500");
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const pollRef = useRef<number | null>(null);

  // countdown + polling while paying
  useEffect(() => {
    if (stage !== "pay" || !payment) return;
    const expiresAt = payment.expires_in_minutes * 60;
    // initialize the countdown via microtask — state settles async, no sync cascade
    Promise.resolve().then(() => setSecondsLeft(expiresAt));
    const cd = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/payments/status/${payment.txn_id}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "paid" && data.applied) {
          setStage("success");
          onPaid?.();
        } else if (["expired", "cancelled", "refunded"].includes(data.status)) {
          setError(data.status);
          setStage("pick");
        }
      } catch {}
    };
    pollRef.current = window.setInterval(poll, 4000);
    poll();

    return () => {
      window.clearInterval(cd);
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [stage, payment, onPaid]);

  const createPayment = useCallback(
    async (pkg: "starter" | "bundle" | "custom") => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/payments/create`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            package: pkg,
            custom_amount: pkg === "custom" ? parseInt(customAmount, 10) || 0 : undefined,
          }),
        });
        if (res.status === 401) {
          window.location.replace("/?signin=1");
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          setError(data.detail || "Could not create payment");
          return;
        }
        setPayment(data);
        setStage("pay");
      } catch {
        setError("Network error — try again");
      } finally {
        setBusy(false);
      }
    },
    [customAmount]
  );

  const simulate = useCallback(async () => {
    if (!payment) return;
    setBusy(true);
    try {
      await fetch(`${API_BASE}/payments/simulate/${payment.txn_id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
    } catch {}
    setBusy(false);
    // polling picks up the paid state within 4s
  }, [payment]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={stage === "success" ? onClose : undefined}
    >
      <div
        className="w-full max-w-md rounded-[24px] border border-white/10 bg-raised p-6 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)] md:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <span className="die-cut flex h-11 w-11 items-center justify-center">
            <Coins size={20} weight="fill" className="text-accent" />
          </span>
          <button onClick={onClose} aria-label="Close" className="text-white/40 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* ===== STAGE: PICK PACKAGE ===== */}
        {stage === "pick" && (
          <>
            <h3 className="mt-4 font-display text-xl font-extrabold tracking-tight">{t.topupTitle}</h3>
            {error && <p className="mt-2 text-xs text-error">Payment {error} — pick a package again</p>}
            <div className="mt-5 space-y-2.5">
              <div className="rounded-2xl border border-accent/30 bg-accent-soft p-4">
                <label htmlFor="custom-amount" className="text-sm font-bold">
                  {t.customLabel}
                </label>
                <div className="mt-2.5 flex items-center gap-2.5">
                  <span className="font-mono text-sm text-white/40">Rp</span>
                  <input
                    id="custom-amount"
                    type="number"
                    min={500}
                    step={500}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    autoFocus
                    className="w-full rounded-xl border border-white/10 bg-raised px-3 py-2.5 font-mono text-lg text-white focus-visible:border-accent"
                  />
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {[500, 1000, 5000, 10000, 25000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setCustomAmount(String(amt))}
                      aria-pressed={customAmount === String(amt)}
                      className={`rounded-full px-3 py-1 font-mono text-xs font-bold transition-colors ${
                        customAmount === String(amt)
                          ? "bg-accent text-accent-fg"
                          : "border border-white/10 text-white/60 hover:border-white/40 hover:text-white"
                      }`}
                    >
                      {amt.toLocaleString()}
                    </button>
                  ))}
                </div>
                <p className="mt-2.5 text-[11px] text-white/40">
                  {t.customHint}
                  {" · "}
                  {t.creditsLabel}: <span className="font-bold text-accent">
                    {Math.max(0, Math.floor((parseInt(customAmount, 10) || 0) / 250))}
                  </span>
                  {" · "}
                  {t.poolDropLabel}: <span className="font-bold text-accent-2">
                    {Math.max(0, Math.floor((parseInt(customAmount, 10) || 0) / 500))}
                  </span>
                </p>
                <button
                  onClick={() => createPayment("custom")}
                  disabled={busy || (parseInt(customAmount, 10) || 0) < 500}
                  className="mt-3 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-bold text-accent-fg transition-all hover:shadow-[0_0_30px_rgba(254,44,85,0.45)] active:scale-95 disabled:opacity-40"
                >
                  {busy ? "…" : `${t.payTitle} — Rp ${(parseInt(customAmount, 10) || 0).toLocaleString()}`}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ===== STAGE: PAY (QR + countdown + polling) ===== */}
        {stage === "pay" && payment && (
          <>
            <h3 className="mt-4 font-display text-xl font-extrabold tracking-tight">{t.payTitle}</h3>
            <p className="mt-1 font-mono text-2xl font-black text-accent">
              Rp {payment.amount.toLocaleString(locale === "id" ? "id-ID" : "en-US")}
            </p>
            {payment.sandbox && (
              <p className="mt-2 rounded-lg bg-warn-soft px-2.5 py-1.5 text-center text-[11px] font-bold text-white/60">
                {t.sandboxNote}
              </p>
            )}
            <div className="mt-4 flex justify-center rounded-[20px] bg-white p-4">
              {payment.qr_string ? (
                <QRCode value={payment.qr_string} size={200} />
              ) : (
                <a
                  href={payment.payment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[200px] items-center justify-center px-4 text-center text-sm font-bold text-black underline"
                >
                  {t.orPayPage}
                </a>
              )}
            </div>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-white/40">{t.scanHint}</p>
            <div className="mt-4 flex items-center justify-between">
              <p className="flex items-center gap-2 text-xs text-white/50">
                <Spinner size={13} className="animate-spin text-accent" /> {t.pendingLabel}
              </p>
              <p className="font-mono text-xs text-white/50">
                {t.expiryLabel} {mm}:{ss}
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              {payment.payment_url && (
                <a
                  href={payment.payment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/80 transition-colors hover:border-white/40"
                >
                  <ArrowSquareOut size={14} /> {t.orPayPage}
                </a>
              )}
              {payment.sandbox && (
                <button
                  onClick={simulate}
                  disabled={busy}
                  className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-full bg-accent-2 px-4 py-2 text-xs font-bold text-accent-2-fg transition-transform active:scale-95 disabled:opacity-50"
                >
                  <Bank size={14} weight="fill" /> Simulate pay
                </button>
              )}
            </div>
          </>
        )}

        {/* ===== STAGE: SUCCESS ===== */}
        {stage === "success" && (
          <div className="mt-4 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-2-soft">
              <CheckCircle size={34} weight="fill" className="text-accent-2" />
            </span>
            <h3 className="mt-4 font-display text-2xl font-extrabold tracking-tight">{t.successTitle}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{t.successBody}</p>
            <button
              onClick={onClose}
              className="mx-auto mt-5 flex min-h-[44px] items-center rounded-full bg-accent px-8 py-2.5 text-sm font-bold text-accent-fg transition-all hover:shadow-[0_0_30px_rgba(254,44,85,0.4)] active:scale-95"
            >
              {t.closeLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
