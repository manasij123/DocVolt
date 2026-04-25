# DocVault — PDF Storage App (PRD)

## Overview
A React Native (Expo) mobile app for organising PDF documents with separate Admin and Client experiences. Targeted at finance / IFA / monthly-return document workflows.

## User Roles
- **Admin** — single account, JWT login (`admin@example.com` / `admin123`), can upload, edit metadata, delete.
- **Client** — no login. Direct read-only access to documents and native share (WhatsApp etc.).

## Categories (4 main tabs)
1. **MONTHLY RETURN** — filename contains "monthly return"
2. **FORWARDING LETTER** — filename contains "forwarding-letter" / "forwarding letter"
3. **IFA REPORT** — filename contains "ifa report" / "ifa_report"
4. **OTHERS** — fallback when no category pattern matches

## Filename → Metadata Detection
- **Category**: substring match (case-insensitive)
- **Month/Year**: regex `\b([A-Za-z]{3,9})\s*['']?\s*(\d{2,4})(?!\d)` extracts forms like `Feb'2026`, `Feb'26`, `Feb 2026`. 2-digit year auto-prefixed with `20`.

## Architecture
- **Frontend**: Expo Router, React Native, expo-document-picker, expo-file-system, expo-sharing, expo-secure-store, axios.
- **Backend**: FastAPI + Motor (MongoDB) + bcrypt + PyJWT. Files saved to `/app/backend/uploads/{uuid}.pdf`.
- **Auth**: JWT Bearer tokens (mobile-friendly), 7-day expiry. Stored in expo-secure-store on device.

## Key Endpoints
| Method | Path | Auth |
|---|---|---|
| POST | `/api/auth/login` | public |
| GET | `/api/auth/me` | admin |
| POST | `/api/documents/upload` | admin (multipart) |
| GET | `/api/documents` | public |
| GET | `/api/documents/years` | public |
| GET | `/api/documents/{id}/file` | public (streams PDF) |
| PUT | `/api/documents/{id}` | admin |
| DELETE | `/api/documents/{id}` | admin |

## Frontend Screens
- `app/index.tsx` — Landing (Admin / Client choice)
- `app/admin/login.tsx` — Admin login
- `app/admin/(tabs)/upload.tsx` — File picker + auto-detected metadata + override
- `app/admin/(tabs)/manage.tsx` — Edit / delete with bottom-sheet form
- `app/client/[monthly|forwarding|ifa|others].tsx` — Year chips + PDF cards with native share

## Sharing flow
On client tap → backend `/file` URL is downloaded to cache via `FileSystem.downloadAsync` → `Sharing.shareAsync` opens the native share sheet (WhatsApp, etc.) on iOS / Android.

## Seed Data
5 PDFs from user uploads (Feb'2026 monthly return, Feb'26 forwarding-letter, Feb'26 IFA report, plus Jan'2025 / Dec'2025 historical samples).

## Smart Business Enhancement
**Auto-categorisation drastically reduces admin workload** — admin just picks a PDF and the app automatically assigns category, year, month. Year-grouped tabbed UI lets clients find any past document in 2 taps. Native share into WhatsApp removes the "find file → copy → forward" friction that drives most internal-document apps.

## Future Ideas
- Push notifications when a new doc is uploaded
- Bulk multi-upload
- Search across categories
- Multiple admin accounts with audit trail
