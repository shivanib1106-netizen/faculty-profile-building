# Phase 3: Authentication and Role-Based Authorization

## 1. Overview & Objectives
Phase 3 implements secure identity management, token issuance, server-side token revocation, and role-based access control (RBAC) across three distinct organizational tiers: `faculty`, `hod`, and `admin`.

---

## 2. Authentication Flow & Security Mechanisms

### 2.1 Password Hashing & Registration Policy
- User passwords are encrypted using Werkzeug's `generate_password_hash` with PBKDF2/SHA-256 and unique per-user salts.
- **Privilege-Escalation Protection**:
  - The public registration endpoint (`POST /api/auth/register`) strictly allows registering accounts with role `faculty`.
  - Attempts to register `hod` or `admin` accounts via the public endpoint return HTTP `403 Forbidden`. Only existing administrators can create elevated roles.
- Input validation verifies that:
  - Usernames match alphanumeric criteria (`3-80` characters).
  - Emails follow RFC standards.
  - Passwords satisfy the minimum length (default `8` characters).

### 2.2 JWT Token Lifecycle & Blocklist Revocation
- Successful login (`POST /api/auth/login`) issues an access token signed with `JWT_SECRET_KEY` containing the subject (`user.id`) and custom claims (`role`, `username`).
- **Server-Side Token Revocation**:
  - Upon calling `POST /api/auth/logout`, the token's unique identifier (`jti`) and expiry timestamp are committed to the `token_blocklist` database table.
  - The JWT callback `check_if_token_revoked` inspects every incoming authenticated request against `TokenBlocklist` and confirms that the owning user account remains `is_active=True`.
  - Revoked tokens return HTTP `401 Unauthorized` with `"Access token has been revoked"`.

### 2.3 Role-Based Access Control (RBAC) Decorators (`app/utils/decorators.py`)
- `@role_required(*allowed_roles)`:
  - Validates that the active caller's JWT identity corresponds to an active user whose `role` belongs to `allowed_roles`.
  - Rejection yields HTTP `403 Forbidden`.
- `@department_scoped`:
  - Enforces that HOD users may only interact with faculty or activities belonging to their own department (`caller.department_id == target.department_id`).
  - Administrators bypass department isolation to manage institutional data.

---

## 3. Endpoints Implemented

| Method | Endpoint | Allowed Roles | Description |
| :---: | :--- | :---: | :--- |
| `POST` | `/api/auth/register` | Public | Register new faculty account (with optional department). |
| `POST` | `/api/auth/login` | Public | Authenticate user credentials and return JWT bearer token. |
| `POST` | `/api/auth/logout` | Any authenticated | Revoke active access token via `TokenBlocklist`. |
| `GET` | `/api/auth/me` | Any authenticated | Retrieve authenticated user profile, department, and role. |
| `GET` | `/api/auth/notifications` | Any authenticated | View system notifications (`?unread_only=true`). |
| `PUT` | `/api/auth/notifications/<id>/read` | Any authenticated | Mark a specific notification as read. |
| `PUT` | `/api/auth/notifications/read-all` | Any authenticated | Mark all user notifications as read. |

---

## 4. Audit Logging
- Successful and failed logins, logouts, and registration actions are recorded directly into `audit_logs` through `AuditService.log_action()`.
