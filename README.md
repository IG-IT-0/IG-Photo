# Inner Garden Holiday Photo Queue

Mobile-first queueing + delivery flow for the Inner Garden Christmas party. Parents register and track their spot, the photographer advances the line even while offline, and the assistant drags photos to upload and text out links. Firebase (Firestore + Storage + Cloud Functions) powers the queue, with Twilio hooks for SMS.

## Features
- Parent check-in at `/` with ticket card, current/estimated position, and offline-safe local storage so refreshes keep their place.
- Photographer console at `/photographer` showing the active ticket, with buttons to notify the next group and mark a family as photographed (writes queue even when offline).
- Assistant uploader at `/assistant` listing `completed` tickets with drag-and-drop upload to Storage; writes URLs back and marks tickets `photos_uploaded`.
- Cloud Functions: notify the current ticket + the “5 away” ticket when the queue advances, and text out links when photos are uploaded.
- Staff routes are locked behind a shared password (`STAFF_PASS`) and middleware redirect to `/staff-login`.

## Getting started (web)
1) Install deps and copy envs  
```bash
npm install
cp .env.example .env.local   # fill in Firebase web config
```

2) Run the Next.js app  
```bash
npm run dev
# Parent view:         http://localhost:3000
# Photographer view:   http://localhost:3000/photographer
# Assistant uploader:  http://localhost:3000/assistant
```

## Firestore data model
- `queue/{ticketNumber}`  
  `ticketNumber`, `parentName`, `childName`, `educator`, `phoneNumber`, `status` (`waiting | notification_sent | current | completed | photos_uploaded`), `timestamp`, optional `photoUrls[]`.
- `settings/queue`  
  `currentServingTicket`, `lastTicketNumber`, `updatedAt`.
- Ticket creation and queue advancement are wrapped in Firestore transactions to avoid duplicates and keep the counter in sync.

## Cloud Functions + Twilio
Location: `functions/src/index.ts`
- `onServingChange`: fires when `settings/queue.currentServingTicket` increments. Texts the new current ticket (`It is your turn!`) and the ticket 5 spots away (`Head to the line!`). Also stamps statuses.
- `onPhotosUploaded`: fires when a queue doc status flips to `photos_uploaded`; sends the first photo URL (or `PHOTO_BASE_URL`) by SMS.

Setup & deploy:
```bash
cd functions
npm install             # already done once in this repo
cp ../.env.example .env # add TWILIO_* and PHOTO_BASE_URL or use firebase:config
npm run build
# Deploy (requires firebase CLI login + project):
# firebase deploy --only functions
```
Env keys used in Functions: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `PHOTO_BASE_URL` (optional gallery base).

## Staff auth
- Set `STAFF_PASS` in `.env.local` (and `.env` for deploy). This secures `/photographer` and `/assistant`.
- On access, middleware redirects staff to `/staff-login` where they enter the shared password; success sets an HTTP-only cookie for 12 hours. Use `/api/staff-login` DELETE to clear it if needed.

## Workflow notes
- Average wait time uses a 3 min multiplier per ticket (tweak `AVERAGE_MINUTES_PER_TICKET` in `src/lib/queueActions.ts`).
- Storage path: `/YEAR/ticket_<number>/filename`. Uploads append URLs to the doc and flip status to `photos_uploaded`.
- Photographer actions queue locally; Firestore syncs once the connection returns. The UI shows an online/offline indicator.
- Privacy: the parent view only shows their own ticket; staff views include child/educator names.
