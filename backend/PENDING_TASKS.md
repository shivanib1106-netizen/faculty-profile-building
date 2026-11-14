# Pending Tasks & Execution Roadmap
## Faculty Profile Builder with Automated API Calculation System

This document outlines the evaluation of the existing codebase, identifies all pending tasks, and tracks their execution step-by-step to final completion and deployment to `https://github.com/shivanib1106-netizen/faculty-profile-building.git`.

---

## 1. Codebase Audit Summary

- **Backend Framework**: Python 3.13 + Flask 3.0.3 strictly (no Django, FastAPI, Node, PHP).
- **Database**: MySQL 8.x + Flask-SQLAlchemy + Flask-Migrate (18 relational tables, clean schema).
- **Authentication & Security**: Flask-JWT-Extended, PBKDF2 password hashing, RBAC decorators, Server-side token blocklist.
- **API Calculation Engine**: Pure deterministic Python scoring engine (`scoring_engine.py` + `api_calculation.py`), with author weights, category caps, and audit snapshots.
- **Reporting**: ReportLab PDF generator + Pandas integration.
- **Testing**: 46 automated Pytest tests passing.
- **Remote Repository**: Contains React 18 UI with `API_CONTRACT.md`. Both frontend and backend need clean unification.

---

## 2. Master Task List

| Task ID | Task Description | Status |
| :---: | :--- | :---: |
| **TASK-01** | **Codebase & Requirement Audit**: Verify all 17 sections of MASTER DEVELOPMENT PROMPT against current implementation. | **COMPLETED** |
| **TASK-02** | **Remote Frontend Integration**: Merge `origin/main` (React frontend, `src/`, `package.json`, `docs/API_CONTRACT.md`) without losing any frontend code. | **IN PROGRESS** |
| **TASK-03** | **Unified Configuration**: Merge `.gitignore` and `.env.example` to support both Flask backend and React frontend. | **PENDING** |
| **TASK-04** | **API Contract Route Harmonization**: Implement companion endpoints & route aliases matching `docs/API_CONTRACT.md` (`/api/academic-years`, `/api/activity-categories`, `/api/config/upload`, `/api/scores*`, `/api/faculty/dashboard/summary`, `/api/faculty/profile/personal`, `/api/hod/verifications`, `/api/hod/summary`, `/api/notifications*`, `/api/auth/change-password`, `/api/reports/*`). | **PENDING** |
| **TASK-05** | **Automated Test Suite Expansion**: Add comprehensive tests covering the harmonized routes and verify 100% pass rate. | **PENDING** |
| **TASK-06** | **Local Database & Service Verification**: Verify MySQL database migrations and seeding via `seed.py` on local instance. | **PENDING** |
| **TASK-07** | **Documentation Updates**: Update `README.md` and `PHASES.md` with complete backend + frontend integration instructions and full endpoint catalog. | **PENDING** |
| **TASK-08** | **Git Staging & Commit**: Stage all unified source files following strict `.gitignore` rules (no secrets, no database data, no build caches). | **PENDING** |
| **TASK-09** | **Remote Push**: Push verified, complete code to GitHub repository `https://github.com/shivanib1106-netizen/faculty-profile-building.git`. | **PENDING** |

---

## 3. Execution Log
- *2026-11-14 12:15*: Audited codebase against Master Development Prompt (17 sections).
- *2026-11-14 12:17*: Identified remote React frontend on `origin/main`.
- *2026-11-14 12:20*: Initialized `PENDING_TASKS.md` tracking document.
