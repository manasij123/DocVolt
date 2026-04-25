# DocVault — Multi-Platform Build Guide

DocVault chole 3 platform e — sob ekhon **same backend + same MongoDB** e connected. Same admin login, same PDF, same data.

| Platform | Status |
|---|---|
| **Web (Browser)** | ✅ Auto-deploys with main app — just open the live URL |
| **PWA (Installable Web)** | ✅ Configured — Chrome/Edge "Install" button asbe |
| **Android APK** | ⚙️ Build process below (one-time setup) |
| **Windows Desktop (.exe)** | ⚙️ Build process below (one-time setup) |

---

## 1. Web App + PWA Install

**Apnar action:** kichu na — already configured.

After deployment:
1. Live URL e jao (e.g. `https://docvault.yourdomain.com`)
2. Chrome / Edge address bar e ⊕ "Install DocVault" icon dekhabe
3. Click korle desktop e standalone window hoye install hoye jay (taskbar icon, start menu, etc.)

iOS / Android browser eo "Add to Home Screen" diye install korte parbe.

---

## 2. Android APK (Play Store ready)

**One-time setup (developer machine, NOT in this container):**

```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Login to Expo (free account: https://expo.dev/signup)
eas login

# 3. From /app/frontend folder, init the EAS project
cd /app/frontend
eas init

#   This will replace "REPLACE_WITH_YOUR_EAS_PROJECT_ID" in app.json automatically.

# 4. Update eas.json:
#    Open /app/frontend/eas.json and replace
#    "https://REPLACE_WITH_YOUR_DEPLOYED_BACKEND_URL"
#    with your real deployed backend URL (e.g. https://docvault-api.yourdomain.com)

# 5. Build APK for testing (preview profile)
eas build --platform android --profile preview

#    EAS server build kore APK URL pathabe — phone e download kore install.
#    Same backend e connect korbe.

# 6. Production AAB for Play Store
eas build --platform android --profile production
```

**Build time:** 10-20 minutes on EAS servers (cloud build, free tier paowa jay).

---

## 3. Windows Desktop App (.exe installer)

Pre-configured `/app/desktop/` folder ready ache. Just build kore nin:

**One-time setup (Windows machine):**

```bash
# 1. Install Node.js 18+ on Windows
# 2. Open the desktop folder
cd C:\path\to\app\desktop

# 3. Update main.js → replace WEB_URL with your deployed app URL
#    Edit: const WEB_URL = "https://docvault.yourdomain.com";

# 4. Replace icon.ico with your real app icon (256x256 .ico file)

# 5. Install dependencies
npm install

# 6. Test locally
npm start

# 7. Build the .exe installer
npm run build:win

# Result: dist/DocVault Setup 1.0.0.exe
# User download kore double-click → install → desktop shortcut hoye jay
```

**Mac (.dmg) / Linux (.AppImage / .deb)** build:
```bash
npm run build:mac     # On macOS only
npm run build:linux   # On Linux/Mac
```

---

## How They All Stay In Sync

```
                          ┌─────────────────────────────┐
                          │  FastAPI Backend (1 server) │
                          │  + MongoDB (1 database)     │
                          │  + GridFS PDF storage       │
                          └──────────────┬──────────────┘
                                         │
        ┌────────────────┬───────────────┼───────────────┬────────────────┐
        ▼                ▼               ▼               ▼                ▼
  Web Browser     Installed PWA    Android APK     Windows .exe       iOS App
  (any device)    (Chrome/Edge)    (Phone)         (Electron)         (Future)
```

- Admin admin@example.com diye login korle **same admin session** sob platform e
- Client side e PDF upload korle sob platform e instant dekhabe
- Auth token / role saved per-device locally (SecureStore on mobile, localStorage on web)

---

## Quick FAQ

**Q: Same DB e thakbe to?**
Haan — sob platform same `EXPO_PUBLIC_BACKEND_URL` use kore, jeta same FastAPI + MongoDB e point kore.

**Q: Aro platform — iOS, Mac?**
- iOS: `eas build --platform ios --profile production` (Apple Developer account $99/year lagbe)
- Mac: `cd /app/desktop && npm run build:mac` (macOS machine theke build korte hobe)

**Q: PWA install korle file share kemon kaaj korbe?**
Browser e Web Share API call hobe — Chrome desktop e drag-drop / native share dialog asbe; mobile Chrome e WhatsApp/email all options asbe.

**Q: Update korle sob platform automatic update hobe?**
- Web + PWA: instant (page refresh)
- Desktop .exe: auto-update setup korte hobe (electron-updater) — pore add korbo
- Android APK: Play Store update flow OR manual reinstall
