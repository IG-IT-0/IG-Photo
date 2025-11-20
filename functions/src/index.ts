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

async function sendSms(to: string, body: string) {
  if (!smsClient || !twilioFrom) {
    functions.logger.warn("Twilio not configured; skipping SMS", { to, body });
    return;
  }

  await smsClient.messages.create({
    from: twilioFrom,
    to,
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
          `It is your turn! Please head to the Inner Garden photo area. Ticket #${ticket.ticketNumber}`,
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
          `You're up soon! Please start heading over. You are about 5 groups away. Ticket #${ticket.ticketNumber}`,
        ),
      );
      await warmupDoc.ref.set(
        { status: "notification_sent" satisfies TicketStatus },
        { merge: true },
      );
    }

    await Promise.all(smsTasks);
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
      ? `Your photos are ready! View them here: ${link}`
      : `Your photos are ready! Check your gallery for ticket #${after.ticketNumber}.`;

    await sendSms(after.phoneNumber, body);
  });
