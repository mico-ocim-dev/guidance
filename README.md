# GCO Office Management

Guidance & Counseling Office – LSPU Sta. Cruz. Full Office Management System with **Supabase** as backend (PostgreSQL, Auth, Storage).

## Features

### Auth & roles
- **Login / Register** (Supabase Auth, Gmail validation, email verification)
- **Role-based access**: `user`, `staff`, `admin` (profiles.role)
- **Claim admin**: First user can claim admin from Dashboard; or set in DB
- **Protected admin routes**: Admin and staff-only pages

### Document request system
- Create request (public or logged-in) → auto tracking number (GCO-XXXXXX)
- **Public track**: Enter tracking number to see status
- **Admin**: Update status (pending → processing → ready → released); status logged in `request_status_logs`
- **Processing time**: Computed when status = released (`completed_at - created_at`)
- **Archive**: Archive requests; filter “Show archived”; Export to Excel

### Office monitoring dashboard (admin)
- Live counts from Supabase: total requests, pending, completed, appointments, open tickets
- **Chart.js**: Bar chart (requests by day), Doughnut (status)
- Date filter (From/To), same design system

### Monthly reports (admin)
- Generate report for current month (aggregate document requests, compare to previous month, % change)
- Store in `monthly_reports`; Export to Excel

### Surveys (admin)
- List surveys; view responses; average score per question; Export summary to Excel
- Survey questions and responses in Supabase (`surveys`, `survey_questions`, `survey_responses`)

### Digital logbook (admin/staff)
- Check-in visitor (name, email, phone, purpose); auto timestamp
- Check-out; Active visitors list; Recent entries table

### Help desk / ticketing
- **Public**: Submit ticket at `/tickets/new` (subject, description, email, name)
- **Admin/Staff**: List tickets; update status, priority, assignee; ticket number (TKT-YYYYMM-XXXX)
- Attachments: table `ticket_attachments` (file_path for Supabase Storage); create bucket `ticket-files` in Dashboard for uploads

### CSV / Excel
- **Export**: Document requests, survey summary, monthly report → Excel (xlsx)
- **Import**: `src/lib/csv-import.ts` – `parseCsvFile`, `parseCsvText`, `logImport(importType, fileName, result, userId)` to log to `import_logs`; use for survey responses or logbook import with batch insert

## Design system (LSPU / Transfer Guide)

- **Font:** DM Sans (Google Fonts)
- **Colors:** `--lspu-blue: #1E3A8A`, `--lspu-yellow: #FACC15`
- **Layout:** Public pages = top header + dark blue main area; logged-in = fixed sidebar (260px) with gradient `#1E3A8A` → `#0f172a`, active nav = yellow background + blue text; main area with sticky header (user, logout)
- **Static assets:** Add `public/img/lspu-logo.png` (or `.jpg`) and optionally `public/img/lspu-banner.jpg` for full LSPU branding; the app shows an LSPU placeholder circle if no logo is present.

## Tech stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Chart.js (react-chartjs-2), xlsx
- **Backend**: Supabase (PostgreSQL, Auth, Storage, RLS)

## Database (Supabase) – migration order

Run in **SQL Editor** in this order:

1. `001_initial_schema.sql` – profiles, appointments, document_requests, tracking number, RLS, trigger
2. `002_add_profiles_role.sql` – role column on profiles
3. `003_admin_policies.sql` – admins can update appointments and document_requests
4. `004_claim_admin.sql` – can_claim_admin(), profile update policy
5. `005_full_office_schema.sql` – request_status_logs, users, tickets, ticket_attachments, surveys, survey_questions, survey_responses, logbook_entries, monthly_reports, import_logs; extend document_requests (completed_at, archived_at); RLS; sync users from profiles; add role `staff`

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Run migrations 001 → 005 in the SQL Editor (in order).
3. **Authentication → URL Configuration**: Site URL and Redirect URLs (e.g. `http://localhost:3000/auth/callback`).
4. **Settings → API**: Copy Project URL and anon public key into `.env.local`.

### 2. Environment

```bash
cp .env.local.example .env.local
# Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 3. Run app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Deploy to the cloud

See **[DEPLOY.md](./DEPLOY.md)** for step-by-step hosting (e.g. **Vercel**, Netlify, or other clouds). You only need to set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` on the host and add your production URL to Supabase **Authentication → URL Configuration**.

### 5. Optional: Storage for ticket attachments

In Supabase Dashboard → Storage: create bucket `ticket-files` (private or public as needed). Use Supabase client `storage.from('ticket-files').upload(path, file)` and save `path` in `ticket_attachments`.

## Security

- RLS on all tables; admin/staff policies where specified
- Use env vars for Supabase URL and anon key
- Input validation and file validation on uploads
