# API Contract — Faculty Profile Builder

This document defines the HTTP contract that the React frontend expects from the
Flask REST backend. **No backend code is included in this repository.** The
contract below is the integration boundary: implement these routes, payloads and
status codes in Flask and the frontend will work without changes.

All network access is centralised in `src/api/`:

| Module | Responsibility |
| --- | --- |
| `apiClient.js` | Base URL, bearer token, JSON/blob handling, timeouts, 401 handling |
| `authApi.js` | Authentication and password flows |
| `facultyApi.js` | Faculty profile, qualifications, experience, dashboard summary |
| `activityApi.js` | Category I/II/III activity CRUD and submission |
| `documentApi.js` | Supporting document vault |
| `scoreApi.js` | Read-only API score retrieval |
| `hodApi.js` | Department summary, faculty, verification, department reports |
| `adminApi.js` | Users, departments, academic years, scoring rules, categories, audit, settings |
| `reportApi.js` | Faculty and institution report preview / PDF download |
| `notificationApi.js` | Notification feed |
| `systemApi.js` | Shared reference data (academic years, categories, upload limits) |

> The opt-in mock backend (`src/api/mock/`) implements exactly this contract and
> is enabled only with `VITE_USE_MOCK=true`. It is a development aid, not a
> substitute for the Flask service.

---

## 1. Conventions

### Base URL

```
VITE_API_BASE_URL=http://localhost:5000/api
```

The frontend requests `"{VITE_API_BASE_URL}{endpoint}"`, for example
`http://localhost:5000/api/auth/login`. Trailing slashes are stripped from the
configured value. If the variable is omitted the client falls back to `/api`
(same-origin, useful behind a reverse proxy).

### Transport and encoding

- HTTPS in production; HTTP is acceptable for local development.
- JSON request/response bodies use `Content-Type: application/json` and
  `Accept: application/json`.
- File upload uses `multipart/form-data` (the browser sets the boundary).
- File download endpoints return raw bytes. The frontend reads them as a
  `Blob`; `Content-Type` should be the real file type (`application/pdf`, etc.).
- Timestamps are ISO 8601 (`2026-11-12T10:15:00Z`). Calendar dates are
  `YYYY-MM-DD`. Academic years are `YYYY-YYYY` (for example `2026-2027`).
- IDs are integers serialised as JSON numbers. The frontend tolerates string
  IDs in route parameters but expects numeric IDs in responses.

### Authentication

Every route except the four public auth routes requires:

```
Authorization: Bearer <token>
```

The token is obtained from `POST /auth/login` and stored in
`localStorage` (remember me) or `sessionStorage` (otherwise) under the keys
`fps_auth_token` and `fps_auth_user`. The frontend treats the token as opaque.

### Roles

`role` is one of the lowercase strings `faculty`, `hod`, `admin`.
The backend is the authority for authorization; the frontend only hides routes
and controls. Every protected endpoint must enforce the role server-side.

### Errors

Non-2xx responses must return JSON with a human-readable message:

```json
{ "message": "A draft or rejected activity can only be edited." }
```

`error` is also accepted as a message key. The frontend maps status codes to
fallback text when no message is present:

| Status | Frontend behaviour |
| --- | --- |
| `400` | Show message / “invalid information” |
| `401` | Clear token, broadcast sign-out, redirect to `/login` |
| `403` | Show “not authorized” (or server message) |
| `404` | Show “record not found” (screens often render an empty state instead) |
| `409` | Show conflict message (duplicate, invalid state transition) |
| `422` | Show “correct the highlighted fields” |
| `5xx` | Show “server could not process the request” |
| network/timeout | `ApiError` with `status: 0`; 30-second timeout |

A `401` on any request signs the user out exactly once through a global
`fps:unauthorized` browser event. A failed `POST /auth/logout` must still clear
the local session — the frontend does this in a `finally` block.

### Response envelopes

Two shapes are accepted consistently by the frontend:

- **List routes** return a bare JSON array.
- **Mutation routes** return `{ "success": true, "message": "...", "data": {...} }`.
  `data` should contain the created/updated record. The frontend falls back to a
  local merge when `data` is absent, but returning it avoids a refetch.
- **Single-resource routes** return the object directly.

The frontend never recalculates API scores. `/scores*` and report values are
displayed exactly as returned.

### CORS (development)

The Vite dev server runs on `http://localhost:5173` (or the port chosen by
`npm run dev`). The Flask API on port 5000 must allow that origin, the
`Authorization` and `Content-Type` headers, and the methods
`GET, POST, PUT, PATCH, DELETE, OPTIONS`. Example:

```python
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:5173"]}},
     allow_headers=["Authorization", "Content-Type"],
     methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
```

Alternatively serve the built frontend from Flask and use a same-origin `/api`
prefix.

---

## 2. Authentication

### `POST /auth/login` — public

Request:

```json
{ "identifier": "faculty@college.edu", "password": "••••••••" }
```

`identifier` is either the institutional email or the employee ID (case-insensitive).

Response `200`:

```json
{
  "token": "<opaque bearer token>",
  "user": {
    "id": 1,
    "name": "Dr. Ramesh Sharma",
    "employeeId": "FAC101",
    "email": "faculty@college.edu",
    "role": "faculty",
    "departmentId": 1,
    "department": "Computer Science and Engineering",
    "designation": "Associate Professor",
    "phone": "+91 98765 43210",
    "status": "active"
  }
}
```

- `token` and `user` are mandatory; the frontend rejects a response without them.
- `user` must never include a password hash.
- Inactive accounts should return `403` with a message.
- Invalid credentials return `401` with `{ "message": "Invalid email/employee ID or password." }`.

### `POST /auth/register` — public (policy-controlled)

Request:

```json
{
  "name": "Prof. Anjali Mehta",
  "employeeId": "FAC102",
  "email": "anjali.mehta@college.edu",
  "phone": "+91 98111 22334",
  "department": "Computer Science and Engineering",
  "designation": "Assistant Professor",
  "password": "••••••••"
}
```

- The frontend sends no `role`; the backend must create a `faculty` account.
- `department` is a free-text name in the registration form. Map it to a
  department record (or reject unknown names with `400`).
- Minimum password length is 8 characters (validated client-side; enforce it
  server-side too).
- If self-registration is disabled in settings, return `403` with a message.
- Duplicate email returns `409`.
- Response: `{ "success": true, "message": "Registration submitted successfully." }`.

### `POST /auth/forgot-password` — public

Request: `{ "email": "faculty@college.edu" }`

Response `200`: `{ "success": true, "message": "If the email exists, reset instructions have been sent." }`

Always return `200` for unknown emails (no account enumeration). The email
should contain a link to the frontend route `/reset-password?token=<token>`.

### `POST /auth/reset-password` — public

Request: `{ "token": "<reset token>", "newPassword": "••••••••" }`

Response `200`: `{ "success": true, "message": "Password updated successfully." }`
Invalid/expired token: `400` or `410` with a message.

### `POST /auth/change-password` — authenticated

Request: `{ "oldPassword": "••••••••", "newPassword": "••••••••" }`

Response `200`: `{ "success": true, "message": "Password changed successfully." }`
Wrong current password: `400`.

### `GET /auth/me` — authenticated

Response `200`: the current user object (same shape as `login.user`).
Returning `{ "user": {...} }` is also accepted.

### `POST /auth/logout` — authenticated

Response `200`: `{ "success": true }`. The frontend clears local state even if
this call fails.

---

## 3. Faculty profile

All routes require `role = faculty` and operate on the authenticated user only.

### `GET /faculty/profile`

Response `200`:

```json
{
  "personalInfo": {
    "userId": 1,
    "fullName": "Dr. Ramesh Sharma",
    "employeeId": "FAC101",
    "dateOfBirth": "1984-06-15",
    "gender": "Male",
    "email": "faculty@college.edu",
    "phone": "+91 98765 43210",
    "address": "42 Academic Enclave, University Campus, Pune - 411007",
    "department": "Computer Science and Engineering",
    "designation": "Associate Professor",
    "dateOfJoining": "2015-08-01"
  },
  "qualifications": [ /* see GET /faculty/qualifications */ ],
  "experience": [ /* see GET /faculty/experience */ ]
}
```

The frontend derives a local **profile completeness** percentage from these
fields and section presence. That percentage is a UI indicator only — it is not
an API score.

### `PUT /faculty/profile/personal`

Request: the `personalInfo` object above (all editable fields).
Response `200`: `{ "success": true, "message": "...", "data": { ...personalInfo } }`.

The backend should keep the linked user record (`name`, `phone`) in sync.

### Qualifications

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `GET` | `/faculty/qualifications` | — | Array of qualification records |
| `POST` | `/faculty/qualifications` | Qualification body | `{ success, message, data: record }` |
| `PUT` | `/faculty/qualifications/{id}` | Qualification body | `{ success, message }` |
| `DELETE` | `/faculty/qualifications/{id}` | — | `{ success, message }` |

Qualification body:

```json
{
  "degree": "Ph.D.",
  "specialization": "Artificial Intelligence & Machine Learning",
  "university": "Indian Institute of Technology, Bombay",
  "yearOfPassing": "2014",
  "percentageOrCgpa": "9.4 CGPA"
}
```

`yearOfPassing` is a string in the UI but a 4-digit year is expected.

### Experience

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `GET` | `/faculty/experience` | — | Array of experience records |
| `POST` | `/faculty/experience` | Experience body | `{ success, message, data: record }` |
| `PUT` | `/faculty/experience/{id}` | Experience body | `{ success, message }` |
| `DELETE` | `/faculty/experience/{id}` | — | `{ success, message }` |

Experience body:

```json
{
  "institution": "City College of Engineering",
  "designation": "Associate Professor",
  "employmentType": "Full-Time Permanent",
  "startDate": "2019-07-01",
  "endDate": "",
  "isCurrent": true,
  "totalExperience": "6 years"
}
```

`employmentType` values used by the UI: `Full-Time Regular`,
`Full-Time Permanent`, `Contractual / Tenure`, `Adjunct / Visiting`,
`Postdoctoral Fellow`. `totalExperience` is optional free text.

### `GET /faculty/dashboard/summary`

Response `200`:

```json
{
  "profile": { /* personalInfo */ },
  "completionPercentage": 92,
  "stats": {
    "totalSubmitted": 5,
    "totalActivities": 7,
    "approved": 4,
    "pending": 2,
    "rejected": 1,
    "draft": 1
  },
  "apiScore": {
    "academicYear": "2026-2027",
    "calculationDate": "2026-11-10",
    "verificationStatus": "Provisional",
    "overallScore": {
      "totalClaimed": 245,
      "totalApproved": 185,
      "applicableCap": 230,
      "finalAccepted": 185
    },
    "categories": [ /* category score objects */ ]
  },
  "recentActivities": [ /* up to 5 activity objects */ ]
}
```

`apiScore` may be `null` or omitted when no score exists. The frontend then
shows an empty state; it never invents a score.

---

## 4. Activities (Category I, II, III)

All activity routes are scoped to the authenticated faculty member. HODs read
activities through `/hod/*` instead.

### Activity object

```json
{
  "id": 101,
  "facultyId": 1,
  "facultyName": "Dr. Ramesh Sharma",
  "employeeId": "FAC101",
  "department": "Computer Science and Engineering",
  "category": "Category I",
  "categoryKey": "cat1",
  "activityType": "Teaching Workload",
  "title": "Advanced Machine Learning & Deep Learning (CS701)",
  "academicYear": "2026-2027",
  "activityDate": "2026-09-01",
  "submissionDate": "2026-11-05",
  "status": "Approved",
  "details": "16 weeks of lecture delivery, 4 contact hours/week...",
  "remarks": "",
  "documentId": 1,
  "documentName": "CS701_Attendance_Syllabus.pdf",
  "verifiedBy": "Dr. Sunita Deshmukh",
  "verifiedAt": "2026-11-06T09:30:00Z"
}
```

- `categoryKey` is `cat1`, `cat2` or `cat3`.
- `status` is one of `Draft`, `Pending`, `Approved`, `Rejected`. The frontend
  also treats `Submitted` as pending where relevant.
- Category-specific fields are accepted and stored as sent (see below).

### Category-specific request fields

Category I (`cat1`): `courseCode`, `semester` (`Odd Semester` / `Even Semester`),
`contactHoursPerWeek`, `numberOfStudents`, `activityDate`, `details`,
`documentName`.

Category II (`cat2`): `role`, `organizingBody`, `durationDays`, `activityDate`,
`details`, `documentName`.

Category III (`cat3`): `journalOrPublisher`, `issnOrIsbn`, `indexing`,
`impactFactor`, `grantAmount`, `authorshipRole`, `activityDate`, `details`,
`documentName`.

The backend should ignore unknown fields rather than reject them.

### Routes

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `GET` | `/activities` | Query filters below | Array of activities |
| `GET` | `/activities/{id}` | — | Activity object (`404` if not owned) |
| `POST` | `/activities` | Activity body incl. `status` | `{ success, message, data: activity }` |
| `PUT` | `/activities/{id}` | Activity body | `{ success, message, data: activity }` |
| `DELETE` | `/activities/{id}` | — | `{ success, message }` |
| `POST` | `/activities/{id}/submit` | `{}` | `{ success, message }` |

Query parameters for `GET /activities` (all optional, omit when `all`):

- `category` — `Category I` / `Category II` / `Category III`
- `academicYear` — `2026-2027`
- `status` — `Draft` / `Pending` / `Approved` / `Rejected`
- `search` — free text over title/type/details

### State rules (must be enforced server-side)

- Create with `status: "Draft"` or `"Pending"`.
- Edit and delete are allowed only when status is `Draft` or `Rejected`.
  Editing/submitting `Pending`, `Submitted` or `Approved` must return `409`.
- `POST /activities/{id}/submit` moves `Draft` or `Rejected` → `Pending` and
  sets `submissionDate`. Any other source status returns `409`.
- On submission the backend should notify the department HOD.

---

## 5. Documents

Scoped to the authenticated faculty member.

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `GET` | `/documents` | — | Array of document metadata |
| `POST` | `/documents/upload` | `multipart/form-data` | `{ success, message, data: document }` |
| `DELETE` | `/documents/{id}` | — | `{ success, message }` |
| `GET` | `/documents/{id}/download` | — | Binary file (`Blob`) |

Upload form fields:

- `title` (string, required)
- `category` (string, required) — one of `Educational Qualification`,
  `Work Experience`, `Research Publication`, `Workshop / FDP`,
  `Teaching Material`, `Patent / Project`, `Other Academic Record`
- `file` (binary, required)

Document metadata:

```json
{
  "id": 1,
  "title": "Ph.D. Degree Certificate",
  "category": "Educational Qualification",
  "fileName": "PhD_Degree_Certificate_IITB.pdf",
  "fileSize": "2.4 MB",
  "fileType": "application/pdf",
  "uploadDate": "2026-08-15",
  "status": "Verified"
}
```

`status` is `Pending`, `Verified` or `Rejected`. `fileSize` is a display string
(for example `"2.4 MB"`). Store the file outside the web root and stream it only
through the authenticated download route.

Upload limits come from `GET /config/upload`; the server must independently
validate MIME type and size.

---

## 6. API scores (read-only)

| Method | Path | Query | Response |
| --- | --- | --- | --- |
| `GET` | `/scores` | `academicYear` (optional) | Score object |
| `GET` | `/scores/category/{key}` | `academicYear` (optional) | Category score object |

`key` is `cat1`, `cat2` or `cat3`.

Score object:

```json
{
  "academicYear": "2026-2027",
  "calculationDate": "2026-11-10",
  "verificationStatus": "Provisional",
  "overallScore": {
    "totalClaimed": 245,
    "totalApproved": 185,
    "applicableCap": 230,
    "finalAccepted": 185
  },
  "categories": [
    {
      "key": "cat1",
      "title": "Category I – Teaching, Learning and Evaluation",
      "totalActivities": 5,
      "approvedActivities": 4,
      "rawScore": 90,
      "eligibleScore": 85,
      "applicableCap": 100,
      "finalScore": 85,
      "status": "Verified",
      "breakdown": [
        { "item": "Lectures, Seminars & Tutorials", "claimed": 50, "approved": 50 }
      ]
    }
  ]
}
```

If no score exists for the year, return `404`. The frontend renders an empty
state for `404` and an error banner for other failures. It must never compute or
adjust these numbers.

---

## 7. HOD routes

All routes require `role = hod` and are restricted to the HOD's department.
Cross-department access returns `403`; unknown records return `404`.

### `GET /hod/summary`

```json
{
  "departmentName": "Computer Science and Engineering",
  "totalFaculty": 4,
  "totalSubmitted": 5,
  "pendingVerification": 2,
  "approvedActivities": 3,
  "rejectedActivities": 1,
  "recentSubmissions": [ /* up to 6 activity objects */ ],
  "facultyScoreOverview": [
    {
      "id": 1,
      "name": "Dr. Ramesh Sharma",
      "employeeId": "FAC101",
      "submitted": 5,
      "approved": 3,
      "pending": 2,
      "score": 185,
      "status": "Active"
    }
  ]
}
```

`score` may be `null` when no score exists.

### `GET /hod/faculty`

Array of department faculty:

```json
{
  "id": 1,
  "name": "Dr. Ramesh Sharma",
  "employeeId": "FAC101",
  "designation": "Associate Professor",
  "email": "faculty@college.edu",
  "phone": "+91 98765 43210",
  "status": "active",
  "totalActivities": 7,
  "approvedActivities": 4,
  "pendingActivities": 2,
  "currentScore": 185,
  "department": "Computer Science and Engineering"
}
```

### `GET /hod/faculty/{id}`

```json
{
  "profile": { /* personalInfo */ },
  "qualifications": [ /* ... */ ],
  "experience": [ /* ... */ ],
  "stats": {
    "totalActivities": 7,
    "approved": 4,
    "pending": 2,
    "rejected": 1,
    "draft": 0,
    "totalSubmitted": 5
  },
  "apiScore": { /* score object or null */ },
  "completionPercentage": 92,
  "activities": [ /* activity objects */ ]
}
```

### `GET /hod/faculty/{id}/scores`

Returns the faculty member's score object; `404` when none exists.

### `GET /hod/verifications`

Query parameters: `status`, `category`, `academicYear`, `search`
(same semantics as `/activities`). Returns department activities as an array.

### `POST /hod/activities/{id}/verify`

Request:

```json
{ "status": "Approved", "remarks": "Verified against the uploaded certificate." }
```

- `status` must be `Approved` or `Rejected` (`400` otherwise).
- `remarks` is mandatory when rejecting.
- Only `Pending`/`Submitted` activities may be verified; otherwise `409`.
- Response: `{ "success": true, "message": "...", "data": activity }`.
- The backend should notify the faculty member and write an audit log entry.

### Department reports

| Method | Path | Query | Response |
| --- | --- | --- | --- |
| `GET` | `/hod/reports` | `type`, `academicYear` | Report preview object |
| `GET` | `/hod/reports/download` | `type`, `academicYear` | PDF (`Blob`) |

Report `type` values used by the UI: `department-summary`, `faculty-api`,
`verification`.

---

## 8. Admin routes

All routes require `role = admin`.

### `GET /admin/metrics`

```json
{
  "totalUsers": 7,
  "totalFaculty": 4,
  "totalDepartments": 5,
  "totalActivities": 7,
  "pendingApprovals": 2,
  "activeAcademicYear": "2026-2027",
  "systemActivitySummary": [
    { "id": 1, "action": "User Created", "target": "Dr. Vivek Kulkarni (FAC103)", "time": "2026-11-12T09:12:00Z" }
  ]
}
```

### Users

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `GET` | `/admin/users` | — | Array of user objects (no passwords) |
| `POST` | `/admin/users` | User body | `{ success, message, data: user }` |
| `PUT` | `/admin/users/{id}` | User body | `{ success, message, data: user }` |
| `PATCH` | `/admin/users/{id}/status` | `{}` | `{ success, message, data: user }` |

User create/update body:

```json
{
  "name": "Smoke Test Faculty",
  "employeeId": "FAC105",
  "email": "faculty5@college.edu",
  "phone": "+91 90000 00000",
  "role": "faculty",
  "departmentId": 1,
  "department": "Computer Science and Engineering",
  "designation": "Assistant Professor",
  "password": "optional-temporary-password"
}
```

- `password` is optional. When omitted the backend must generate a temporary
  password or send an activation link.
- `departmentId` is `null` for administrators.
- The status endpoint toggles `active` ↔ `inactive` and must refuse to
  deactivate the requesting admin's own account (`409`).
- Duplicate email returns `409`.

### Departments

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `GET` | `/admin/departments` | — | Array incl. `facultyCount` |
| `POST` | `/admin/departments` | Department body | `{ success, message, data }` |
| `PUT` | `/admin/departments/{id}` | Department body | `{ success, message, data }` |

```json
{ "code": "CSE", "name": "Computer Science and Engineering", "hod": "Dr. Sunita Deshmukh", "activeStatus": "Active" }
```

`code` is unique (`409` on duplicate). `activeStatus` is `Active` or `Inactive`.

### Academic years

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `GET` | `/admin/academic-years` | — | Array of academic years |
| `POST` | `/admin/academic-years` | Academic year body | `{ success, message, data }` |
| `PATCH` | `/admin/academic-years/{id}/set-active` | `{}` | `{ success, message }` |

```json
{
  "year": "2027-2028",
  "startDate": "2027-07-01",
  "endDate": "2028-06-30",
  "submissionDeadline": "2028-04-30",
  "status": "Upcoming"
}
```

`year` must match `YYYY-YYYY` and be unique. `status` is `Active`, `Upcoming` or
`Archived`. Activating one year must archive the previously active year; exactly
one year should be `Active`.

### Scoring rules

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `GET` | `/admin/scoring-rules` | — | Array of rules |
| `PUT` | `/admin/scoring-rules/{id}` | Rule body | `{ success, message, data }` |

```json
{
  "id": 1,
  "category": "Category I",
  "subCategory": "Direct Teaching / Lectures",
  "maxScore": 60,
  "scorePerUnit": "1 score per 10 teaching hours",
  "ruleVersion": "UGC-CAS-2018-v2"
}
```

Rule updates change future backend calculations only. The frontend does not
recalculate existing scores.

### Activity categories

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `GET` | `/admin/activity-categories` | — | Array of categories |
| `POST` | `/admin/activity-categories` | Category body | `{ success, message, data }` |
| `PUT` | `/admin/activity-categories/{id}` | Category body | `{ success, message, data }` |

```json
{
  "key": "cat1",
  "name": "Category I – Teaching, Learning and Evaluation",
  "shortName": "Category I",
  "status": "Active",
  "activityTypes": ["Teaching Workload", "Curriculum Development"]
}
```

`key` is immutable after creation and must be unique.

### Audit logs

`GET /admin/audit-logs` → array:

```json
{ "id": 1, "actor": "Admin Officer", "action": "User Created", "target": "Dr. Vivek Kulkarni (FAC103)", "ipAddress": "10.0.4.18", "timestamp": "2026-11-12T09:12:00Z" }
```

Read-only. The backend records entries for administrative and verification
actions.

### Settings

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `GET` | `/admin/settings` | — | Settings object |
| `PUT` | `/admin/settings` | Settings body | `{ success, message, data }` |

```json
{
  "institutionName": "College of Engineering & Technology",
  "supportEmail": "api-cell@college.edu",
  "allowSelfRegistration": false,
  "requireHodRemarksOnRejection": true,
  "maxUploadSizeMb": 10,
  "allowedFileTypes": ["pdf", "jpg", "jpeg", "png"],
  "scoringRuleVersion": "UGC-CAS-2018-v2"
}
```

The update body may omit `scoringRuleVersion` (it is read-only in the UI and
derived from the active scoring rules).

---

## 9. Reports

### Faculty

| Method | Path | Query | Response |
| --- | --- | --- | --- |
| `GET` | `/reports/preview` | `type`, `academicYear` | Report preview |
| `GET` | `/reports/download` | `type`, `academicYear` | PDF (`Blob`) |

Faculty `type` values: `faculty-api`, `academic-year`, `category-wise`,
`activity-wise`, `verification`.

### Institution (admin)

| Method | Path | Query | Response |
| --- | --- | --- | --- |
| `GET` | `/admin/reports/preview` | `type`, `academicYear` | Report preview |
| `GET` | `/admin/reports/download` | `type`, `academicYear` | PDF (`Blob`) |

Admin `type` values: `institution-summary`, `faculty-api`, `category-wise`,
`verification`.

Report preview object (all fields optional except as noted):

```json
{
  "reportType": "faculty-api",
  "academicYear": "2026-2027",
  "generatedAt": "2026-11-12T10:30:00Z",
  "institution": "College of Engineering & Technology",
  "facultyName": "Dr. Ramesh Sharma",
  "employeeId": "FAC101",
  "department": "Computer Science and Engineering",
  "category1Score": 85,
  "category2Score": 40,
  "category3Score": 60,
  "totalScore": 185,
  "status": "Ready",
  "scope": "faculty",
  "facultyCount": 4,
  "institutionTotals": { "faculty": 4, "departments": 5, "activities": 7 },
  "summaryNotes": "Generated from verified activities."
}
```

The frontend displays whichever fields are present. Return `404` when no report
can be produced for the type/year. PDF generation happens server-side; the
frontend only downloads the response body.

---

## 10. Notifications

Scoped to the authenticated user.

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `GET` | `/notifications` | — | Array of notifications |
| `PATCH` | `/notifications/{id}/read` | `{}` | `{ success: true }` |
| `POST` | `/notifications/read-all` | `{}` | `{ success: true }` |

```json
{
  "id": 1,
  "title": "Activity Approved",
  "message": "Your Category I activity was approved by the HOD.",
  "timestamp": "2026-11-12T10:15:00Z",
  "read": false,
  "type": "approval"
}
```

`type` is a display hint: `approval`, `verification`, `remarks`, `score`,
`report`, `submission`, `system`.

---

## 11. Reference data (all authenticated roles)

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/academic-years` | Array of academic years (same shape as admin) |
| `GET` | `/activity-categories` | Array of categories (same shape as admin) |
| `GET` | `/config/upload` | Upload constraints |

`GET /config/upload`:

```json
{
  "maxUploadSizeMb": 10,
  "allowedFileTypes": ["pdf", "jpg", "jpeg", "png"],
  "allowedMimeTypes": ["application/pdf", "image/jpeg", "image/png"]
}
```

The frontend uses `allowedFileTypes` for the file picker and pre-upload
validation, and `maxUploadSizeMb` for the size check. The server must enforce
both regardless of what the client sends.

Forms and filters populate academic years from `/academic-years`; no year is
hardcoded in the UI.

---

## 12. Endpoint summary

| Method | Path | Role |
| --- | --- | --- |
| POST | `/auth/login` | public |
| POST | `/auth/register` | public |
| POST | `/auth/forgot-password` | public |
| POST | `/auth/reset-password` | public |
| POST | `/auth/change-password` | any authenticated |
| GET | `/auth/me` | any authenticated |
| POST | `/auth/logout` | any authenticated |
| GET | `/faculty/profile` | faculty |
| PUT | `/faculty/profile/personal` | faculty |
| GET/POST | `/faculty/qualifications` | faculty |
| PUT/DELETE | `/faculty/qualifications/{id}` | faculty |
| GET/POST | `/faculty/experience` | faculty |
| PUT/DELETE | `/faculty/experience/{id}` | faculty |
| GET | `/faculty/dashboard/summary` | faculty |
| GET/POST | `/activities` | faculty |
| GET/PUT/DELETE | `/activities/{id}` | faculty |
| POST | `/activities/{id}/submit` | faculty |
| GET | `/documents` | faculty |
| POST | `/documents/upload` | faculty |
| DELETE | `/documents/{id}` | faculty |
| GET | `/documents/{id}/download` | faculty |
| GET | `/scores` | faculty |
| GET | `/scores/category/{key}` | faculty |
| GET | `/hod/summary` | hod |
| GET | `/hod/faculty` | hod |
| GET | `/hod/faculty/{id}` | hod |
| GET | `/hod/faculty/{id}/scores` | hod |
| GET | `/hod/verifications` | hod |
| POST | `/hod/activities/{id}/verify` | hod |
| GET | `/hod/reports` | hod |
| GET | `/hod/reports/download` | hod |
| GET | `/admin/metrics` | admin |
| GET/POST | `/admin/users` | admin |
| PUT | `/admin/users/{id}` | admin |
| PATCH | `/admin/users/{id}/status` | admin |
| GET | `/admin/faculty` | admin |
| GET/POST | `/admin/departments` | admin |
| PUT | `/admin/departments/{id}` | admin |
| GET/POST | `/admin/academic-years` | admin |
| PATCH | `/admin/academic-years/{id}/set-active` | admin |
| GET | `/admin/scoring-rules` | admin |
| PUT | `/admin/scoring-rules/{id}` | admin |
| GET/POST | `/admin/activity-categories` | admin |
| PUT | `/admin/activity-categories/{id}` | admin |
| GET | `/admin/audit-logs` | admin |
| GET/PUT | `/admin/settings` | admin |
| GET | `/admin/reports/preview` | admin |
| GET | `/admin/reports/download` | admin |
| GET | `/reports/preview` | faculty |
| GET | `/reports/download` | faculty |
| GET | `/notifications` | any authenticated |
| PATCH | `/notifications/{id}/read` | any authenticated |
| POST | `/notifications/read-all` | any authenticated |
| GET | `/academic-years` | any authenticated |
| GET | `/activity-categories` | any authenticated |
| GET | `/config/upload` | any authenticated |

---

## 13. Mock mode

To exercise the UI without Flask:

```env
VITE_USE_MOCK=true
```

Then `npm run dev` and sign in with one of the demo accounts (password
`Demo@123`):

| Role | Email |
| --- | --- |
| Faculty | `faculty@college.edu` |
| HOD | `hod@college.edu` |
| Admin | `admin@college.edu` |

Mock state is persisted in `localStorage` under `fps_demo_backend_v1`. Clear
that key (or call `resetMockBackend()` from the mock module) to reseed. Mock
mode adds a visible “Demo data” banner. It is never active in a production
build unless the environment variable is explicitly set to `true`.

When `VITE_USE_MOCK` is `false` (the default), all requests go to the real
backend and failures surface as errors — there are no silent fallbacks.
