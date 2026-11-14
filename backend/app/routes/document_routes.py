import os

from flask import Blueprint, current_app, jsonify, request, send_file
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models.activity import AcademicActivity
from app.models.document import SupportingDocument
from app.models.user import User
from app.services.audit_service import AuditService
from app.utils.decorators import get_current_authenticated_user, role_required
from app.utils.file_handler import delete_stored_file, resolve_upload_path, save_uploaded_file
from app.utils.validators import parse_int

document_bp = Blueprint("document", __name__, url_prefix="/api/documents")


def _can_access(user, document):
    if user.role == "admin":
        return True
    if user.role == "faculty":
        return document.faculty_id == user.id
    if user.role == "hod":
        owner = db.session.get(User, document.faculty_id)
        owner_dept = owner.department_id if owner else None
        if not owner_dept and owner and owner.faculty_profile:
            owner_dept = owner.faculty_profile.department_id
        return bool(owner and owner_dept == user.department_id)
    return False


@document_bp.get("")
@jwt_required()
def list_documents():
    user = get_current_authenticated_user()
    query = SupportingDocument.query

    if user.role == "faculty":
        query = query.filter_by(faculty_id=user.id)
    elif user.role == "hod":
        query = query.join(User, SupportingDocument.faculty_id == User.id).filter(
            User.department_id == user.department_id
        )
    # Admin sees all.

    activity_id = request.args.get("activity_id")
    if activity_id:
        parsed, error = parse_int(activity_id, "activity_id", minimum=1)
        if error:
            return jsonify({"success": False, "message": error}), 400
        query = query.filter_by(activity_id=parsed)

    status = request.args.get("verification_status")
    if status:
        normalized = status.upper().strip()
        if normalized not in {"PENDING", "VERIFIED", "REJECTED"}:
            return jsonify({"success": False, "message": "Invalid verification status."}), 400
        query = query.filter_by(verification_status=normalized)

    documents = query.order_by(SupportingDocument.upload_date.desc()).all()
    return jsonify(
        {
            "success": True,
            "count": len(documents),
            "documents": [document.to_dict() for document in documents],
        }
    ), 200


@document_bp.post("/upload")
@role_required("faculty")
def upload_document():
    user = get_current_authenticated_user()
    file_obj = request.files.get("file")
    if file_obj is None:
        return jsonify({"success": False, "message": "No file part in the request."}), 400
    if not file_obj.filename:
        return jsonify({"success": False, "message": "No selected file."}), 400

    document_type = str(request.form.get("document_type", "general")).strip().lower()
    allowed_types = current_app.config.get("ALLOWED_DOCUMENT_TYPES", set())
    if document_type not in allowed_types:
        return jsonify(
            {
                "success": False,
                "message": "Invalid document_type.",
                "allowed_types": sorted(allowed_types),
            }
        ), 400

    activity = None
    activity_id = request.form.get("activity_id")
    if activity_id:
        parsed, error = parse_int(activity_id, "activity_id", minimum=1)
        if error:
            return jsonify({"success": False, "message": error}), 400
        activity = db.session.get(AcademicActivity, parsed)
        if not activity:
            return jsonify(
                {"success": False, "message": "Referenced academic activity not found."}
            ), 404
        if activity.faculty_id != user.id:
            return jsonify(
                {"success": False, "message": "You can only attach documents to your own activities."}
            ), 403
        if activity.status in {"SUBMITTED", "APPROVED"}:
            return jsonify(
                {
                    "success": False,
                    "message": "Documents cannot be added while an activity is under review or approved.",
                }
            ), 409

    stored_name, relative_path, absolute_path, original_name, size, mime_type, checksum, error = save_uploaded_file(
        file_obj, subfolder=f"faculty_{user.id}"
    )
    if error:
        return jsonify({"success": False, "message": error}), 400

    document = SupportingDocument(
        faculty_id=user.id,
        activity_id=activity.id if activity else None,
        document_type=document_type,
        original_filename=original_name,
        stored_filename=stored_name,
        file_path=relative_path,
        file_type=mime_type,
        file_size=size,
        checksum_sha256=checksum,
        verification_status="PENDING",
    )
    db.session.add(document)
    db.session.commit()

    AuditService.log_action(
        user_id=user.id,
        action="DOCUMENT_UPLOADED",
        target_entity="SupportingDocument",
        target_id=document.id,
        details=f"Uploaded {original_name} ({size} bytes).",
    )
    return jsonify(
        {
            "success": True,
            "message": "Document uploaded successfully.",
            "document": document.to_dict(),
        }
    ), 201


@document_bp.get("/<int:document_id>")
@jwt_required()
def get_document_details(document_id):
    user = get_current_authenticated_user()
    document = db.session.get(SupportingDocument, document_id)
    if not document:
        return jsonify({"success": False, "message": "Document not found."}), 404
    if not _can_access(user, document):
        return jsonify({"success": False, "message": "Forbidden."}), 403
    return jsonify({"success": True, "document": document.to_dict()}), 200


@document_bp.get("/<int:document_id>/download")
@jwt_required()
def download_document(document_id):
    user = get_current_authenticated_user()
    document = db.session.get(SupportingDocument, document_id)
    if not document:
        return jsonify({"success": False, "message": "Document not found."}), 404
    if not _can_access(user, document):
        return jsonify({"success": False, "message": "Forbidden."}), 403

    absolute_path = resolve_upload_path(document.file_path)
    if not absolute_path or not os.path.isfile(absolute_path):
        return jsonify(
            {"success": False, "message": "File is missing from secure storage."}
        ), 404

    AuditService.log_action(
        user_id=user.id,
        action="DOCUMENT_DOWNLOADED",
        target_entity="SupportingDocument",
        target_id=document.id,
        details=f"Downloaded {document.original_filename}.",
    )
    return send_file(
        absolute_path,
        mimetype=document.file_type,
        as_attachment=True,
        download_name=document.original_filename,
    )


@document_bp.delete("/<int:document_id>")
@jwt_required()
def delete_document(document_id):
    user = get_current_authenticated_user()
    document = db.session.get(SupportingDocument, document_id)
    if not document:
        return jsonify({"success": False, "message": "Document not found."}), 404
    if document.faculty_id != user.id and user.role != "admin":
        return jsonify({"success": False, "message": "Forbidden."}), 403
    if document.verification_status == "VERIFIED" and user.role != "admin":
        return jsonify(
            {"success": False, "message": "Verified documents cannot be deleted."}
        ), 409
    if document.activity and document.activity.status == "APPROVED" and user.role != "admin":
        return jsonify(
            {
                "success": False,
                "message": "Documents attached to an approved activity cannot be deleted.",
            }
        ), 409

    original_name = document.original_filename
    stored_path = document.file_path
    db.session.delete(document)
    db.session.commit()
    delete_stored_file(stored_path)
    AuditService.log_action(
        user_id=user.id,
        action="DOCUMENT_DELETED",
        target_entity="SupportingDocument",
        target_id=document_id,
        details=f"Deleted {original_name}.",
    )
    return jsonify({"success": True, "message": "Document deleted successfully."}), 200
