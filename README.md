# China Trip Planner

A Progressive Web App (PWA) for a single China trip: calendar, reminders, contacts with meeting dossiers, company trends and conversation starters, todos, train planning, Didi quick access, and meeting recording/transcription.

**Use on laptop:** Open in any modern browser.  
**Use on iPhone:** Open the app URL in Safari → Share → “Add to Home Screen”. Then open from the home screen for an app-like experience and mic/notifications.

## Features

- **Calendar** – Set trip start/end in Settings; view each day in China and add events.
- **Reminders** – “What’s next” on the home page; optional push notifications (enable in Settings).
- **Contacts** – Add contacts, link to events, paste or upload vCard; view per-contact dossiers.
- **Company trends** – On a contact, load company data (Finnhub) and generate conversation starters (Claude).
- **Todos** – End-of-day list with optional due date; filter by “Today” or “All”.
- **Meeting dossiers** – Record meetings, transcribe (Whisper), summarize (Claude), save per contact.
- **Didi** – “Open Didi” button and saved pickup/dropoff places for copy-paste.
- **Trains** – Planned routes list and one-click link to Trip.com to book high-speed rail.
- **Offline** – App shell and static assets are cached; calendar, contacts, and todos use cached data when offline.

## Setup (no coding)

1. **Clone and deploy**
   - Push this repo to GitHub and connect it to [Vercel](https://vercel.com). Deploy.
   - Or run locally: `npm install` then `npm run dev` and open http://localhost:3000.

2. **Environment variables (Vercel)**
   - In the Vercel project → Settings → Environment Variables, add (optional but recommended):
     - **Firebase (client):** `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`
     - **Firebase Admin (server):** `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (from a Firebase service account JSON)
     - **API keys:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `FINNHUB_API_KEY`
     - **Push (optional):** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (generate with `npx web-push generate-vapid-keys`)

3. **Firebase (required for calendar, contacts, todos, and assistant)**
   - If users see “The assistant isn’t available” or data doesn’t load, Firebase isn’t set up yet. Do the following:
   - Create a project at [Firebase Console](https://console.firebase.google.com). Enable **Authentication** → Sign-in method → **Anonymous** (so users get a session without a sign-up form). Enable **Firestore** (Create database; start in test mode for dev, then add rules before production).
   - **Client config:** In Project settings → General, under “Your apps”, add a web app. Copy the config and set in Vercel (or `.env.local`): `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.
   - **Server (Admin) config:** Project settings → Service accounts → Generate new private key. From the JSON, set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` (use the `private_key` value; in Vercel, paste as one line with `\n` for newlines).

4. **In the app**
   - Open **Settings**. Enter your **trip start** and **trip end** dates and timezone. Optionally paste API keys (Claude, OpenAI, Finnhub) if you prefer not to use env vars.
   - On iPhone: open the deployed URL in Safari → Share → Add to Home Screen. Allow mic (and notifications if you want push).

## API keys

- **Claude (Anthropic)** – Conversation starters and meeting summaries. Get a key at [anthropic.com](https://www.anthropic.com).
- **OpenAI** – Whisper transcription for meeting recordings. Get a key at [platform.openai.com](https://platform.openai.com).
- **Finnhub** – Company profile and news for “Prepare for meeting”. Free key at [finnhub.io](https://finnhub.io).

You can set these in Vercel env vars or in the app Settings (stored in Firebase per user).

## Tech stack

- Next.js (App Router), React, Tailwind CSS
- Firebase (Auth + Firestore) for persistence and optional API key storage
- PWA: manifest + service worker for install and offline shell; IndexedDB for caching events/contacts/todos when offline

## Scripts

- `npm run dev` – Development server
- `npm run build` – Production build
- `npm run start` – Run production build locally
