# Phase 6: Document Upload and Storage

## 1. Overview & Objectives
Phase 6 establishes evidence storage for supporting certificates, papers, appointment orders, and research proofs. It implements defense-in-depth security to prevent arbitrary file upload vulnerabilities, path traversal, and unauthorized access.

---

## 2. Security Controls & Architecture

### 2.1 Dual-Layer Content Validation
1. **Extension Whitelisting**:
   Allowed extensions are checked against configured whitelist: `pdf`, `png`, `jpg`, `jpeg`, `doc`, `docx`.
2. **Magic-Number / Binary Signature Verification**:
   The `app/utils/file_handler.py` module reads the leading byte sequence of every uploaded file to verify that the file content matches its declared format:
   - PDF: `%PDF-` (`\x25\x50\x44\x46\x2D`)
   - PNG: `\x89PNG\r\n\x1a\n` (`\x89\x50\x4E\x47\x0D\x0A\x1A\x0A`)
   - JPEG: `\xFF\xD8\xFF`
   - DOCX: `PK\x03\x04` (Zip container signature)
   - DOC: `\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1` (OLE2 Compound Document signature)
   Disguised executable payloads or spoofed extensions are rejected immediately with HTTP `400 Bad Request`.

### 2.2 Storage Isolation & Path Traversal Protection
- Files are saved outside the web root under a random UUID4 filename:
  `uploads/<uuid4>.<extension>`
- Original filenames are retained in the database (`original_filename`) for display and downloads.
- `resolve_upload_path` verifies using `os.path.commonpath` that the resolved filesystem path strictly resides within `UPLOAD_FOLDER`, preventing directory traversal attacks (`../`).
- Every stored file has its SHA-256 hash computed and recorded for tamper detection.

### 2.3 Download Authorization & Deletion Guard
- Downloads require bearer authentication.
- Access is restricted to:
  1. The owning faculty member
  2. The HOD of the faculty member's department
  3. System administrators
- Documents with `verification_status == "VERIFIED"` cannot be deleted by faculty to prevent evidence tampering after approval.

---

## 3. Endpoints Implemented

| Method | Endpoint | Allowed Roles | Description |
| :---: | :--- | :---: | :--- |
| `POST` | `/api/documents/upload` | `faculty` | Multipart file upload (`file`, `document_type`, optional `activity_id`). |
| `GET` | `/api/documents` | Any authenticated | Scoped list of documents (`?activity_id=`, `?verification_status=`). |
| `GET` | `/api/documents/<id>` | Any authenticated | Document metadata inspection. |
| `GET` | `/api/documents/<id>/download` | Any authenticated | Authorized download returning original filename and correct MIME type. |
| `DELETE` | `/api/documents/<id>` | Owner / Admin | Delete document and remove physical file from disk (unverified only). |
