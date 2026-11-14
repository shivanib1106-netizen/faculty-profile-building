# Phase 9: PDF Report Generation

## 1. Overview & Objectives
Phase 9 provides professional, downloadable PDF report generation for faculty performance indicators using **ReportLab** and **Pandas**.

---

## 2. Report Design & Architecture (`app/services/report_service.py`)

### 2.1 PDF Layout & Styling
The PDF report is built using ReportLab's `SimpleDocTemplate` and `Platypus` flowables:
1. **Header Banner**:
   - Institutional title: "FACULTY PERFORMANCE APPRAISAL SYSTEM - API SCORE REPORT".
   - Subtitle with report generation date and deterministic calculation disclaimer.
2. **Faculty Metadata Block**:
   - Name, Employee ID, Department, Designation, Date of Joining, Contact details.
   - Academic Year and Evaluation Type (`OFFICIAL - VERIFIED ONLY` vs `PROVISIONAL`).
3. **Category Summary Table**:
   - Highlighting Category I, Category II, and Category III raw scores, eligible scores, category caps applied, and final awarded scores.
   - Overall cumulative API score prominently formatted.
4. **Itemized Activity Breakdown Table**:
   - Pre-processed using `pandas.DataFrame` for sorting and structure.
   - Columns: Activity Title & Type, Date, Units, Status, Raw Score, Eligible Score, Final Score, Rule Version, and HOD Remarks.
5. **Sign-Off Section**:
   - Signature blocks for Faculty Member, Head of Department, and Dean / Principal / Chairperson of Screening Committee.

### 2.2 Security & Formatting Safeguards
- **XSS & XML Entity Escaping**: User inputs and titles are sanitized using `xml.sax.saxutils.escape()` before rendering within ReportLab `Paragraph` styles to prevent formatting crashes or XML injection.
- **In-Memory Streaming**: The PDF is assembled into a binary `io.BytesIO` buffer and streamed directly to the client with `mimetype="application/pdf"` and `Content-Disposition="attachment; filename=..."`. No temporary PDF files clutter disk storage.

---

## 3. Endpoints Implemented

| Method | Endpoint | Allowed Roles | Description |
| :---: | :--- | :---: | :--- |
| `GET` | `/api/calculations/report/pdf` | Any authenticated | Generate and download official or provisional API report PDF (`?academic_year_id=`, `?faculty_id=`, `?calculation_type=`). |
