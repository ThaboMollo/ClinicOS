# Patient Mobile Web App Build Plan (ClinicOS Lite) — MVP v1
> Goal: Patients can **join the queue** and see **live position** on a phone. Minimal friction.

## Scope (MVP)
**Must-have**
- Clinic entry (QR code / link per clinic)
- Join queue (walk-in) with name + phone
- Live queue position + status updates
- Basic intake form submission (very short)
- Privacy-friendly design (no sensitive data on screen)

**Explicitly NOT in MVP**
- Payments
- Video calls
- Prescriptions
- AI diagnosis
- Full medical history / centralized records

---

## UX Flow (MVP)
1. Patient scans clinic QR / opens link: `/c/:clinicSlug`
2. Sees clinic landing + “Join Queue”
3. Enters name + phone → creates/links patient + creates appointment (`waiting`)
4. Redirect to `/q/:appointmentId`:
   - Shows position: “You are #3 in line”
   - Shows status: Waiting / In consultation / Done
   - Shows estimated wait (optional; simple heuristic)
5. Optional: “Complete quick intake” (3–6 questions)

---

## Tech Stack (recommended)
- **Frontend**: React + TypeScript + Vite (same monorepo or separate app)
- **UI**: Tailwind (best for mobile)
- **Data**: Supabase client
- **Realtime**: Supabase Realtime
- **Routing**: React Router

---

## Data Model Dependencies
Uses the same backend tables:
- `clinics` (needs `slug` or `public_code`)
- `patients`
- `appointments`
- `intake_responses`

**Important:** Patient access should be limited. For MVP:
- Patients should only access **their own appointment** via a short-lived token or signed link.

---

## Security Model (MVP-safe)
### Option A (recommended): Signed session token
- Patient joins queue → backend issues a short-lived token tied to appointment_id
- Patient app stores token in localStorage
- Token required to read appointment + queue position

### Option B (simpler but weaker): Public read with strict filtering
- Allow reading minimal appointment fields by appointment_id only
- Ensure appointment IDs are non-guessable (UUID helps) but still not ideal

**Choose A if possible** using Supabase Edge Function to mint/verify tokens.

---

## Backend Checklist (Patient Access)
- [ ] Add `clinic.slug` or `clinic.public_code` for QR links
- [ ] Create Edge Function: `join-queue`
  - Input: clinic_slug, name, phone
  - Behavior:
    - Find or create patient (by phone within clinic)
    - Create appointment for today (`waiting`)
    - Return: appointment_id + access_token (Option A)
- [ ] Create Edge Function: `get-appointment`
  - Input: appointment_id + token
  - Returns minimal appointment view + computed position

---

## Frontend Build Plan
## Phase A — App Skeleton
- [ ] Create React+TS app (or route group in same app)
- [ ] Mobile-first layout
- [ ] Add Supabase client
- [ ] Add routing:
  - [ ] `/c/:clinicSlug` (clinic landing)
  - [ ] `/q/:appointmentId` (queue view)
  - [ ] `/q/:appointmentId/intake` (intake)

**Acceptance**
- Routes render correctly on mobile screen sizes

---

## Phase B — Clinic Landing + Join Queue
### `/c/:clinicSlug`
- [ ] Fetch clinic public info (name, address) by slug
- [ ] Button: “Join Queue”
- [ ] Join form:
  - [ ] Name
  - [ ] Phone
- [ ] Submit → call `join-queue` function
- [ ] Store returned token (Option A)
- [ ] Navigate to `/q/:appointmentId`

**Acceptance**
- Joining creates appointment and redirects to queue view

---

## Phase C — Live Queue View (Core)
### `/q/:appointmentId`
Display:
- [ ] Status label: Waiting / In consultation / Done
- [ ] Live position number (computed from today’s waiting queue)
- [ ] Optional: estimated wait (simple: avg_minutes_per_patient * (position-1))

Realtime:
- [ ] Subscribe to appointment row changes
- [ ] Subscribe to clinic’s today appointments changes (or use `get-appointment` polling every 5–10s if realtime is hard)

Resilience:
- [ ] “Pull to refresh” / refresh button
- [ ] Clear offline message if disconnected

**Acceptance**
- If reception marks status changes, patient view updates within seconds
- Position updates when new patients join / others complete

---

## Phase D — Quick Intake (Minimal)
### `/q/:appointmentId/intake`
- [ ] 3–6 question form (MVP):
  - [ ] Primary symptom (dropdown or short text)
  - [ ] Pain level (0–10)
  - [ ] Duration (today / days / weeks)
  - [ ] Any fever? (yes/no)
  - [ ] Allergies? (yes/no + optional text)
- [ ] Submit → create `intake_responses` row linked to appointment

**Acceptance**
- Doctor/reception can view intake response in admin portal

---

## Phase E — QR Code (Operational)
- [ ] Admin portal should generate a QR for each clinic link:
  - `https://yourdomain.com/c/{clinicSlug}`
- [ ] Print + place at reception

---

## Testing Checklist
- [ ] Patient can’t see other patients’ info
- [ ] Appointment link reuse works (refresh doesn’t break)
- [ ] Joining twice doesn’t create duplicates (idempotency by phone+day optional)
- [ ] Realtime works on mobile data

---

## Deployment
- [ ] Deploy to Vercel
- [ ] Ensure HTTPS (required)
- [ ] Add env vars

---

## MVP Done Definition
- Patient can:
  - [ ] Open clinic link/QR
  - [ ] Join queue with name+phone
  - [ ] See live position + status updates
  - [ ] Submit quick intake
