# logbook

A personal daily logbook — habits, workout split, sleep, and notes. No build
step, no dependencies. Pure HTML/CSS/JS, saves everything to your device via
`localStorage`, and installs as an app on mobile via "Add to Home Screen".

## Run it locally

Just open `index.html` in a browser. (For the service worker/offline caching
to activate, serve it over a local server rather than `file://` — e.g.:)

```bash
npx serve .
# or
python3 -m http.server 8080
```

## Deploy to GitHub Pages (so you can install it on your phone)

1. Create a new repo, e.g. `logbook`.
2. Copy all the files in this folder into the repo root.
3. Push:
   ```bash
   git init
   git add .
   git commit -m "logbook v1"
   git branch -M main
   git remote add origin https://github.com/<your-username>/logbook.git
   git push -u origin main
   ```
4. On GitHub: **Settings → Pages → Source → Deploy from branch → main → / (root) → Save**.
5. After a minute, your app is live at:
   `https://<your-username>.github.io/logbook/`

## Install on your phone

1. Open that URL in Chrome (Android) or Safari (iOS).
2. Tap the **share/menu icon → "Add to Home Screen"**.
3. It launches full-screen from your home screen icon, works offline, and
   keeps your data on-device.

## Cross-device sync (Google sign-in + Firestore)

This version signs you in with Google and stores your data in Firestore, so
your phone, tablet, and laptop all stay in sync automatically.

**One-time setup you (Nithin) already did:**
1. Created a Firebase project and enabled Firestore.
2. Enabled Google as a sign-in provider under Authentication → Sign-in method.
3. Registered a web app and got the `firebaseConfig` (already wired into
   `firebase-init.js`).

**Still needed — Firestore security rules.** Go to Firestore → Rules and set:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
Click **Publish**. Without this, anyone could read/write your data.

**Still needed — authorize your GitHub Pages domain.** Go to Authentication →
Settings → Authorized domains → **Add domain** → enter
`<your-username>.github.io`. Without this, Google sign-in will fail once the
app is live (it works fine on `localhost` already).

**How it behaves:**
- Sign in with Google on any device → your habits/workouts/sleep/notes sync
  within a second or two of any change.
- "Continue without an account" keeps working exactly like before (local
  only, single device, no sync) — useful for quickly trying it out.
- If you sign in later from guest mode, whatever you'd entered as a guest is
  pushed up to your account.



- Data lives in `localStorage` — it's per-browser, per-device. It won't sync
  between your phone and laptop unless you add a backend later (Supabase,
  Firebase, etc. would be simple options if you want that next).
- Everything (tasks, workout split, sleep times, notes) is scoped per
  calendar date, so navigating with the arrows is like flipping pages in a
  diary.
