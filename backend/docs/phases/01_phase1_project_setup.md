# Phase 1: Project Setup and Flask Configuration

## 1. Overview & Objectives
Phase 1 establishes the structural foundation of the **Faculty Profile Builder with Automated API Calculation System**. It configures a modular, extensible, and environment-driven backend using Python and Flask.

---

## 2. Key Components & Implementation

### 2.1 Application Factory Pattern (`app/__init__.py`)
- The backend uses Flask's application factory pattern (`create_app(config_name)`).
- Decouples extension instantiation from runtime application state, enabling test suite isolation (in-memory SQLite for pytest vs. MySQL for development/production).
- Binds global HTTP error handlers (`400`, `404`, `405`, `500`) and standard security response headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`).
- Registers all 7 core REST blueprints under their appropriate URL prefixes.

### 2.2 Shared Extensions (`app/extensions.py`)
- Provides singleton instances of backend extensions without circular dependencies:
  - `SQLAlchemy` (`db`)
  - `Migrate` (`migrate`)
  - `JWTManager` (`jwt`)
  - `CORS` (`cors`)

### 2.3 Configuration Environments (`app/config.py`)
- Reads system environment variables via `python-dotenv` from `.env`.
- Defines distinct configurations:
  - `DevelopmentConfig`: Configured for local MySQL 8.x (`mysql+pymysql://...`), connection pool pre-pinging, and recycling.
  - `TestingConfig`: Overrides database with `sqlite:///:memory:`, sets `TESTING=True`, short token lifespans, and isolated `test_uploads/` folder.
  - `ProductionConfig`: Enforces explicit secret requirements, SSL handling, and strict origin white-listing.
- Parses and enforces file upload parameters:
  - `MAX_CONTENT_LENGTH` = 16 MiB (16,777,216 bytes)
  - `ALLOWED_EXTENSIONS` = `pdf, png, jpg, jpeg, doc, docx`
  - `ALLOWED_DOCUMENT_TYPES` = `certificate, publication_proof, appointment_order, experience_certificate, workshop_certificate, conference_certificate, research_project_document, general, other`.

### 2.4 Entrypoint & CLI Commands (`run.py`)
- Instantiates the application using `os.getenv("FLASK_ENV", "development")`.
- Exposes custom Flask CLI command:
  ```bash
  flask seed-db
  ```
  allowing administrators to seed initial departments, academic years, UGC template rules, and demo accounts from the terminal.

---

## 3. Directory Layout
```
faculty/
├── app/
│   ├── __init__.py          # Application factory & global handlers
│   ├── config.py            # Environment-driven configuration classes
│   ├── extensions.py        # db, migrate, jwt, cors instances
│   ├── models/              # Relational ORM models
│   ├── routes/              # HTTP REST blueprints
│   ├── services/            # Business & calculation logic
│   └── utils/               # Validators, security decorators, file handler
├── migrations/              # Database schema migrations
├── tests/                   # Pytest automated test suite
├── uploads/                 # Secure file storage root
├── run.py                   # Development entrypoint
├── seed.py                  # Baseline data seeder
├── requirements.txt         # Pinned Python dependencies
├── pytest.ini               # Pytest configuration
├── .env.example             # Clean template configuration
└── README.md                # Comprehensive system documentation
```

---

## 4. Verification Endpoints
- `GET /` — Service identification and operational status.
- `GET /health` — Live database connectivity and dialect check.
- `GET /api/docs` — Programmatic discovery of registered routes and methods.
