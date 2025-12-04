import type { Timestamp } from "firebase/firestore";

export type TicketStatus =
  | "waiting"
  | "notification_sent"
  | "current"
  | "completed"
  | "photos_uploaded";

export type QueueTicket = {
  ticketNumber: number;
  parentName: string;
  childName: string;
  educator: string;
  phoneNumber: string;
  status: TicketStatus;
  timestamp?: Timestamp;
  photoUrls?: string[];
  estimatedMinutesAtSignup?: number;
  completedAt?: Timestamp;
  deliveredAt?: Timestamp;
};

export type QueueSettings = {
  currentServingTicket: number;
  lastTicketNumber: number;
  updatedAt?: Timestamp;
};
