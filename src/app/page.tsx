"use client";

import { AVERAGE_MINUTES_PER_TICKET, createTicket } from "@/lib/queueActions";
import type { QueueSettings, QueueTicket } from "@/lib/types";
import clsx from "clsx";
import { doc, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";

const STORAGE_KEY = "inner-garden-ticket";

type StoredTicket = {
  ticketNumber: number;
  childName?: string;
};

const statusCopy: Record<string, string> = {
  waiting: "In line",
  notification_sent: "Notified",
  current: "It's your turn",
  completed: "Photographed",
  photos_uploaded: "Photos ready",
};

function saveTicket(ticketNumber: number, childName?: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ticketNumber, childName }),
  );
}

function loadTicket(): StoredTicket | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredTicket;
  } catch (err) {
    console.warn("Could not parse stored ticket", err);
    return null;
  }
}

function clearStoredTicket() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function formatEta(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function StatusBadge({ status }: { status?: QueueTicket["status"] }) {
  const copy = status ? statusCopy[status] ?? status : "Unknown";
  const styles =
    status === "current"
      ? "bg-ig-gold/20 text-ig-cream border border-ig-gold/40"
      : status === "photos_uploaded"
        ? "bg-ig-mint text-ig-forest"
        : status === "completed"
          ? "bg-white/15 text-ig-cream border border-white/10"
          : "bg-white/10 text-ig-cream border border-white/10";

  return <span className={clsx("badge", styles)}>{copy}</span>;
}

export default function Home() {
  const [settings, setSettings] = useState<QueueSettings | null>(null);
  const [ticket, setTicket] = useState<QueueTicket | null>(null);
  const [storedTicket, setStoredTicket] = useState<StoredTicket | null>(null);
  const [formState, setFormState] = useState({
    parentName: "",
    childName: "",
    educator: "",
    phoneNumber: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialEstimate, setInitialEstimate] = useState<number | null>(null);

  useEffect(() => {
    setStoredTicket(loadTicket());
  }, []);

  useEffect(() => {
    const unsubSettings = onSnapshot(settingsRef(), (snap) => {
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
    if (!storedTicket?.ticketNumber) return;
    const ticketRef = doc(db, "queue", String(storedTicket.ticketNumber));
    const unsubTicket = onSnapshot(ticketRef, (snap) => {
      if (snap.exists()) {
        setTicket(snap.data() as QueueTicket);
      } else {
        setTicket(null);
      }
    });
    return () => unsubTicket();
  }, [storedTicket?.ticketNumber]);

  useEffect(() => {
    if (!storedTicket?.ticketNumber) {
      setInitialEstimate(null);
    }
  }, [storedTicket?.ticketNumber]);

  useEffect(() => {
    if (!ticket || initialEstimate !== null) return;
    if (ticket.estimatedMinutesAtSignup != null) {
      setInitialEstimate(ticket.estimatedMinutesAtSignup);
      return;
    }
    if (!settings) return;
    const computed =
      Math.max(ticket.ticketNumber - (settings.currentServingTicket ?? 0), 0) *
      AVERAGE_MINUTES_PER_TICKET;
    setInitialEstimate(computed);
  }, [initialEstimate, settings, ticket]);

  const position = useMemo(() => {
    if (!ticket || !settings) return null;
    if (ticket.status === "completed" || ticket.status === "photos_uploaded") {
      return 0;
    }
    if (ticket.status === "current") return 0;
    const raw = ticket.ticketNumber - (settings.currentServingTicket ?? 0);
    return Math.max(raw, 0);
  }, [settings, ticket]);

  const estimatedWait = useMemo(() => {
    if (ticket?.estimatedMinutesAtSignup != null) {
      return ticket.estimatedMinutesAtSignup;
    }
    if (initialEstimate !== null) {
      return initialEstimate;
    }
    if (position && position > 0) {
      return position * AVERAGE_MINUTES_PER_TICKET;
    }
    return 0;
  }, [initialEstimate, position, ticket?.estimatedMinutesAtSignup]);

  const estimatedReadyTime =
    ticket?.timestamp &&
    estimatedWait &&
    ticket?.status !== "photos_uploaded"
      ? new Date(ticket.timestamp.toDate().getTime() + estimatedWait * 60 * 1000)
      : null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const next = await createTicket(formState);
      saveTicket(next, formState.childName);
      setStoredTicket({ ticketNumber: next, childName: formState.childName });
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "We could not save your spot. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  const clearTicket = () => {
    clearStoredTicket();
    setStoredTicket(null);
    setTicket(null);
    setInitialEstimate(null);
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-8">
      <header className="flex flex-col gap-4 rounded-3xl bg-gradient-to-r from-ig-forest/30 via-ig-card to-ig-card p-6 shadow-xl ring-1 ring-white/5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-ig-gold/80">
            Inner Garden Holiday
          </p>
          <h1 className="font-display text-4xl text-ig-cream sm:text-5xl">
            Photo Queue
          </h1>
          <p className="max-w-2xl text-ig-cream/70">
            Claim your ticket and track your turn without standing in line.
            We&apos;ll text you when you&apos;re close, when it&apos;s your
            turn, and when your photos are ready.
          </p>
          <div className="flex flex-wrap gap-3 text-sm font-semibold text-ig-cream/80">
            <Link
              href="/photographer"
              prefetch={false}
              className="rounded-full border border-ig-gold/50 px-4 py-2 transition hover:scale-[1.01] hover:border-ig-gold hover:text-ig-gold"
            >
              Photographer view
            </Link>
            <Link
              href="/assistant"
              prefetch={false}
              className="rounded-full border border-white/20 px-4 py-2 transition hover:scale-[1.01] hover:border-ig-gold hover:text-ig-gold"
            >
              Assistant uploader
            </Link>
          </div>
        </div>
        <div className="card flex w-full max-w-xs flex-col items-center gap-4 p-4 text-center sm:text-left">
          <p className="text-sm text-ig-cream/70">Current Serving</p>
          <div className="text-5xl font-extrabold text-ig-gold sm:text-6xl">
            #{settings?.currentServingTicket ?? 0}
          </div>
          <p className="text-sm text-ig-cream/70">
            Next: #{(settings?.currentServingTicket ?? 0) + 1}
          </p>
        </div>
      </header>

      {!storedTicket ? (
        <section className="card p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="font-display text-2xl text-ig-cream">
              Get in line
            </h2>
            <StatusBadge status="waiting" />
          </div>
          <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-ig-cream">Parent / Guardian</span>
              <input
                required
                className="input"
                placeholder="Alex Kim"
                value={formState.parentName}
                onChange={(e) =>
                  setFormState({ ...formState, parentName: e.target.value })
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-ig-cream">Child name</span>
              <input
                required
                className="input"
                placeholder="Luna Kim"
                value={formState.childName}
                onChange={(e) =>
                  setFormState({ ...formState, childName: e.target.value })
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-ig-cream">Educator</span>
              <input
                required
                className="input"
                placeholder="Room / educator name"
                value={formState.educator}
                onChange={(e) =>
                  setFormState({ ...formState, educator: e.target.value })
                }
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-ig-cream">Mobile number</span>
              <input
                required
                className="input"
                type="tel"
                placeholder="555-555-1212"
                value={formState.phoneNumber}
                onChange={(e) =>
                  setFormState({ ...formState, phoneNumber: e.target.value })
                }
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-ig-emerald to-ig-gold px-5 py-3 text-lg font-semibold text-ig-forest shadow-lg transition hover:scale-[1.01]"
              >
                {loading ? "Saving your spot..." : "Join the photo line"}
              </button>
              {error && (
                <p className="mt-3 text-sm text-red-200">
                  {error}
                </p>
              )}
            </div>
          </form>
        </section>
      ) : (
        <section className="card p-6 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-ig-gold/80">
                Your Ticket
              </p>
              <div className="flex items-end gap-3">
                <h2 className="font-display text-5xl text-ig-cream sm:text-6xl">
                  #{storedTicket.ticketNumber}
                </h2>
                <StatusBadge status={ticket?.status} />
              </div>
              {ticket?.childName && (
                <p className="mt-1 text-ig-cream/70">
                  For {ticket.childName} ({ticket.educator})
                </p>
              )}
              {!ticket && (
                <p className="mt-3 text-sm text-red-200">
                  We can&apos;t find this ticket anymore. Clear and submit again.
                </p>
              )}
            </div>
            <div className="text-right text-sm text-ig-cream/70">
              <p>Current serving: #{settings?.currentServingTicket ?? 0}</p>
              <p>
                You are: #{storedTicket.ticketNumber}
                {position && position > 0
                  ? ` (${position} away)`
                  : position === 0
                    ? " (next up)"
                    : ""}
              </p>
              <p>
                Est. wait when you joined:{" "}
                {estimatedWait > 0
                  ? `${estimatedWait} mins`
                  : "We’re nearly ready"}
              </p>
              {estimatedReadyTime && (
                <p className="text-xs text-ig-cream/60">
                  Rough turn around {formatEta(estimatedReadyTime)}
                </p>
              )}
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <p className="text-sm font-semibold text-ig-cream">What to expect</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ig-cream/80">
                <li>We text when you&apos;re 5 spots away.</li>
                <li>You&apos;ll get a second text when it&apos;s your turn.</li>
                <li>Photo links arrive by text as soon as they upload.</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <p className="text-sm font-semibold text-ig-cream">Need to change info?</p>
              <p className="mt-2 text-sm text-ig-cream/80">
                If you made a mistake, clear your ticket and resubmit.
              </p>
              <button
                onClick={clearTicket}
                className="mt-3 w-full rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-ig-cream transition hover:border-ig-gold hover:text-ig-gold"
              >
                Clear my ticket
              </button>
            </div>
          </div>
        </section>
      )}
      <footer className="rounded-3xl bg-white/5 p-4 text-sm text-ig-cream/70 ring-1 ring-white/10">
        <p>
          We respect your family&apos;s privacy. Read our{" "}
          <a
            href="https://www.innergardenedu.com/privacy-policy"
            className="text-ig-gold underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            Privacy Policy
          </a>
          .
        </p>
      </footer>
    </div>
  );
}

function settingsRef() {
  return doc(db, "settings", "queue");
}
