"use client";

import { uploadTicketPhotos } from "@/lib/queueActions";
import type { QueueTicket } from "@/lib/types";
import clsx from "clsx";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { db } from "@/lib/firebase";

const PENDING_UPLOAD_STATUSES: QueueTicket["status"][] = [
  "waiting",
  "notification_sent",
  "current",
  "completed",
];

export default function AssistantPage() {
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "queue"),
      where("status", "in", PENDING_UPLOAD_STATUSES),
      orderBy("ticketNumber", "asc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const found: QueueTicket[] = [];
      snap.forEach((doc) => found.push(doc.data() as QueueTicket));
      setTickets(found);
    });
    return () => unsub();
  }, []);

  const handleUpload = useCallback(
    async (ticketNumber: number, files: File[]) => {
      setActiveTicket(ticketNumber);
      setMessage(null);
      try {
        const urls = await uploadTicketPhotos(ticketNumber, files);
        setMessage(
          `Uploaded ${files.length} photos to ticket #${ticketNumber}. ${urls.length} URLs saved.`,
        );
      } catch (err) {
        setMessage(
          err instanceof Error
            ? err.message
            : "Upload failed. Please try again.",
        );
      } finally {
        setActiveTicket(null);
      }
    },
    [],
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-8">
      <header className="flex flex-col gap-3 rounded-3xl bg-gradient-to-r from-ig-forest/60 via-ig-card to-ig-card p-6 shadow-xl ring-1 ring-white/10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-ig-gold/80">
            Assistant / Uploader
          </p>
          <h1 className="font-display text-3xl text-ig-cream sm:text-4xl">
            Deliver photos fast
          </h1>
          <p className="text-sm text-ig-cream/70">
            Drop images onto the matching ticket. We upload to Firebase Storage,
            copy download URLs into Firestore, and mark the ticket as delivered.
            You can upload even if the photographer hasn&apos;t tapped Mark as
            Photographed yet.
          </p>
        </div>
        <Link
          href="/photographer"
          className="rounded-full border border-white/15 px-3 py-2 text-sm font-semibold text-ig-cream transition hover:border-ig-gold hover:text-ig-gold"
        >
          Back to photographer
        </Link>
      </header>

      <section className="card p-6 sm:p-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl text-ig-cream">Waiting uploads</h2>
          <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-ig-cream/80">
            {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
          </span>
        </div>

        {tickets.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-ig-cream/70">
            No tickets waiting for upload yet. They appear here once families
            join the line, and you can upload even if the photographer hasn&apos;t
            marked them as photographed yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {tickets.map((ticket) => (
              <TicketDrop
                key={ticket.ticketNumber}
                ticket={ticket}
                isUploading={activeTicket === ticket.ticketNumber}
                onUpload={handleUpload}
              />
            ))}
          </div>
        )}
        {message && (
          <p className="mt-4 text-sm text-ig-cream/80">{message}</p>
        )}
      </section>
    </div>
  );
}

function TicketDrop({
  ticket,
  onUpload,
  isUploading,
}: {
  ticket: QueueTicket;
  onUpload: (ticketNumber: number, files: File[]) => void;
  isUploading: boolean;
}) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      onUpload(ticket.ticketNumber, acceptedFiles);
    },
    [onUpload, ticket.ticketNumber],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [],
    },
    disabled: isUploading,
  });

  const isMarkedPhotographed = ticket.status === "completed";

  return (
    <div
      {...getRootProps()}
      className={clsx(
        "rounded-2xl border-2 border-dashed p-4 transition",
        isDragActive
          ? "border-ig-gold bg-ig-cream/10"
          : "border-white/20 bg-white/5 hover:border-ig-gold/70",
      )}
    >
      <input {...getInputProps()} />
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-ig-gold/70">
            Ticket #{ticket.ticketNumber}
          </p>
          <p className="text-lg font-semibold text-ig-cream">
            {ticket.childName}{" "}
            <span className="text-ig-cream/70">({ticket.educator})</span>
          </p>
          <p className="text-xs text-ig-cream/60">
            Parent: {ticket.parentName} • {ticket.phoneNumber}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-sm font-semibold text-ig-cream/80">
          <span
            className={clsx(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
              isMarkedPhotographed
                ? "bg-ig-emerald/20 text-ig-cream"
                : "bg-white/10 text-ig-cream/80",
            )}
          >
            <span
              className={clsx(
                "h-2 w-2 rounded-full",
                isMarkedPhotographed ? "bg-emerald-300" : "bg-ig-gold",
              )}
            />
            {isMarkedPhotographed ? "Marked photographed" : "Not marked yet"}
          </span>
          <span>{isUploading ? "Uploading..." : "Drop images"}</span>
        </div>
      </div>
      <p className="mt-3 text-xs text-ig-cream/70">
        Files go to /YEAR/ticket_{ticket.ticketNumber}/ in Firebase Storage.
        Uploading will still flip the ticket to &ldquo;photos_uploaded&rdquo;
        even if it hasn&apos;t been marked yet.
      </p>
    </div>
  );
}
