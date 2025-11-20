import {
  Timestamp,
  arrayUnion,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "./firebase";
import type { QueueSettings, QueueTicket, TicketStatus } from "./types";

const settingsRef = doc(collection(db, "settings"), "queue");
const queueCollection = collection(db, "queue");

export type TicketInput = Omit<
  QueueTicket,
  "ticketNumber" | "status" | "timestamp" | "photoUrls"
>;

export async function createTicket(input: TicketInput) {
  const sanitizedPhone = input.phoneNumber.replace(/[^\d+]/g, "");

  return runTransaction(db, async (tx) => {
    const settingsSnap = await tx.get(settingsRef);
    const settings = (
      settingsSnap.exists()
        ? settingsSnap.data()
        : { currentServingTicket: 0, lastTicketNumber: 0 }
    ) as QueueSettings;

    const nextTicket = (settings.lastTicketNumber ?? 0) + 1;
    const ticketRef = doc(queueCollection, String(nextTicket));

    tx.set(ticketRef, {
      ...input,
      phoneNumber: sanitizedPhone,
      ticketNumber: nextTicket,
      status: "waiting" as TicketStatus,
      timestamp: serverTimestamp(),
    });

    tx.set(
      settingsRef,
      {
        lastTicketNumber: nextTicket,
        currentServingTicket: settings.currentServingTicket ?? 0,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return nextTicket;
  });
}

export async function advanceQueue() {
  return runTransaction(db, async (tx) => {
    const settingsSnap = await tx.get(settingsRef);
    const settings = (
      settingsSnap.exists()
        ? settingsSnap.data()
        : { currentServingTicket: 0, lastTicketNumber: 0 }
    ) as QueueSettings;

    const nextTicket = (settings.currentServingTicket ?? 0) + 1;
    const nextTicketRef = doc(queueCollection, String(nextTicket));
    const nextTicketSnap = await tx.get(nextTicketRef);

    if (!nextTicketSnap.exists()) {
      throw new Error("No more families in line yet. Wait for new sign ups.");
    }

    tx.update(nextTicketRef, {
      status: "current" as TicketStatus,
    });

    // Notify the group ~5 spots away so they can start heading over.
    const warmupRef = doc(queueCollection, String(nextTicket + 5));
    const warmupSnap = await tx.get(warmupRef);
    if (warmupSnap.exists()) {
      tx.update(warmupRef, {
        status: "notification_sent" as TicketStatus,
      });
    }

    tx.set(
      settingsRef,
      {
        currentServingTicket: nextTicket,
        lastTicketNumber: Math.max(settings.lastTicketNumber ?? 0, nextTicket),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return nextTicket;
  });
}

export async function markPhotographed(ticketNumber: number) {
  const ticketRef = doc(queueCollection, String(ticketNumber));
  await updateDoc(ticketRef, {
    status: "completed" as TicketStatus,
    completedAt: serverTimestamp(),
  });
}

export async function updateTicketStatus(
  ticketNumber: number,
  status: TicketStatus,
) {
  const ticketRef = doc(queueCollection, String(ticketNumber));
  await updateDoc(ticketRef, { status });
}

export async function uploadTicketPhotos(
  ticketNumber: number,
  files: File[],
): Promise<string[]> {
  const ticketRef = doc(queueCollection, String(ticketNumber));
  const year = new Date().getFullYear();

  const uploadedUrls: string[] = [];

  await Promise.all(
    files.map(async (file) => {
      const safeName = file.name.replace(/\s+/g, "_");
      const objectRef = ref(
        storage,
        `${year}/ticket_${ticketNumber}/${safeName}`,
      );
      const snapshot = await uploadBytes(objectRef, file, {
        contentType: file.type,
      });
      const url = await getDownloadURL(snapshot.ref);
      uploadedUrls.push(url);
    }),
  );

  await updateDoc(ticketRef, {
    status: "photos_uploaded" as TicketStatus,
    photoUrls: arrayUnion(...uploadedUrls),
    deliveredAt: Timestamp.now(),
  });

  return uploadedUrls;
}

export const AVERAGE_MINUTES_PER_TICKET = 3;
