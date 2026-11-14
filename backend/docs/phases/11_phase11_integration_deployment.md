# Phase 11: Final Integration, Localhost Execution and Git Deployment

## 1. Overview & Objectives
Phase 11 integrates all components, verifies local database execution on MySQL 8.x, runs the live Flask server on localhost, initializes version control, and pushes the repository to the remote Git destination.

---

## 2. Local Environment Configuration

### 2.1 Database Provisioning
- The application connects to local MySQL 8.x on port `3306`.
- Application database: `faculty_api_db`.
- Dedicated application user: `faculty_app` granted full privileges.
- Environment configuration stored securely in `.env`:
  ```dotenv
  DATABASE_URL=mysql+pymysql://faculty_app:FacultyApp123!@127.0.0.1:3306/faculty_api_db?charset=utf8mb4
  ```

### 2.2 Migrations & Baseline Seeding
1. Schema upgrade executed cleanly:
   ```bash
   python -m flask db upgrade
   ```
2. Baseline data and 26 standard UGC template scoring rules seeded:
   ```bash
   python seed.py
   ```
   Seeded demo accounts:
   - Admin: `admin` / `AdminDemo123!`
   - HOD: `hod_cse` / `HodDemo123!`
   - Faculty: `faculty_demo` / `FacultyDemo123!`

---

## 3. Running on Localhost

Start the local development server:
```bash
python run.py
```
Or via the Flask CLI:
```bash
python -m flask --app run.py run --debug --host=127.0.0.1 --port=5000
```

The service is available at `http://127.0.0.1:5000`:
- `GET http://127.0.0.1:5000/` — Health & API banner.
- `GET http://127.0.0.1:5000/health` — Database connection test.
- `GET http://127.0.0.1:5000/api/docs` — Interactive endpoint catalog.

---

## 4. Git Version Control & Remote Repository

- Repository initialized with Git.
- Clean `.gitignore` protecting:
  - Secrets (`.env`, `.env.*`)
  - Uploaded files (`uploads/*`, preserving `uploads/.gitkeep`)
  - Local database caches and standalone configurations (`.mysql-data/`, `mysql-local.ini`)
  - Python and Pytest caches (`__pycache__`, `.pytest_cache`)
- Committed and pushed to GitHub:
  `https://github.com/shivanib1106-netizen/faculty-profile-building.git`
