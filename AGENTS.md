# Agent Guidance for Daily Success Planner

## Project Overview
- Single-page React + Vite app built with TypeScript.
- Uses Firebase Authentication and Cloud Firestore for user-backed data sync.
- Supports offline-first state through `localStorage` and a PWA install flow.
- Main app logic is in `src/App.tsx`; Firebase setup is in `src/firebase.ts`.

## Key Files
- `src/App.tsx`: main UI, authentication flow, Firestore sync, offline storage, PWA prompt.
- `src/firebase.ts`: Firebase app initialization and shared Firestore/auth exports.
- `src/main.tsx`: app bootstrap and service worker registration.
- `public/manifest.json`: PWA metadata and icons.
- `firestore.rules`: Firestore security rules governing `users/{userId}` and `users/{userId}/entries`.
- `index.html`: page metadata, including PWA and Apple web app settings.
- `firebase-applet-config.json`: Firebase project settings used by the client.

## Build and Run
- Install: `npm install`
- Run dev server: `npm run dev`
- Build production: `npm run build`
- Preview production build: `npm run preview`
- Lint/type-check: `npm run lint`

## Environment Notes
- The README references `GEMINI_API_KEY` in `.env.local` for AI Studio integration.
- No server-side Node backend is present in this repository; all features are implemented client-side.

## Important Behavioral Details
- Firestore rules require signed-in ownership for reads and writes under `users/{userId}`.
- The app writes user profile documents and entry documents to Firestore only after successful auth.
- The PWA install banner is handled through `beforeinstallprompt`. The app stores the event and only prompts later when the user clicks the install button.

## What to Watch For
- Do not assume there is a backend API; authentication and data persistence are entirely Firebase-based.
- When updating Firebase behavior, verify both client code and `firestore.rules` together.
- The service worker registration is in `src/main.tsx` and the service worker file lives at `/sw.js`.

## Suggested Next Customizations
- Create a `.github/copilot-instructions.md` or extend `AGENTS.md` if you want stronger guidance for debugging Firebase auth, PWA installation, or offline sync behavior.
- Add a dedicated skill for Firebase rule changes and PWA prompt handling if this repo evolves into more cloud-backed features.
