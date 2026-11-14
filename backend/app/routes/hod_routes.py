from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity

from app.extensions import db
from app.models.academic_year import AcademicYear
from app.models.activity import AcademicActivity
from app.models.api_score import APICalculationHistory
from app.models.department import Department
from app.models.document import SupportingDocument
from app.models.user import User
from app.services.approval_service import ApprovalService
from app.services.audit_service import AuditService
from app.utils.decorators import get_current_authenticated_user, role_required
from app.utils.validators import parse_int

hod_bp = Blueprint("hod", __name__, url_prefix="/api/hod")


def _department_for_request(user):
    department_id = user.department_id
    if user.role == "admin":
        raw = request.args.get("department_id")
        if raw:
            parsed, error = parse_int(raw, "department_id", minimum=1)
            if error:
                return None, error
            department_id = parsed
    if not department_id:
        return None, "No department is associated with this account."
    department = db.session.get(Department, int(department_id))
    if not department:
        return None, "Department not found."
    return department, None


@hod_bp.get("/faculty")
@role_required("hod", "admin")
def get_department_faculty():
    user = get_current_authenticated_user()
    department, error = _department_for_request(user)
    if error:
        return jsonify({"success": False, "message": error}), 400

    faculty_users = (
        User.query.filter_by(department_id=department.id, role="faculty")
        .order_by(User.username.asc())
        .all()
    )
    results = []
    for faculty in faculty_users:
        item = faculty.to_dict()
        item["profile"] = (
            faculty.faculty_profile.to_dict(include_relations=False)
            if faculty.faculty_profile
            else None
        )
        results.append(item)

    return jsonify(
        {
            "success": True,
            "department": department.to_dict(),
            "count": len(results),
            "faculty": results,
        }
    ), 200


@hod_bp.get("/faculty/<int:faculty_id>/profile")
@role_required("hod", "admin")
def get_department_faculty_profile(faculty_id):
    user = get_current_authenticated_user()
    department, error = _department_for_request(user)
    if error:
        return jsonify({"success": False, "message": error}), 400

    target = db.session.get(User, faculty_id)
    if not target or target.role != "faculty":
        return jsonify({"success": False, "message": "Faculty user not found."}), 404

    target_dept = target.department_id
    if not target_dept and target.faculty_profile:
        target_dept = target.faculty_profile.department_id

    if user.role == "hod" and target_dept != department.id:
        return jsonify(
            {"success": False, "message": "Forbidden: faculty belongs to another department."}
        ), 403

    if not target.faculty_profile:
        return jsonify(
            {"success": False, "message": "Faculty profile has not been created yet."}
        ), 404

    return jsonify(
        {
            "success": True,
            "faculty_id": target.id,
            "username": target.username,
            "email": target.email,
            "profile": target.faculty_profile.to_dict(include_relations=True),
        }
    ), 200


@hod_bp.get("/activities/pending")
@role_required("hod", "admin")
def get_pending_activities():
    user = get_current_authenticated_user()
    department, error = _department_for_request(user)
    if error:
        return jsonify({"success": False, "message": error}), 400

    query = (
        AcademicActivity.query.join(User, AcademicActivity.faculty_id == User.id)
        .filter(
            AcademicActivity.status == "SUBMITTED",
            User.department_id == department.id,
        )
    )
    academic_year_id = request.args.get("academic_year_id")
    if academic_year_id:
        parsed, error = parse_int(academic_year_id, "academic_year_id", minimum=1)
        if error:
            return jsonify({"success": False, "message": error}), 400
        query = query.filter(AcademicActivity.academic_year_id == parsed)

    activities = query.order_by(AcademicActivity.submitted_at.asc()).all()
    return jsonify(
        {
            "success": True,
            "count": len(activities),
            "activities": [activity.to_dict(include_documents=True) for activity in activities],
        }
    ), 200


@hod_bp.get("/activities/submitted")
@role_required("hod", "admin")
def get_submitted_activities():
    """Alias with optional status filter for departmental review screens."""
    user = get_current_authenticated_user()
    department, error = _department_for_request(user)
    if error:
        return jsonify({"success": False, "message": error}), 400

    status = request.args.get("status", "SUBMITTED").upper().strip()
    if status not in {"DRAFT", "SUBMITTED", "APPROVED", "REJECTED"}:
        return jsonify({"success": False, "message": "Invalid status."}), 400

    query = (
        AcademicActivity.query.join(User, AcademicActivity.faculty_id == User.id)
        .filter(User.department_id == department.id, AcademicActivity.status == status)
    )
    academic_year_id = request.args.get("academic_year_id")
    if academic_year_id:
        parsed, error = parse_int(academic_year_id, "academic_year_id", minimum=1)
        if error:
            return jsonify({"success": False, "message": error}), 400
        query = query.filter(AcademicActivity.academic_year_id == parsed)

    activities = query.order_by(AcademicActivity.updated_at.desc()).all()
    return jsonify(
        {
            "success": True,
            "count": len(activities),
            "activities": [activity.to_dict(include_documents=True) for activity in activities],
        }
    ), 200


def _review(activity_id, forced_action=None):
    user = get_current_authenticated_user()
    data = request.get_json(silent=True) or {}
    action = forced_action or data.get("action") or data.get("status")
    remarks = data.get("remarks")

    if not action:
        return jsonify(
            {
                "success": False,
                "message": "Field 'action' or 'status' (APPROVED or REJECTED) is required.",
            }
        ), 400
    if str(action).upper() == "REJECTED" and not (remarks or "").strip():
        return jsonify(
            {"success": False, "message": "Remarks are mandatory when rejecting an activity."}
        ), 400

    activity, error = ApprovalService.review_activity(
        activity_id=activity_id,
        reviewer_user=user,
        action=action,
        remarks=remarks,
    )
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        if "Forbidden" in error:
            status_code = 403
        return jsonify({"success": False, "message": error}), status_code

    act_dict = activity.to_dict()
    return jsonify(
        {
            "success": True,
            "message": f"Activity {str(action).lower()} successfully.",
            "activity": act_dict,
            "data": act_dict,
        }
    ), 200


@hod_bp.post("/activities/<int:activity_id>/verify")
@role_required("hod", "admin")
def verify_activity(activity_id):
    return _review(activity_id)


@hod_bp.post("/activities/<int:activity_id>/approve")
@role_required("hod", "admin")
def approve_activity(activity_id):
    return _review(activity_id, forced_action="APPROVED")


@hod_bp.post("/activities/<int:activity_id>/reject")
@role_required("hod", "admin")
def reject_activity(activity_id):
    return _review(activity_id, forced_action="REJECTED")


@hod_bp.post("/activities/<int:activity_id>/remarks")
@role_required("hod", "admin")
def add_activity_remarks(activity_id):
    user = get_current_authenticated_user()
    data = request.get_json(silent=True) or {}
    remarks = data.get("remarks")
    if not remarks or not str(remarks).strip():
        return jsonify({"success": False, "message": "remarks field is required."}), 400

    activity, error = ApprovalService.add_activity_remarks(
        activity_id=activity_id,
        reviewer_user=user,
        remarks=remarks,
    )
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        if "Forbidden" in error:
            status_code = 403
        return jsonify({"success": False, "message": error}), status_code

    return jsonify(
        {
            "success": True,
            "message": "Remarks recorded successfully.",
            "activity": activity.to_dict(),
        }
    ), 200


@hod_bp.get("/department-summary")
@role_required("hod", "admin")
def get_department_performance():
    user = get_current_authenticated_user()
    department, error = _department_for_request(user)
    if error:
        return jsonify({"success": False, "message": error}), 400

    academic_year_id = request.args.get("academic_year_id")
    academic_year = None
    if academic_year_id:
        parsed, error = parse_int(academic_year_id, "academic_year_id", minimum=1)
        if error:
            return jsonify({"success": False, "message": error}), 400
        academic_year = db.session.get(AcademicYear, parsed)
        if not academic_year:
            return jsonify({"success": False, "message": "Academic year not found."}), 404
    else:
        academic_year = AcademicYear.query.filter_by(is_active=True).first()
        if not academic_year:
            academic_year = AcademicYear.query.order_by(
                AcademicYear.start_date.desc()
            ).first()

    faculty_list = User.query.filter_by(
        department_id=department.id, role="faculty"
    ).all()

    summary_data = []
    for faculty in faculty_list:
        activity_query = AcademicActivity.query.filter_by(faculty_id=faculty.id)
        if academic_year:
            activity_query = activity_query.filter_by(academic_year_id=academic_year.id)
        activities = activity_query.all()

        latest_official = None
        if academic_year:
            latest_official = (
                APICalculationHistory.query.filter_by(
                    faculty_id=faculty.id,
                    academic_year_id=academic_year.id,
                    status="OFFICIAL",
                )
                .order_by(APICalculationHistory.calculation_date.desc())
                .first()
            )

        summary_data.append(
            {
                "faculty_id": faculty.id,
                "name": faculty.display_name,
                "employee_id": faculty.faculty_profile.employee_id
                if faculty.faculty_profile
                else "N/A",
                "designation": faculty.faculty_profile.designation
                if faculty.faculty_profile
                else "N/A",
                "total_activities": len(activities),
                "approved_activities": sum(
                    1 for activity in activities if activity.status == "APPROVED"
                ),
                "pending_verification": sum(
                    1 for activity in activities if activity.status == "SUBMITTED"
                ),
                "draft_activities": sum(
                    1 for activity in activities if activity.status == "DRAFT"
                ),
                "rejected_activities": sum(
                    1 for activity in activities if activity.status == "REJECTED"
                ),
                "official_score": latest_official.total_final_score
                if latest_official
                else 0.0,
                "score_calculated": bool(latest_official),
                "calculation_history_id": latest_official.id
                if latest_official
                else None,
            }
        )

    return jsonify(
        {
            "success": True,
            "department": department.to_dict(),
            "academic_year": academic_year.to_dict() if academic_year else None,
            "faculty_performance": summary_data,
        }
    ), 200


@hod_bp.put("/documents/<int:document_id>/verify")
@role_required("hod", "admin")
def verify_document(document_id):
    """Optional standalone document review.

    The normal workflow verifies documents together with their parent
    activity.  This endpoint supports documents that are not linked to an
    activity.
    """
    user = get_current_authenticated_user()
    document = db.session.get(SupportingDocument, document_id)
    if not document:
        return jsonify({"success": False, "message": "Document not found."}), 404

    owner = db.session.get(User, document.faculty_id)
    if user.role == "hod" and (
        not owner or owner.department_id != user.department_id
    ):
        return jsonify({"success": False, "message": "Forbidden."}), 403
    if document.activity and document.activity.status == "SUBMITTED":
        return jsonify(
            {
                "success": False,
                "message": "Review the parent activity; its documents are verified with it.",
            }
        ), 409

    data = request.get_json(silent=True) or {}
    status = str(data.get("verification_status", "")).upper().strip()
    if status not in {"VERIFIED", "REJECTED", "PENDING"}:
        return jsonify({"success": False, "message": "Invalid verification_status."}), 400

    document.verification_status = status
    document.remarks = data.get("remarks")
    if status == "PENDING":
        document.verified_by_user_id = None
        document.verified_at = None
    else:
        from datetime import datetime, timezone

        document.verified_by_user_id = user.id
        document.verified_at = datetime.now(timezone.utc)
    db.session.commit()
    AuditService.log_action(
        user_id=user.id,
        action="DOCUMENT_VERIFIED",
        target_entity="SupportingDocument",
        target_id=document.id,
        details=f"Document marked {status}.",
    )
    return jsonify(
        {"success": True, "message": "Document verification updated.", "document": document.to_dict()}
    ), 200
