# Phase 2: MySQL Database and Model Creation

## 1. Overview & Objectives
Phase 2 implements the complete relational database schema for the system using **MySQL 8.x** and **Flask-SQLAlchemy**. The schema defines strict constraints, primary keys, foreign key cascades, and check constraints to preserve data integrity across all academic entities.

---

## 2. Model Breakdown & Database Entities

The backend models are partitioned across single-concern files in `app/models/`:

### 2.1 Core Identity & Organization
1. **`User` (`app/models/user.py`)**
   - Stores account credentials, username, email, active flag, and role (`faculty`, `hod`, `admin`).
   - Stores PBKDF2/SHA-256 password hash via Werkzeug.
   - Relates to `FacultyProfile`, `Department`, `AcademicActivity`, and `AuditLog`.
2. **`TokenBlocklist` (`app/models/user.py`)**
   - Tracks revoked JWT `jti` identifiers with expiration timestamps for instantaneous token invalidation upon logout.
3. **`Department` (`app/models/department.py`)**
   - Represents academic departments (e.g. CSE, ECE, ME, IT) with unique code and description.
4. **`AcademicYear` (`app/models/academic_year.py`)**
   - Represents institutional academic years (e.g. `2025-2026`) with date ranges and an active indicator.

### 2.2 Faculty Profile & Background
5. **`FacultyProfile` (`app/models/faculty.py`)**
   - Stores unique employee ID, designation, personal details (DOB, gender, blood group), contact details, date of joining, subjects handled, professional memberships, and research interests.
   - Computes real-time dynamic experience breakdown (`teaching`, `research`, `industry`, `previous`, and `total` years).
6. **`Qualification` (`app/models/faculty.py`)**
   - Cascade-related to `FacultyProfile`. Stores degree, specialization, institution, board/university, year of passing (bounded by check constraint 1900–2100), and percentage/CGPA.
7. **`WorkExperience` (`app/models/faculty.py`)**
   - Cascade-related to `FacultyProfile`. Stores organization, designation, experience type (`ck_work_experience_type`: `teaching`, `research`, `industry`, `previous`), `from_date`, `to_date`, `is_current`, and description.
   - Enforces check constraint `from_date <= to_date`.

### 2.3 Academic Activities & Evidence
8. **`ActivityCategory` (`app/models/scoring_rule.py`)**
   - The three core categories (`CATEGORY_I`, `CATEGORY_II`, `CATEGORY_III`).
   - Stores category name, description, `max_score_limit` (caps), and `min_score_required`.
9. **`AcademicActivity` (`app/models/activity.py`)**
   - Represents individual faculty activities tied to an academic year and category.
   - Fields: `title`, `description`, `activity_date`, `duration_or_units`, `co_author_role`, `additional_data` (JSON-serialized string), `status` (`DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`), `hod_remarks`, `raw_score`, `eligible_score`, `final_score`, `category_limit_applied`.
   - Constrained by `ck_activity_status` and `ck_activity_units (> 0)`.
10. **`SupportingDocument` (`app/models/document.py`)**
    - Stores file metadata, original filename, storage filename (UUID), file size, MIME type, SHA-256 checksum, document type, and verification status (`PENDING`, `VERIFIED`, `REJECTED`).

### 2.4 Scoring Rules & Calculation Snapshots
11. **`APIScoringRule` (`app/models/scoring_rule.py`)**
    - Versioned scoring rules configured by administrators.
    - Fields: `rule_code`, `description`, `base_score`, `max_score_per_activity`, `scoring_unit` (`fixed`, `per_unit`, `per_hour`, `per_paper`, `per_book`, `per_chapter`, `per_patent`, `per_project`), `author_role_weights` (JSON mapping), `rule_version`, `is_active`.
12. **`APICalculationHistory` (`app/models/api_score.py`)**
    - Immutable snapshot of full calculations for a faculty member and academic year.
    - Fields: Category-wise raw, eligible, and final scores; category caps applied; total raw, eligible, and final scores; `calculation_type` (`VERIFIED_ONLY`, `ALL_ACTIVITIES`); `status` (`OFFICIAL`, `PROVISIONAL`, `SUPERSEDED`); `rule_version` string; timestamps.
13. **`APIScoreDetail` (`app/models/api_score.py`)**
    - Per-activity itemized score snapshot linked to `APICalculationHistory`.

### 2.5 Workflow, Communication & Auditing
14. **`HODApproval` (`app/models/approval.py`)**
    - Records HOD verification actions (`APPROVED`, `REJECTED`), reviewer user ID, remarks, and timestamp.
15. **`Notification` (`app/models/notification.py`)**
    - User alerts for activity submissions, approvals, and rejections.
16. **`AuditLog` (`app/models/audit_log.py`)**
    - Audit trail logging user ID, action, target entity, target ID, details, IP address, and timestamp.
17. **`SystemSetting` (`app/models/system_setting.py`)**
    - Key-value configuration store for system-wide flags and thresholds.

---

## 3. Database Migration & Baseline Seeding

- Migrations are tracked with Alembic in `migrations/versions/f83c29280150_initial_schema.py`.
- Applied seamlessly using:
  ```bash
  python -m flask db upgrade
  ```
- Seed script (`seed.py` / `flask seed-db`) populates:
  - 4 Academic Departments (CSE, ECE, ME, IT)
  - 2 Academic Years
  - 3 Activity Categories with standard UGC limits
  - 26 standard UGC Regulation 2018 template scoring rules
  - Initial administrator, HOD, and faculty demonstration accounts.
