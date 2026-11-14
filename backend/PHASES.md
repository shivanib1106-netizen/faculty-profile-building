# Faculty Profile Builder - Comprehensive Phase & Feature Breakdown

This document provides a breakdown of all system features, architecture modules, and execution phases for the **Faculty Profile Builder with Automated API Calculation System**, developed strictly with Python, Flask, and MySQL.

---

## Executive Phase Summary

| Phase | Milestone | Scope & Deliverables | Status | Documentation |
| :---: | :--- | :--- | :---: | :--- |
| **Phase 1** | **Project Setup & Flask Configuration** | Application factory pattern, single-instance extensions (`SQLAlchemy`, `JWTManager`, `Migrate`, `CORS`), environment configs, error handlers, and discovery routes. | **COMPLETE** | [Phase 1 Docs](docs/phases/01_phase1_project_setup.md) |
| **Phase 2** | **MySQL Database & Model Creation** | 17 relational database models, foreign key relationships, cascade rules, check constraints, Alembic migrations, and baseline seeder. | **COMPLETE** | [Phase 2 Docs](docs/phases/02_phase2_mysql_models.md) |
| **Phase 3** | **Authentication & Role-Based Access Control** | PBKDF2/Werkzeug password hashing, JWT bearer tokens, server-side token revocation via `TokenBlocklist`, RBAC decorators, privilege escalation guards. | **COMPLETE** | [Phase 3 Docs](docs/phases/03_phase3_authentication_rbac.md) |
| **Phase 4** | **Faculty Profile Management** | Personal details, unique employee ID, department binding, qualifications CRUD, experience CRUD, and dynamic experience breakdown calculator. | **COMPLETE** | [Phase 4 Docs](docs/phases/04_phase4_faculty_profile.md) |
| **Phase 5** | **Academic Activity Management** | Categories I, II, and III activity tracking, active scoring rule lookups, raw score preview, draft/rejected editing, and submission lifecycle. | **COMPLETE** | [Phase 5 Docs](docs/phases/05_phase5_academic_activity.md) |
| **Phase 6** | **Document Upload & Secure Storage** | Secure upload, dual-layer validation (extension + binary magic-number verification), UUID filename masking, traversal protection, authorized downloads. | **COMPLETE** | [Phase 6 Docs](docs/phases/06_phase6_document_management.md) |
| **Phase 7** | **HOD Verification Workflow** | Department isolation, pending activity queue, verify/approve/reject with mandatory rejection remarks, document status sync, notifications, audit logging. | **COMPLETE** | [Phase 7 Docs](docs/phases/07_phase7_hod_verification.md) |
| **Phase 8** | **Automated API Calculation Engine** | Pure deterministic Python calculation engine (no AI/ML), unit multipliers, author role weights, category caps, proportional scaling, snapshot history (`OFFICIAL` / `PROVISIONAL` / `SUPERSEDED`). | **COMPLETE** | [Phase 8 Docs](docs/phases/08_phase8_api_calculation_engine.md) |
| **Phase 9** | **PDF Report Generation** | ReportLab PDF engine, Pandas data framing, institutional headers, category score tables, activity breakdown, and signature section. | **COMPLETE** | [Phase 9 Docs](docs/phases/09_phase9_pdf_reports.md) |
| **Phase 10** | **REST API Testing & Documentation** | Automated Pytest suite (46 tests covering all flows, 100% passing), in-memory SQLite isolation, and detailed API documentation in `README.md`. | **COMPLETE** | [Phase 10 Docs](docs/phases/10_phase10_testing_documentation.md) |
| **Phase 11** | **Integration, Localhost & Git Deployment** | MySQL database setup, migration upgrade, seeder execution, localhost server verification, and Git push to GitHub repository. | **COMPLETE** | [Phase 11 Docs](docs/phases/11_phase11_integration_deployment.md) |

---

## Detailed Feature Verification Matrix

### 1. User Roles & Access Control
- [x] **Faculty**:
  - Self-registration with optional department binding (`POST /api/auth/register`)
  - Authentication & JWT issuance (`POST /api/auth/login`)
  - Token revocation (`POST /api/auth/logout`)
  - Profile creation, inspection, and update (`/api/faculty/profile`)
  - Educational qualifications CRUD (`/api/faculty/qualifications`)
  - Work experience CRUD with automatic duration aggregation (`/api/faculty/experience`)
  - Academic activity CRUD across Categories I, II, III (`/api/activities`)
  - Activity submission for HOD review (`POST /api/activities/<id>/submit`)
  - Evidence document upload with magic-number validation (`POST /api/documents/upload`)
  - Deterministic score calculation execution & history inspection (`/api/calculations/*`)
  - Official/provisional PDF score report download (`GET /api/calculations/report/pdf`)
  - System notification tracking (`/api/auth/notifications`)
- [x] **HOD (Head of Department)**:
  - Scoped to departmental faculty only (`GET /api/hod/faculty`)
  - Department faculty full profile inspection (`GET /api/hod/faculty/<id>/profile`)
  - Pending activities review queue (`GET /api/hod/activities/pending`)
  - Activity approval (`POST /api/hod/activities/<id>/approve` or `verify`)
  - Activity rejection with mandatory remarks (`POST /api/hod/activities/<id>/reject` or `verify`)
  - Remarks modification (`POST /api/hod/activities/<id>/remarks`)
  - Department performance summary (`GET /api/hod/department-summary`)
  - Standalone document verification (`PUT /api/hod/documents/<id>/verify`)
  - Prohibited from verifying self activities.
- [x] **Administrator**:
  - User CRUD with role assignment and last-admin demotion safeguard (`/api/admin/users`)
  - Department CRUD (`/api/admin/departments`)
  - Academic Year CRUD with single-active enforcement (`/api/admin/academic-years`)
  - Activity Category management and cap configuration (`/api/admin/categories`)
  - API Scoring Rule CRUD and version management (`/api/admin/rules`)
  - System key-value settings management (`/api/admin/settings`)
  - System-wide audit log query and filtering (`GET /api/admin/audit-logs`)
  - Real-time system health & entity summary (`GET /api/admin/system-summary`)
  - Department performance comparative analytics (`GET /api/admin/reports/department-performance`)
  - Institution-wide faculty score leaderboard (`GET /api/admin/reports/faculty-scores`)
  - Batch score recalculation across all faculty (`POST /api/calculations/recalculate-all`)

### 2. Deterministic Scoring Engine
- [x] No AI/ML components or neural networks.
- [x] Separated into `scoring_engine.py` (pure Python, zero web dependencies) and `api_calculation.py` (database orchestrator).
- [x] Supports scoring units: `fixed`, `per_unit`, `per_hour`, `per_paper`, `per_book`, `per_chapter`, `per_patent`, `per_project`.
- [x] Configurable co-author role weight multipliers (e.g. sole author: 1.0, first author: 0.7, co-author: 0.3).
- [x] Per-activity cap enforcement (`max_score_per_activity`).
- [x] Category cap enforcement (`max_score_limit`) with proportional half-up score reduction.
- [x] Rule versioning (`rule_version`) captured per snapshot.
- [x] Dual calculation modes: `VERIFIED_ONLY` (official, approved activities only) and `ALL_ACTIVITIES` (provisional preview).
- [x] Calculation history stored immutably with superseding logic (`OFFICIAL`, `PROVISIONAL`, `SUPERSEDED`).

### 3. Document Management & Upload Security
- [x] Allowed document types: certificates, publication proofs, appointment orders, experience certificates, workshop certificates, conference certificates, research project documents, general, other.
- [x] File extension check (`pdf`, `png`, `jpg`, `jpeg`, `doc`, `docx`).
- [x] Magic-number binary header signature verification.
- [x] 16 MiB size ceiling (`MAX_CONTENT_LENGTH`).
- [x] UUID-based storage names in `uploads/`.
- [x] Directory traversal prevention using common path resolution.
- [x] SHA-256 integrity checksum generation.
- [x] Authorized download verification and verified document deletion protection.

### 4. PDF Reporting
- [x] Built using ReportLab and Pandas.
- [x] Streams directly via HTTP without temporary file accumulation.
- [x] Contains faculty profile header, academic year, evaluation type.
- [x] Contains category totals table (raw, eligible, category cap, final).
- [x] Contains activity itemized breakdown table with status, units, rule version, and HOD remarks.
- [x] Formal sign-off lines for Faculty, HOD, and Committee Dean/Principal.
- [x] Text escaping prevents XML styling injection.

### 5. Automated Pytest Test Suite
- [x] 46 tests across 10 test modules.
- [x] In-memory SQLite isolation.
- [x] 100% test pass rate.
