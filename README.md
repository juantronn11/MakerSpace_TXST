# MakerSpace 3D Printer Tracker

> **Work in Progress** — This application is under active development. Features and documentation may change.

A real-time web application for students and staff at **Texas State University** to check the availability and status of 3D printers in the MakerSpace. No more walking across campus only to find every printer occupied.

---

## Overview

The MakerSpace 3D Printer Tracker displays the live status of all 8 Ultimaker S5 printers in the TXST MakerSpace. Users can view which printers are available, in use, or likely finishing soon — with live countdowns updated in real time.

### Features

- Real-time printer status (Available, In Use, Likely Free, Offline)
- Live countdown timer showing estimated time remaining on active print jobs
- Status updates via Ultimaker Digital Factory API or direct network polling
- Admin-protected controls to update printer status

---

## Architecture

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | React 18 + Vite | Vercel |
| Backend | Node.js + Express | Railway |
| Database | Firebase Firestore | Firebase |

The backend serves as the sole write path to Firestore, using the Firebase Admin SDK. The frontend reads directly from Firestore via real-time listeners (`onSnapshot`) and calls the backend API for any state changes.

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- A Firebase project with Firestore enabled
- (Optional) Ultimaker Digital Factory API credentials

### Local Development

**1. Clone the repository**

```bash
git clone <repository-url>
cd maker
```

**2. Install dependencies**

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

**3. Configure environment variables**

Backend — create `backend/.env`:

```env
PORT=3001
FRONTEND_URL=http://localhost:5173
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
PRINTER_IPS={"ums5-1":"<ip>","ums5-2":"<ip>"}
ADMIN_API_KEY=your-secret-key
```

Frontend — create `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:3001
VITE_ADMIN_KEY=your-secret-key
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

To generate a secure `ADMIN_API_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**4. Run the development servers**

```bash
# Backend (from /backend)
npm run dev

# Frontend (from /frontend)
npm run dev
```

The frontend will be available at `http://localhost:5173`.

---

## Security

Security is taken seriously in this application. The following controls are in place:

| Control | Implementation |
|---|---|
| API key authentication | All mutating routes require an `X-API-Key` header matching `ADMIN_API_KEY` |
| No direct browser writes | All Firestore writes go through the backend using the Admin SDK |
| Rate limiting | 120 requests/min globally; 20 requests/30s on the `/live` endpoint |
| Response caching | 30-second in-memory cache per printer to reduce external API load |
| Input validation | Status allowlist, length caps on all string fields, ID format enforcement |
| Request size cap | Request bodies limited to 64 KB |
| Safe error responses | Internal errors return a generic message in production — no stack traces exposed |

### Firestore Security Rules

Apply the following rules in the Firebase console to prevent unauthorized writes:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /printers/{id} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

### Firebase Storage Rules

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /printer-photos/{allPaths=**} {
      allow read: if true;
      allow write: if true;
    }
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

> **Note for contributors:** Never commit `.env` files or API keys to version control. All secrets must be configured through environment variables in your deployment platform.

---

## Deployment

| Service | Platform | Notes |
|---|---|---|
| Frontend | Vercel | Set `VITE_*` environment variables in project settings |
| Backend | Railway | Set all backend environment variables in Railway dashboard |

The `ADMIN_API_KEY` value must match exactly between Railway and Vercel.

---

## Printer Live Data Modes

The backend supports two methods for fetching live printer job data:

**Mode A — Ultimaker Digital Factory (recommended)**
- Requires `ULTIMAKER_CLIENT_ID` and `ULTIMAKER_CLIENT_SECRET`
- Reaches the Ultimaker cloud API — no firewall issues
- `printerKey` values must match cluster names in the Digital Factory dashboard

**Mode B — Direct IP polling**
- Requires `PRINTER_IPS` JSON mapping printer keys to local IPs
- Currently blocked by the university network firewall
- Will work if IT whitelists the Railway egress IPs or the app is hosted on-campus

---

## For TXST Students

This tool is built specifically for students using the MakerSpace at Texas State University. If a printer shows **Available**, it is likely ready for use — head to the MakerSpace to confirm and start your print. If it shows **In Use** with a countdown, the remaining time shown is an estimate provided by the current user.

If you notice the status is incorrect, please notify MakerSpace staff so they can update it.

---

## Contributing

This project is a work in progress. If you are a TXST developer or student interested in contributing, please reach out to the project maintainer before submitting changes.

When contributing:
- Do not commit secrets, API keys, or `.env` files
- Test changes locally before opening a pull request
- Follow the existing code style in each directory

---

## Roadmap

- [ ] Ultimaker Digital Factory API integration (pending credentials)
- [ ] Firebase Authentication for role-based admin access
- [ ] On-campus hosting or IT firewall whitelist for direct-IP mode
- [ ] Mobile-optimized layout improvements
