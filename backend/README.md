# Faculty Profile Builder - Flask REST Backend

A production-grade Flask REST API with automated Academic Performance Indicator (API) calculation under the UGC Regulation 2018 framework.

---

## 1. System Overview

* **Framework**: Flask 3.0.3 (Application Factory pattern)
* **ORM & Database**: SQLAlchemy 2.0 / Flask-SQLAlchemy with MySQL 8.x
* **Migrations**: Flask-Migrate (Alembic)
* **Authentication**: Flask-JWT-Extended (Bearer tokens, role-based access control, server-side blocklist)
* **Reports**: ReportLab (dynamic PDF generation)
* **Testing**: Pytest (in-memory SQLite fixture suite with 52 automated tests)

---

## 2. Directory Structure

```
backend/
├── app/
│   ├── models/            # SQLAlchemy database models
│   ├── routes/            # Blueprint route definitions (Auth, Faculty, Activities, etc.)
│   ├── services/          # Business logic: API calculation engine, approvals, audit, PDF
│   ├── utils/             # Decorators, file validation, custom helpers
│   ├── config.py          # Configuration environments (Dev, Test, Prod)
│   ├── extensions.py      # Extension instances (db, jwt, migrate, cors)
│   └── __init__.py        # Application factory (create_app)
├── migrations/            # Alembic database schema migrations
├── tests/                 # 52 pytest test suites
├── uploads/               # Local evidence storage (git-ignored)
├── docs/phases/           # Comprehensive phase documentation
├── requirements.txt       # Python dependencies
├── run.py                 # Flask server runner
├── seed.py                # Database seeder
├── pytest.ini             # Pytest configuration
├── .env.example           # Environment template
└── .gitignore             # Backend gitignore
```

---

## 3. Quickstart & Local Setup

### 3.1 Python Environment
```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

### 3.2 Environment Variables
Copy `.env.example` to `.env` and fill in your MySQL credentials:
```bash
cp .env.example .env
```

### 3.3 Database Migration & Seeding
```bash
flask --app run.py db upgrade
flask --app run.py seed-db
```

### 3.4 Running the Development Server
```bash
python run.py
```
The server will run at `http://127.0.0.1:5000`.

---

## 4. Running Tests

Run the full automated test suite (52 tests):
```bash
python -m pytest
```

All tests execute against an isolated in-memory SQLite database without requiring a live MySQL instance.
