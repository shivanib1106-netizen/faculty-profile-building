# Faculty Profile Builder with Automated API Calculation System

A role-based academic dashboard for faculty, Heads of Department (HOD) and
administrators. Faculty build their profile and submit teaching, co-curricular
and research activities; HODs verify them; administrators manage users,
departments, academic years and scoring configuration. Official API scores are
calculated by the backend and only displayed here.

This repository is the **React frontend only**. It talks to an existing Flask
REST backend over JSON.

---

## Contents

- [Tech stack](#tech-stack)
- [Features by role](#features-by-role)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Connecting the Flask backend](#connecting-the-flask-backend)
- [Demo mode](#demo-mode)
- [Available scripts](#available-scripts)
- [Project structure](#project-structure)
- [Route map](#route-map)
- [Authentication and sessions](#authentication-and-sessions)
- [Design system](#design-system)
- [API contract](#api-contract)
- [Testing](#testing)
- [Security notes](#security-notes)
- [Known limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)

---

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 18 (function components and hooks) |
| Language | JavaScript (JSX), no TypeScript |
| Routing | React Router 6 |
| Styling | Plain CSS files only, no CSS framework, no inline styles |
| HTTP | Fetch API via one centralised client |
| Build tool | Vite 5 |
| Icons | Inline SVG through a local `Icon` component |

No Bootstrap, Tailwind, Material UI, Ant Design, jQuery, Next.js, chart library
or AI/chatbot integration is used.

---

## Features by role

### Faculty

- Dashboard with profile completeness, activity statistics and the
  backend-calculated API score (with empty states when no score exists).
- Personal profile editing; educational qualifications and work experience CRUD.
- Category I (teaching), Category II (co-curricular/professional development) and
  Category III (research) activity forms with draft/save-and-submit workflows.
- Unified activity list with search, category, academic-year and status filters.
- Edit, delete and submit only for `Draft` and `Rejected` activities.
- Supporting document vault with server-provided upload limits, authenticated
  downloads and drag-and-drop upload.
- Official API score screen with category-wise breakdown, caps and status —
  display only.
- Reports: preview and server-generated PDF download.
- Notifications and password change.

### HOD

- Department dashboard: faculty count, submissions, pending verification,
  approval/rejection totals and per-faculty score overview.
- Department faculty directory and full profile modal (qualifications,
  experience, completion, activities, score).
- Verification queues: all, pending, approved and rejected.
- Approve/reject with mandatory remarks on rejection; supporting document
  download; only `Pending`/`Submitted` items can be decided.
- Department report preview and PDF download.

### Administrator

- System metrics and recent activity summary.
- User management: create/edit accounts, assign roles and departments,
  activate/deactivate (cannot deactivate your own account).
- Faculty overview (read-only) with activity and score totals.
- Department management, academic-year management with a single active year.
- API scoring rule configuration (reference only; the backend calculates).
- Activity category management (keys and activity types).
- Audit log viewer with search and action filters.
- System settings: institution details, registration policy, rejection-remarks
  policy and upload constraints.
- Institution-wide report preview and PDF download.

### Shared

- Login, registration, forgot password, reset password, change password.
- Role-aware sidebar and navbar, protected routes, `403` and `404` pages.
- Global 401 handling that signs the user out once.
- Responsive layouts for desktop, tablet and mobile.
- Accessible labels, focus states, keyboard-friendly modals and status badges.

---

## Quick start

### Prerequisites

- Node.js 18 or newer (developed on Node 26)
- npm 9 or newer
- The Flask backend running and reachable (optional if using demo mode)

### Install and run

```bash
cd faculty-profile-frontend
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run dev
```

Vite starts on `http://localhost:3000` (configured in `vite.config.js`).

### Production build

```bash
npm run build
npm run preview
```

The static output is written to `dist/`. Serve it from any static host or from
Flask. If the frontend and API are on different origins, configure CORS on the
backend; if they share an origin, set `VITE_API_BASE_URL=/api`.

---

## Environment variables

Vite only exposes variables prefixed with `VITE_`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:5000/api` in `.env.example`; `/api` if unset | Base URL prepended to every API path |
| `VITE_APP_TITLE` | — | Application title metadata |
| `VITE_APP_SHORT_NAME` | — | Short application name |
| `VITE_USE_MOCK` | `false` | Enables the in-browser demo backend |

Example `.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_APP_TITLE=Faculty Profile Builder with Automated API Calculation System
VITE_APP_SHORT_NAME=Faculty Profile
VITE_USE_MOCK=false
```

> `.env` is for local development. For a production build, set the same
> variables in the build environment. Never ship `VITE_USE_MOCK=true`.

---

## Connecting the Flask backend

1. Start Flask so the API is reachable, for example
   `http://localhost:5000/api`.
2. Set `VITE_API_BASE_URL` to that base (including any prefix).
3. Ensure CORS allows the Vite origin, the `Authorization` and `Content-Type`
   headers, and `GET, POST, PUT, PATCH, DELETE, OPTIONS`.
4. Sign in with a real account created by the backend or an administrator.

The frontend expects the routes, payloads, status codes and error format
documented in [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md). No endpoint is
invented at runtime: every call lives in `src/api/`.

If the backend is unreachable, the UI shows a clear connection error
(`ApiError` with `status: 0`) instead of falling back to fake data.

---

## Demo mode

Demo mode exists so the interface can be reviewed without Flask. It is strictly
opt-in:

```env
VITE_USE_MOCK=true
```

Restart `npm run dev`. A visible “Demo data” banner appears, and the login screen
lists the demo accounts:

| Role | Email | Password |
| --- | --- | --- |
| Faculty | `faculty@college.edu` | `Demo@123` |
| HOD | `hod@college.edu` | `Demo@123` |
| Admin | `admin@college.edu` | `Demo@123` |

Demo state is persisted in `localStorage` under `fps_demo_backend_v1`. To reset
it, clear that key in DevTools (or call `resetMockBackend()` from
`src/api/mock/mockAdapter.js`). The mock adapter is loaded lazily, so its dataset
is not part of the normal request path.

When `VITE_USE_MOCK` is `false`, the mock code is never called and real network
errors are surfaced to the user.

---

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Create a production bundle in `dist/` |
| `npm run preview` | Serve the production bundle locally |
| `npm run test:ui` | Headless route/render/responsive smoke test (requires a running dev server with demo mode) |
| `npm run test:flows` | Headless interaction test: faculty create/submit, HOD approve, admin create user (demo mode) |

The two test scripts use `puppeteer-core` and an installed Chrome at
`C:\Program Files\Google\Chrome\Application\chrome.exe` by default. Pass a
different base URL as the first argument:

```bash
node scripts/ui-smoke.mjs http://localhost:3000
node scripts/ui-flows.mjs http://localhost:3000
```

They are development aids and are not part of the production bundle.

---

## Project structure

```
faculty-profile-frontend/
├── docs/
│   └── API_CONTRACT.md        # Assumed backend contract
├── index.html                 # Vite entry (root level)
├── public/
│   └── favicon.svg
├── scripts/
│   ├── ui-smoke.mjs           # Route/render/mobile smoke test
│   └── ui-flows.mjs           # Interaction flow test
├── src/
│   ├── api/
│   │   ├── apiClient.js       # Fetch wrapper, token, 401 event, blobs
│   │   ├── authApi.js
│   │   ├── facultyApi.js
│   │   ├── activityApi.js
│   │   ├── documentApi.js
│   │   ├── scoreApi.js
│   │   ├── hodApi.js
│   │   ├── adminApi.js
│   │   ├── reportApi.js
│   │   ├── notificationApi.js
│   │   ├── systemApi.js
│   │   └── mock/
│   │       ├── demoData.js    # Demo dataset (opt-in only)
│   │       └── mockAdapter.js # Demo route table
│   ├── components/            # Layout, Sidebar, Navbar, Modal, guards, ...
│   ├── context/AuthContext.jsx
│   ├── hooks/                 # useAuth, useReferenceData
│   ├── pages/                 # One component per screen
│   ├── styles/                # global, auth, dashboard, forms, tables, ...
│   ├── utils/helpers.js
│   ├── App.jsx                # Route map and role guards
│   └── main.jsx               # Entry, CSS imports, providers
└── vite.config.js
```

---

## Route map

### Public

| Path | Screen |
| --- | --- |
| `/login` | Sign in |
| `/register` | Faculty self-registration |
| `/forgot-password` | Request reset link |
| `/reset-password?token=…` | Set a new password |

### Faculty (`role = faculty`)

`/faculty/dashboard`, `/faculty/profile`, `/faculty/qualifications`,
`/faculty/experience`, `/faculty/activities`, `/faculty/category-1`,
`/faculty/category-2`, `/faculty/category-3`, `/faculty/documents`,
`/faculty/api-score`, `/faculty/reports`, `/faculty/notifications`,
`/faculty/change-password`.

### HOD (`role = hod`)

`/hod/dashboard`, `/hod/faculty-members`, `/hod/faculty-profiles`,
`/hod/verification`, `/hod/pending-approvals`, `/hod/approved-activities`,
`/hod/rejected-activities`, `/hod/reports`, `/hod/notifications`.

### Admin (`role = admin`)

`/admin/dashboard`, `/admin/users`, `/admin/faculty`, `/admin/departments`,
`/admin/academic-years`, `/admin/scoring-rules`, `/admin/categories`,
`/admin/reports`, `/admin/audit-logs`, `/admin/settings`,
`/admin/notifications`.

Unauthenticated users are redirected to `/login`; authenticated users who open
a route outside their role see `/403`. `/` and `/dashboard` redirect to the
correct role home.

---

## Authentication and sessions

- `POST /auth/login` returns `{ token, user }`. The token is treated as opaque.
- “Remember me” stores the token and user in `localStorage`; otherwise they go to
  `sessionStorage`. The unused storage is cleared on each login.
- On load, an existing token is re-validated with `GET /auth/me`.
- Any `401` clears the token and emits a single global `fps:unauthorized` event;
  `AuthContext` responds by signing out. The user returns to `/login`.
- Logout calls `POST /auth/logout` but always clears local state.
- Roles are never hardcoded into the UI as permissions; the backend must enforce
  them on every route. The frontend only hides navigation and routes.

---

## Design system

- Navy-blue and white academic dashboard theme defined as CSS custom properties
  in `src/styles/global.css`.
- All styling lives in separate CSS files imported once in `src/main.jsx`.
  Components contain no inline style attributes except dynamic progress widths
  (for example score bars), which cannot be expressed in a static stylesheet.
- Shared primitives: cards, tables, stat cards, form controls, alerts, badges,
  modals, empty states and a timeline.
- Responsive breakpoints in `src/styles/responsive.css` cover desktop, tablet
  and mobile. Tables become horizontally scrollable rather than breaking the
  page; the sidebar collapses to a drawer on small screens.

---

## API contract

See [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) for:

- Base URL, headers, encoding and CORS.
- Token and role rules.
- Every endpoint with request/response examples.
- Status codes and error semantics.
- Activity state-transition rules.
- Score, report, notification and reference-data shapes.
- The demo-mode contract.

The mock adapter mirrors this document so screens behave the same way against
the real backend.

---

## Testing

The frontend was verified with:

```bash
npm run build                 # production build must succeed
npm run test:ui               # all faculty/HOD/admin routes, console errors, mobile overflow
npm run test:flows            # create/submit/approve/create-user interaction paths
```

The smoke tests check:

- Login for all three roles.
- Every role route renders the layout, contains content and shows no error
  banner or console error.
- No horizontal page overflow at 1440 px or 390 px.
- Faculty can create a draft and submit it.
- HOD can approve a pending activity with remarks.
- Admin can create a user account.

Run them against demo mode (`VITE_USE_MOCK=true`) with the dev server running.
They are not a substitute for integration testing against the real Flask API.

---

## Security notes

- Never commit `.env` files containing secrets.
- The backend must validate every request; the frontend’s checks are for UX only.
- Store JWTs securely for your deployment model. This app uses browser storage
  because the backend issues bearer tokens; if you adopt cookies, update
  `apiClient.js` accordingly.
- Serve over HTTPS in production.
- Uploaded files must be validated server-side and served only through
  authenticated download routes.
- Do not enable demo mode in production.

---

## Known limitations

- **No backend is bundled.** Real login, file uploads, PDF generation and score
  values require the Flask service described in the API contract.
- The assumed contract may need small path or field adjustments for an existing
  backend. Change them in `src/api/*` only — never in page components.
- Profile completeness is a local UI indicator derived from filled fields and
  section presence; it is not an official API score.
- There is no pagination because the contract returns full arrays. Add it in the
  API modules and tables if dataset size requires it.
- Reports are generated by the backend; the frontend only previews returned JSON
  and downloads returned bytes.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| “Unable to reach the server at …” | Flask not running or wrong base URL | Start Flask; check `VITE_API_BASE_URL` |
| CORS error in the console | Backend does not allow the Vite origin/headers | Configure Flask-CORS as shown in the API contract |
| Immediate redirect to `/login` | Token expired or `/auth/me` returned 401 | Sign in again; check token lifetime |
| Login succeeds but dashboard is empty | Backend returned no data for that user | Verify seed data and role/department links |
| File upload rejected before sending | File type/size outside `/config/upload` | Adjust server config or choose another file |
| PDF download does nothing | Endpoint returned JSON instead of bytes | Return the file with the correct `Content-Type` |
| Demo mode not active | `VITE_USE_MOCK` set after the server started | Restart `npm run dev` |
| Port 3000 already in use | Another process owns the port | Stop it or run `npm run dev -- --port 5173` |
