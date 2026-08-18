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

## Notes

- Data lives in `localStorage` — it's per-browser, per-device. It won't sync
  between your phone and laptop unless you add a backend later (Supabase,
  Firebase, etc. would be simple options if you want that next).
- Everything (tasks, workout split, sleep times, notes) is scoped per
  calendar date, so navigating with the arrows is like flipping pages in a
  diary.
