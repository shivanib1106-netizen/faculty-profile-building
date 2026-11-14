# Phase 4: Faculty Profile Management

## 1. Overview & Objectives
Phase 4 provides comprehensive profile, qualification, and work experience management for faculty members. It ensures data ownership enforcement while allowing authorized HODs and administrators to inspect faculty records.

---

## 2. Profile Structure & Features

### 2.1 Faculty Profile Fields (`FacultyProfile`)
- Unique Employee ID (indexed, enforced uniqueness across the institution).
- Personal information: `first_name`, `last_name`, `date_of_birth`, `gender`, `blood_group`.
- Institutional details: `department_id`, `designation`, `date_of_joining`.
- Academic & professional details: `subjects_handled`, `professional_memberships`, `research_interests`.
- Contact information: `contact_number`, `alternate_email`, `address`.

### 2.2 Qualifications Management (`Qualification`)
- Child entity linked to `FacultyProfile` with cascade delete.
- Fields: `degree`, `specialization`, `institution`, `board_university`, `year_of_passing`, `percentage_or_cgpa`.
- Enforces check constraint ensuring `year_of_passing` is within realistic bounds (1900–2100).

### 2.3 Experience Tracking & Breakdown Calculation (`WorkExperience`)
- Tracks work history across four categories:
  - `teaching`
  - `research`
  - `industry`
  - `previous`
- Includes `organization`, `designation`, `from_date`, `to_date`, `is_current`, and `description`.
- Enforces constraint: `to_date IS NULL OR from_date <= to_date`.
- **Automatic Experience Breakdown**:
  The `calculate_experience_breakdown()` method dynamically evaluates all work experiences and returns:
  ```json
  "experience_summary": {
    "total_experience_years": 8.5,
    "teaching_experience_years": 5.0,
    "research_experience_years": 2.0,
    "industry_experience_years": 1.5,
    "previous_experience_years": 0.0
  }
  ```

---

## 3. Endpoints Implemented

| Method | Endpoint | Allowed Roles | Description |
| :---: | :--- | :---: | :--- |
| `POST` | `/api/faculty/profile` | `faculty` | Create new profile for authenticated user (if not exists). |
| `GET` | `/api/faculty/profile` | Any authenticated | View own profile; HOD can view department faculty (`?faculty_id=`); Admin can view any. |
| `PUT` | `/api/faculty/profile` | `faculty` | Update profile fields for authenticated user. |
| `GET` | `/api/faculty/qualifications` | `faculty` | List all qualifications for authenticated user. |
| `POST` | `/api/faculty/qualifications` | `faculty` | Add educational qualification. |
| `PUT` | `/api/faculty/qualifications/<id>` | `faculty` | Update qualification details (ownership enforced). |
| `DELETE` | `/api/faculty/qualifications/<id>` | `faculty` | Delete qualification record (ownership enforced). |
| `GET` | `/api/faculty/experience` | `faculty` | List all work experience records. |
| `POST` | `/api/faculty/experience` | `faculty` | Add work experience entry. |
| `PUT` | `/api/faculty/experience/<id>` | `faculty` | Update work experience record (ownership enforced). |
| `DELETE` | `/api/faculty/experience/<id>` | `faculty` | Delete work experience entry (ownership enforced). |
