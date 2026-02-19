# Security & Scalability Report — Maker (Makerspace 3D Printers)

## Executive summary

- **Security**: Several **critical** and **high** issues (no auth, secrets exposure risk, open Firestore, no rate limiting). The app is vulnerable to abuse, data tampering, and spam.
- **Scalability**: Current design is fine for a single makerspace; to grow (multiple locations, many printers, high traffic), you’ll need rate limiting, caching, and optional auth/backends.

---

# Part 1 — Security issues (ranked)

## CRITICAL

### 1. Backend API has no authentication

**Where:** `backend/src/index.js`, `backend/src/routes/printers.js`

**Issue:** Every route is unauthenticated. Anyone who knows your backend URL can:

- **GET /api/printers** — list all printers  
- **GET /api/printers/:id**, **GET /api/printers/:id/live** — read any printer and trigger live fetches  
- **POST /api/printers** — add arbitrary printers  
- **PATCH /api/printers/:id** — change status, `photoUrl`, `printerKey`, `estimatedFinish`  
- **DELETE /api/printers/:id** — delete any printer  

**Risk:** Data tampering, deletion, spam (many fake printers), and abuse of your Ultimaker API / internal printer IPs via repeated `/live` calls.

**Recommendation:**

- Add authentication (e.g. API keys, JWT, or Firebase Auth ID token verification).
- Restrict POST/PATCH/DELETE to authenticated (and optionally authorized) users only.
- Keep GET list/detail public only if you explicitly want a public board; protect `/live` if it should be internal-only.

---

### 2. Secrets in `.env` and exposure risk

**Where:** `backend/.env` (and ensure it is never committed)

**Issue:** Your `backend/.env` contains:

- **Firebase Admin private key** (full key)  
- **Firebase client email**  
- **PRINTER_IPS** (internal printer IPs, e.g. `147.26.111.207`, `147.26.111.208`)  

`.env` is in `.gitignore`, which is correct. However:

- If `.env` was ever committed in the past, the key and IPs are in git history.
- Anyone with repo or deployment access can read these secrets.
- **If this report was generated in an environment where .env was read, treat the Firebase private key as potentially exposed** and rotate it in Firebase Console (Project Settings → Service accounts → Generate new key, then revoke the old one).

**Recommendation:**

- Rotate the Firebase Admin private key and update `backend/.env`.
- Never commit `.env`. Use `.env.example` with placeholders only.
- In production (e.g. Railway), use the platform’s secret/env UI; do not ship `.env` in the image.
- Restrict who can see production env vars and repo history.

---

### 3. Firestore and Storage likely open to the world

**Where:** Firebase Console → Firestore rules & Storage rules (and `index.html` comment around 459–464)

**Issue:** The project suggests “allow read/write (for open access)” for Firestore. The frontend writes directly to Firestore and Storage (add/update/delete printers, upload photos) using the client SDK. If Firestore/Storage rules allow unauthenticated read/write:

- Anyone with your Firebase config (e.g. from the built frontend) can read/write the entire `printers` collection and upload/overwrite files in Storage.
- Attackers can spam printers, delete data, or fill Storage.

**Risk:** Data destruction, spam, and abuse without ever touching your backend.

**Recommendation:**

- In Firebase Console, lock Firestore and Storage so that:
  - Either only authenticated users can write (and optionally read), or  
  - Only your backend (via Admin SDK) can write, and the client has read-only access.
- Prefer moving all writes (add/update/delete printers, photo upload) to the backend and protecting those routes with auth; then the client only reads from Firestore (or from your API).

---

## HIGH

### 4. No rate limiting (backend or Firestore)

**Where:** Backend has no `express-rate-limit` (or similar); Firestore usage is unbounded by your code.

**Issue:**

- A script can hit `POST /api/printers` or `GET /api/printers/:id/live` in a loop and cause:
  - Spam (many fake printers), Firestore write cost, and Ultimaker API throttling or abuse.
  - DoS by exhausting your backend or external APIs.
- Client-side Firestore writes (if allowed by rules) can be spammed the same way.

**Recommendation:**

- Add rate limiting on the backend (e.g. `express-rate-limit`): strict for POST/PATCH/DELETE, looser for GET.
- Optionally use Firebase App Check to reduce bot abuse on the client.
- Consider caching `/live` responses per printer (e.g. 30–60 s) to reduce load and Ultimaker calls.

---

### 5. Error messages may leak internal details

**Where:** `backend/src/middleware/errorHandler.js`

**Issue:** The handler sends `err.message` to the client. Some errors (e.g. from Firestore or Ultimaker) might include paths, IDs, or stack-related text that help an attacker.

**Recommendation:**

- For 500s, respond with a generic message (e.g. “Internal server error”) and log the full error server-side only.
- Only send specific messages for intentional 4xx (e.g. “name is required”, “Printer not found”) and avoid leaking stack or paths.

---

### 6. Input validation and injection-style risks

**Where:** `backend/src/routes/printers.js` (POST and PATCH)

**Issue:**

- **POST /api/printers:** Only checks `name?.trim()`. No max length; `printerKey` is not validated (length, allowed chars). Long or weird values could pollute data or cause issues downstream.
- **PATCH /api/printers/:id:** `status`, `photoUrl`, `estimatedFinish`, `printerKey` are accepted as-is. No allowlist for `status`; `photoUrl` could be very long or point to malicious content if rendered in an `<img>`.
- **Route `:id`:** Not validated (e.g. Firestore document ID format). Invalid IDs cause Firestore errors that might be reflected in error responses.

**Recommendation:**

- Enforce max lengths (e.g. name 200 chars, printerKey 100 chars, photoUrl 2048 chars).
- Allowlist `status` (e.g. `available`, `in_use`, `maintenance` only).
- Validate `:id` (e.g. non-empty, allowed charset/length for Firestore doc IDs).
- Sanitize or validate `photoUrl` (URL format, same-origin or allowlisted domains) if you render it in the UI.

---

## MEDIUM

### 7. CORS and frontend URL

**Where:** `backend/src/index.js` — `cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' })`

**Issue:** If `FRONTEND_URL` is wrong or too permissive in production, other origins could call your API. Less critical than auth, but still part of defense in depth.

**Recommendation:** In production, set `FRONTEND_URL` to the exact frontend origin(s). Avoid `*` for credentialed or state-changing requests.

---

### 8. Firebase client config in frontend

**Where:** `frontend/.env` — `VITE_FIREBASE_*` (e.g. API key, project ID, app ID)

**Issue:** These are compiled into the frontend bundle and are public. This is normal for Firebase, but combined with open Firestore/Storage rules they allow full access. Locking rules (see #3) is the main fix.

**Recommendation:** Treat client config as public; rely on Firestore/Storage rules and (optional) Firebase Auth + App Check for security.

---

## LOW

### 9. Health endpoint

**Where:** `GET /health` returns `{ ok: true, time: ... }`

**Issue:** Minimal information disclosure; useful for monitoring. Low risk.

**Recommendation:** Optional: remove `time` if you don’t need it, or keep it for uptime checks.

---

# Part 2 — Hacking and spamming risks

| Risk | Severity | How it could happen | Mitigation |
|------|----------|----------------------|------------|
| **Printer list/data tampering** | Critical | Unauthenticated POST/PATCH/DELETE on backend; or open Firestore write from client | Auth on backend; lock Firestore/Storage rules; move writes to backend |
| **Spam (fake printers)** | Critical | Repeated POST to backend or Firestore add from client | Auth + rate limiting; strict Firestore rules |
| **Data deletion** | Critical | Unauthenticated DELETE or Firestore delete | Same as above |
| **Abuse of /live endpoint** | High | Scripts calling GET `/api/printers/:id/live` in a loop | Rate limiting; short-lived cache per printer; auth if internal-only |
| **Ultimaker API exhaustion** | High | Many /live calls → many token and cluster requests | Cache live status; rate limit; auth |
| **Storage abuse** | High | Open Storage rules + client uploads | Restrict Storage to authenticated users or backend-only uploads |
| **Information disclosure** | Medium | Error messages, health endpoint | Generic 500 responses; minimal health payload |
| **Internal IP exposure** | Medium | Only if backend .env or config is leaked | Keep PRINTER_IPS in env only; rotate secrets if leaked |

---

# Part 3 — Scalability plan

## Current state

- Single backend (e.g. one Railway dyno).
- Firestore for printer list and metadata (scales well).
- Every “live” request can hit Ultimaker API or direct printer IP; no caching.
- No horizontal scaling or queue in code.

## Short term (same app, more users/printers)

1. **Rate limiting**  
   Add `express-rate-limit` (and optionally a Redis store if you run multiple instances) so the API can’t be abused and you stay within Ultimaker quotas.

2. **Cache `/live` responses**  
   In-memory or Redis cache per printer (e.g. TTL 30–60 s) to reduce:
   - Calls to Ultimaker API and to local printer IPs.
   - Response time for repeated requests.

3. **Input validation and safe errors**  
   As in §1 (issues #5 and #6): validate all inputs, allowlist status, and avoid leaking internal errors to the client.

4. **Firestore/Storage rules**  
   Tighten rules so only authenticated users or your backend can write; optional read-only for anonymous if you want a public board.

## Medium term (multiple locations or 10x traffic)

1. **Auth**  
   Firebase Auth (or API keys) for backend and/or client; protect POST/PATCH/DELETE and optionally GET `/live`.

2. **Single source of truth for writes**  
   Move all printer creates/updates/deletes and photo uploads to the backend; client only reads (from API or Firestore). Simplifies auth and auditing.

3. **Structured logging and monitoring**  
   Log errors and key operations (e.g. printer add/delete, failed auth) to a logging/monitoring service for debugging and abuse detection.

4. **Backend deployment**  
   If you run more than one backend instance, use a shared rate-limit store (e.g. Redis) and shared cache for `/live` so limits and cache are consistent.

## Long term (many locations or very high load)

1. **Caching layer**  
   Redis (or similar) for live-status cache and rate-limit state; optional CDN for static frontend.

2. **Read replicas / scaling**  
   Firestore already scales; scale backend horizontally behind a load balancer with shared Redis.

3. **Background jobs**  
   If you add many printers or heavy processing, consider a job queue (e.g. Bull/BullMQ with Redis) so long-running or periodic tasks don’t block API requests.

4. **Per-location or per-tenant data**  
   If you support multiple makerspaces, introduce a tenant/location identifier in data and in auth (e.g. custom claims) so access is scoped correctly.

---

# Part 4 — Prioritized action list

1. **Immediate**  
   - Rotate Firebase Admin private key (and any other secrets that may have been exposed).  
   - Confirm `.env` is never committed and production uses platform secrets.

2. **This week**  
   - Add authentication to the backend (at least for POST/PATCH/DELETE).  
   - Tighten Firestore and Storage rules (no public write).  
   - Add rate limiting to the backend.

3. **Next**  
   - Add input validation and safe error responses.  
   - Cache `/live` responses per printer.  
   - Consider moving all writes to the backend and using Firebase Auth (or API keys) end-to-end.

4. **As you grow**  
   - Implement the short- and medium-term scalability steps above, then the long-term ones if you need multi-location or high load.

---

*Generated for the Maker (makerspace 3D printers) project. Re-evaluate after major changes or before opening to untrusted users.*
