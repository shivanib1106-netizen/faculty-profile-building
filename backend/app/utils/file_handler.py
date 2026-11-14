import hashlib
import mimetypes
import os
import uuid

from flask import current_app
from werkzeug.utils import secure_filename

# Magic numbers for the formats accepted by the default configuration.
PDF_SIGNATURE = b"%PDF-"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
JPEG_SIGNATURE = b"\xff\xd8\xff"
OLE_SIGNATURE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
ZIP_SIGNATURE = b"PK\x03\x04"
SIGNATURES = {
    "pdf": (PDF_SIGNATURE,),
    "png": (PNG_SIGNATURE,),
    "jpg": (JPEG_SIGNATURE,),
    "jpeg": (JPEG_SIGNATURE,),
    "doc": (OLE_SIGNATURE,),
    "docx": (ZIP_SIGNATURE,),
}
MIME_BY_EXTENSION = {
    "pdf": "application/pdf",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def allowed_file(filename, allowed_extensions=None):
    if not filename or "." not in filename:
        return False
    if allowed_extensions is None:
        allowed_extensions = current_app.config.get("ALLOWED_EXTENSIONS", set())
    extension = filename.rsplit(".", 1)[1].lower()
    return extension in {item.lower() for item in allowed_extensions}


def _extension(filename):
    return filename.rsplit(".", 1)[1].lower()


def _file_signature_matches(path, extension):
    expected = SIGNATURES.get(extension)
    if not expected:
        return False
    try:
        with open(path, "rb") as stream:
            header = stream.read(16)
        return any(header.startswith(signature) for signature in expected)
    except OSError:
        return False


def _safe_subfolder(subfolder):
    if not subfolder:
        return ""
    cleaned = secure_filename(subfolder)
    if not cleaned or cleaned != subfolder:
        raise ValueError("Invalid upload subfolder.")
    return cleaned


def save_uploaded_file(file_storage, subfolder=""):
    """Save an uploaded file securely.

    Returns:
        (stored_filename, relative_path, absolute_path, original_filename,
         file_size, mime_type, checksum, error)
    """
    if not file_storage or not file_storage.filename:
        return None, None, None, None, None, None, None, "No file provided."

    original_filename = secure_filename(file_storage.filename)[:255]
    if not original_filename:
        return (
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            "The uploaded filename is not valid.",
        )
    if not allowed_file(original_filename):
        allowed = ", ".join(sorted(current_app.config.get("ALLOWED_EXTENSIONS", [])))
        return (
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            f"File type not allowed. Allowed types: {allowed}",
        )

    extension = _extension(original_filename)
    try:
        safe_subfolder = _safe_subfolder(subfolder)
    except ValueError as exc:
        return None, None, None, None, None, None, None, str(exc)

    stored_filename = f"{uuid.uuid4().hex}.{extension}"
    target_dir = os.path.abspath(
        os.path.join(current_app.config["UPLOAD_FOLDER"], safe_subfolder)
    )
    upload_root = os.path.abspath(current_app.config["UPLOAD_FOLDER"])
    if os.path.commonpath([target_dir, upload_root]) != upload_root:
        return None, None, None, None, None, None, None, "Invalid upload path."
    os.makedirs(target_dir, exist_ok=True)

    absolute_path = os.path.join(target_dir, stored_filename)
    file_storage.save(absolute_path)

    max_size = current_app.config.get("MAX_CONTENT_LENGTH", 16 * 1024 * 1024)
    file_size = os.path.getsize(absolute_path)
    if file_size == 0:
        os.remove(absolute_path)
        return (
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            "The uploaded file is empty.",
        )
    if file_size > max_size:
        os.remove(absolute_path)
        return (
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            f"File size exceeds the {max_size // (1024 * 1024)} MB limit.",
        )

    if not _file_signature_matches(absolute_path, extension):
        os.remove(absolute_path)
        return (
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            "File content does not match its extension.",
        )

    checksum = hashlib.sha256()
    with open(absolute_path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            checksum.update(chunk)

    relative_path = os.path.relpath(absolute_path, upload_root).replace("\\", "/")
    mime_type = MIME_BY_EXTENSION.get(extension) or mimetypes.guess_type(
        original_filename
    )[0] or "application/octet-stream"
    return (
        stored_filename,
        relative_path,
        absolute_path,
        original_filename,
        file_size,
        mime_type,
        checksum.hexdigest(),
        None,
    )


def resolve_upload_path(relative_path):
    """Resolve a stored relative path while preventing directory traversal."""
    if not relative_path:
        return None
    upload_root = os.path.abspath(current_app.config["UPLOAD_FOLDER"])
    candidate = os.path.abspath(os.path.join(upload_root, relative_path))
    if os.path.commonpath([candidate, upload_root]) != upload_root:
        return None
    return candidate


def delete_stored_file(file_path):
    """Safely delete a stored file if it exists and is inside the upload root."""
    absolute_path = resolve_upload_path(file_path)
    if not absolute_path:
        return False
    if os.path.isfile(absolute_path):
        try:
            os.remove(absolute_path)
            return True
        except OSError:
            return False
    return False
