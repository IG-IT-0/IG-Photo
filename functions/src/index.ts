import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import twilio from "twilio";

type TicketStatus =
  | "waiting"
  | "notification_sent"
  | "current"
  | "completed"
  | "photos_uploaded";

type QueueTicket = {
  ticketNumber: number;
  parentName: string;
  childName: string;
  educator: string;
  phoneNumber: string;
  status: TicketStatus;
  photoUrls?: string[];
  estimatedMinutesAtSignup?: number;
};

const app = admin.apps.length ? admin.app() : admin.initializeApp();
const db = app.firestore();

const twilioSid = process.env.TWILIO_ACCOUNT_SID;
const twilioToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = process.env.TWILIO_FROM_NUMBER;
const photoBaseUrl = process.env.PHOTO_BASE_URL;

const smsClient =
  twilioSid && twilioToken
    ? twilio(twilioSid, twilioToken)
    : null;

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) return `+${digits.replace(/^0+/, "")}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

async function sendSms(to: string, body: string) {
  if (!smsClient || !twilioFrom) {
    functions.logger.warn("Twilio not configured; skipping SMS", { to, body });
    return;
  }

  const formatted = normalizePhone(to);
  if (!formatted) {
    functions.logger.error("Invalid phone for SMS, skipping", { to, body });
    return;
  }

  await smsClient.messages.create({
    from: twilioFrom,
    to: formatted,
    body,
  });
}

export const onServingChange = functions.firestore
  .document("settings/queue")
  .onUpdate(async (change: functions.Change<functions.firestore.DocumentSnapshot>) => {
    const before = change.before.data();
    const after = change.after.data();
    if (
      !after ||
      before?.currentServingTicket === after.currentServingTicket ||
      !after.currentServingTicket
    ) {
      return;
    }

    const currentNumber = after.currentServingTicket as number;

    const currentDoc = await db
      .collection("queue")
      .doc(String(currentNumber))
      .get();
    const warmupDoc = await db
      .collection("queue")
      .doc(String(currentNumber + 5))
      .get();

    const smsTasks: Promise<void>[] = [];

    if (currentDoc.exists) {
      const ticket = currentDoc.data() as QueueTicket;
      smsTasks.push(
        sendSms(
          ticket.phoneNumber,
          `Ho ho ho! It's photo time with Santa! Please bring your little one to the photo spot now. Ticket #${ticket.ticketNumber} 🎅🧒📸`,
        ),
      );
      await currentDoc.ref.set(
        { status: "current" satisfies TicketStatus },
        { merge: true },
      );
    }

    if (warmupDoc.exists) {
      const ticket = warmupDoc.data() as QueueTicket;
      smsTasks.push(
        sendSms(
          ticket.phoneNumber,
          `Jingle jingle! Santa photos coming up soon. You're about 5 families away - please get your kiddo ready. Ticket #${ticket.ticketNumber} ⏳🎅✨`,
        ),
      );
      await warmupDoc.ref.set(
        { status: "notification_sent" satisfies TicketStatus },
        { merge: true },
      );
    }

    await Promise.all(smsTasks);
  });

export const onTicketCreated = functions.firestore
  .document("queue/{ticketId}")
  .onCreate(async (snap) => {
    const ticket = snap.data() as QueueTicket | undefined;
    if (!ticket?.phoneNumber || !ticket.ticketNumber) return;

    const msg = [
      `Ho ho ho! Your family is in Santa's cozy Inner Garden line. Ticket #${ticket.ticketNumber} 🎟️🎄`,
      "We'll text when you're close, when it's your turn, and when your little one's photos are ready. Keep your kiddo nearby for Santa smiles! 🎅✨",
    ].join(" ");

    await sendSms(ticket.phoneNumber, msg);
  });

export const onPhotosUploaded = functions.firestore
  .document("queue/{ticketId}")
  .onUpdate(async (change: functions.Change<functions.firestore.DocumentSnapshot>) => {
    const before = change.before.data() as QueueTicket | undefined;
    const after = change.after.data() as QueueTicket | undefined;
    if (!before || !after) return;

    const statusChangedToUploaded =
      before.status !== "photos_uploaded" &&
      after.status === "photos_uploaded";
    if (!statusChangedToUploaded) return;

    const link =
      after.photoUrls?.[0] ??
      (photoBaseUrl
        ? `${photoBaseUrl}/ticket_${after.ticketNumber}`
        : undefined);

    const body = link
      ? `Yay! Your Santa photos are ready! Peek at your kiddo's magic here: ${link} 🎄✨`
      : `Yay! Your Santa photos are ready! Check the gallery for Ticket #${after.ticketNumber} 🎄✨`;

    await sendSms(after.phoneNumber, body);
  });
