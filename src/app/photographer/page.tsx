"use client";

import {
  AVERAGE_MINUTES_PER_TICKET,
  advanceQueue,
  markPhotographed,
} from "@/lib/queueActions";
import type { QueueSettings, QueueTicket } from "@/lib/types";
import clsx from "clsx";
import { doc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";

export default function PhotographerPage() {
  const [settings, setSettings] = useState<QueueSettings | null>(null);
  const [currentTicket, setCurrentTicket] = useState<QueueTicket | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"advance" | "complete" | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, "settings", "queue"), (snap) => {
      const data = snap.data() as QueueSettings | undefined;
      if (data) {
        setSettings({
          currentServingTicket: data.currentServingTicket ?? 0,
          lastTicketNumber: data.lastTicketNumber ?? 0,
        });
      }
    });
    return () => unsubSettings();
  }, []);

  useEffect(() => {
    if (!settings?.currentServingTicket) {
      setCurrentTicket(null);
      return;
    }
    const ref = doc(db, "queue", String(settings.currentServingTicket));
    const unsubTicket = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setCurrentTicket(snap.data() as QueueTicket);
      } else {
        setCurrentTicket(null);
      }
    });
    return () => unsubTicket();
  }, [settings?.currentServingTicket]);

  const readyMessage = useMemo(() => {
    if (!currentTicket) return "Tap Notify Next Group to call the next family.";
    if (currentTicket.status === "completed") {
      return "Marked as photographed. Advance when you want the next family.";
    }
    return "Set up your scene, then mark as photographed when done.";
  }, [currentTicket]);

  const nextNumber = useMemo(
    () => (settings?.currentServingTicket ?? 0) + 1,
    [settings?.currentServingTicket],
  );

  async function handleAdvance() {
    setBusy("advance");
    setStatusMessage(null);
    try {
      const next = await advanceQueue();
      setStatusMessage(`Now serving #${next}. SMS triggers will fire automatically.`);
    } catch (err) {
      setStatusMessage(
        err instanceof Error
          ? err.message
          : "Could not advance the queue. Try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleComplete() {
    if (!settings?.currentServingTicket) return;
    setBusy("complete");
    setStatusMessage(null);
    try {
      await markPhotographed(settings.currentServingTicket);
      setStatusMessage(`Ticket #${settings.currentServingTicket} marked as photographed.`);
    } catch (err) {
      setStatusMessage(
        err instanceof Error
          ? err.message
          : "Could not mark as photographed. Try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-8">
      <header className="flex flex-col gap-2 rounded-3xl bg-gradient-to-r from-ig-forest/50 via-ig-card to-ig-card p-6 shadow-xl ring-1 ring-white/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-ig-gold/80">
              Photographer
            </p>
            <h1 className="font-display text-3xl text-ig-cream sm:text-4xl">
              Manage the line
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-full border border-white/15 px-3 py-2 text-sm font-semibold text-ig-cream transition hover:border-ig-gold hover:text-ig-gold"
          >
            Parent check-in
          </Link>
        </div>
        <p className="text-sm text-ig-cream/70">
          Offline friendly: actions queue locally and sync once Wi‑Fi returns.
          If a button feels slow, it will send once you reconnect.
        </p>
        <div className="flex items-center gap-2 text-xs font-semibold text-ig-cream/70">
          <span
            className={clsx(
              "h-2 w-2 rounded-full",
              isOnline ? "bg-emerald-300" : "bg-red-400",
            )}
          />
          {isOnline ? "Online" : "Offline recording mode"}
        </div>
      </header>

      <section className="card p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-ig-gold/80">
              Current Ticket
            </p>
            <div className="flex items-baseline gap-4">
              <h2 className="font-display text-6xl text-ig-gold sm:text-7xl">
                #{settings?.currentServingTicket ?? 0}
              </h2>
              {currentTicket?.childName && (
                <p className="text-lg text-ig-cream">
                  {currentTicket.childName}
                  <span className="text-ig-cream/70">
                    {" "}
                    ({currentTicket.educator})
                  </span>
                </p>
              )}
            </div>
            <p className="mt-2 text-sm text-ig-cream/70">{readyMessage}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-ig-cream/70">Next up</p>
            <p className="font-display text-3xl text-ig-cream">#{nextNumber}</p>
            <p className="text-xs text-ig-cream/60">
              Rough wait ~ {AVERAGE_MINUTES_PER_TICKET} mins per family
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            onClick={handleAdvance}
            disabled={busy === "advance"}
            className="w-full rounded-xl bg-gradient-to-r from-ig-emerald to-ig-gold px-5 py-3 text-lg font-semibold text-ig-forest shadow-lg transition hover:scale-[1.01]"
          >
            {busy === "advance" ? "Advancing..." : "Notify Next Group"}
          </button>
          <button
            onClick={handleComplete}
            disabled={!settings?.currentServingTicket || busy === "complete"}
            className="w-full rounded-xl border border-white/20 px-5 py-3 text-lg font-semibold text-ig-cream transition hover:border-ig-gold hover:text-ig-gold"
          >
            {busy === "complete" ? "Saving..." : "Mark as Photographed"}
          </button>
        </div>

        {statusMessage && (
          <p className="mt-4 text-sm text-ig-cream/80">{statusMessage}</p>
        )}
      </section>

      <section className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-ig-cream">Quick tips</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ig-cream/70">
            <li>Press &ldquo;Notify Next&rdquo; as soon as you&apos;re ready for the next family.</li>
            <li>Always hit &ldquo;Mark as Photographed&rdquo; before advancing so the assistant sees their ticket.</li>
            <li>Offline? Buttons still work and sync when you reconnect.</li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-ig-cream">Latest numbers</p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm text-ig-cream/80">
            <Badge label={`Last ticket: #${settings?.lastTicketNumber ?? 0}`} />
            <Badge label={`Next up: #${nextNumber}`} />
            <Badge
              label={
                currentTicket?.status
                  ? `Status: ${currentTicket.status}`
                  : "Status: waiting"
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-ig-cream">
      {label}
    </span>
  );
}
