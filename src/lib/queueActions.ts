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
const phoneIndexCollection = collection(db, "phoneNumbers");

export type TicketInput = Omit<
  QueueTicket,
  | "ticketNumber"
  | "status"
  | "timestamp"
  | "photoUrls"
  | "estimatedMinutesAtSignup"
  | "completedAt"
  | "deliveredAt"
>;

function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) {
    // Preserve explicit country code, assume user provided a valid E.164-ish number.
    return `+${digits.replace(/^0+/, "")}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  throw new Error("Please enter a 10-digit mobile number (e.g. 555-555-1212).");
}

export async function createTicket(input: TicketInput) {
  const sanitizedPhone = formatPhoneNumber(input.phoneNumber);
  const phoneIndexRef = doc(phoneIndexCollection, sanitizedPhone);

  return runTransaction(db, async (tx) => {
    const settingsSnap = await tx.get(settingsRef);
    const settings = (
      settingsSnap.exists()
        ? settingsSnap.data()
        : { currentServingTicket: 0, lastTicketNumber: 0 }
    ) as QueueSettings;
    const currentServing = settings.currentServingTicket ?? 0;

    const existingPhoneSnap = await tx.get(phoneIndexRef);
    if (existingPhoneSnap.exists()) {
      const existingTicketNumber = existingPhoneSnap.data()?.ticketNumber as
        | number
        | undefined;
      if (existingTicketNumber) {
        const existingTicketRef = doc(
          queueCollection,
          String(existingTicketNumber),
        );
        const existingTicketSnap = await tx.get(existingTicketRef);
        if (existingTicketSnap.exists()) {
          const existingTicket = existingTicketSnap.data() as QueueTicket;
          const alreadyServed = currentServing > existingTicket.ticketNumber;
          const fullyUploaded = existingTicket.status === "photos_uploaded";
          if (!alreadyServed && !fullyUploaded) {
            throw new Error(
              `This mobile number is already queued as ticket #${existingTicket.ticketNumber}. If you need to make a change, ask a staff member to edit your info.`,
            );
          }
        }
      }
    }

    const nextTicket = (settings.lastTicketNumber ?? 0) + 1;
    const ticketRef = doc(queueCollection, String(nextTicket));
    const estimatedMinutesAtSignup =
      Math.max(nextTicket - (settings.currentServingTicket ?? 0), 0) *
      AVERAGE_MINUTES_PER_TICKET;

    tx.set(ticketRef, {
      ...input,
      phoneNumber: sanitizedPhone,
      ticketNumber: nextTicket,
      status: "waiting" as TicketStatus,
      timestamp: serverTimestamp(),
      estimatedMinutesAtSignup,
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

    tx.set(phoneIndexRef, {
      ticketNumber: nextTicket,
      createdAt: serverTimestamp(),
    });

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
    const warmupRef = doc(queueCollection, String(nextTicket + 5));
    const warmupSnap = await tx.get(warmupRef);

    if (!nextTicketSnap.exists()) {
      throw new Error("No more families in line yet. Wait for new sign ups.");
    }

    tx.update(nextTicketRef, {
      status: "current" as TicketStatus,
    });

    if (warmupSnap.exists()) {
      // Notify the group ~5 spots away so they can start heading over.
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
