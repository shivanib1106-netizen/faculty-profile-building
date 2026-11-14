from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models.academic_year import AcademicYear
from app.models.activity import AcademicActivity
from app.models.scoring_rule import ActivityCategory, APIScoringRule
from app.models.user import User
from app.services.api_calculation import APICalculationEngine
from app.services.approval_service import ApprovalService
from app.services.audit_service import AuditService
from app.utils.decorators import get_current_authenticated_user, role_required
from app.utils.validators import (
    parse_bool,
    parse_date,
    parse_int,
    validate_required_fields,
)

activity_bp = Blueprint("activity", __name__, url_prefix="/api/activities")


def _find_active_rule(category_id, activity_type):
    return (
        APIScoringRule.query.filter_by(
            category_id=category_id,
            activity_type=activity_type,
            is_active=True,
        )
        .order_by(APIScoringRule.updated_at.desc(), APIScoringRule.id.desc())
        .first()
    )


def _parse_reference(data, field, model, label):
    value, error = parse_int(data.get(field), field, minimum=1)
    if error:
        return None, error
    record = db.session.get(model, value)
    if not record:
        return None, f"Invalid {label}."
    return record, None


def _can_view(user, activity):
    if user.role == "admin":
        return True
    if user.role == "faculty":
        return activity.faculty_id == user.id
    if user.role == "hod":
        return bool(
            activity.faculty
            and activity.faculty.department_id == user.department_id
        )
    return False


@activity_bp.get("/categories")
@jwt_required()
def list_categories():
    categories = ActivityCategory.query.order_by(ActivityCategory.category_code.asc()).all()
    return jsonify(
        {"success": True, "categories": [category.to_dict() for category in categories]}
    ), 200


@activity_bp.get("/types")
@jwt_required()
def list_activity_types():
    query = APIScoringRule.query.filter_by(is_active=True)
    category_id = request.args.get("category_id")
    if category_id:
        parsed, error = parse_int(category_id, "category_id", minimum=1)
        if error:
            return jsonify({"success": False, "message": error}), 400
        query = query.filter_by(category_id=parsed)
    rules = query.order_by(APIScoringRule.activity_type.asc()).all()
    return jsonify(
        {
            "success": True,
            "activity_types": [
                {
                    "activity_type": rule.activity_type,
                    "category_id": rule.category_id,
                    "category_code": rule.category.category_code
                    if rule.category
                    else None,
                    "rule_code": rule.rule_code,
                    "base_score": rule.base_score,
                    "scoring_unit": rule.scoring_unit,
                    "max_score_per_activity": rule.max_score_per_activity,
                    "rule_version": rule.rule_version,
                }
                for rule in rules
            ],
        }
    ), 200


@activity_bp.post("")
@role_required("faculty")
def create_activity():
    user = get_current_authenticated_user()
    data = request.get_json(silent=True) or {}
    required = [
        "academic_year_id",
        "category_id",
        "activity_type",
        "title",
        "activity_date",
    ]
    valid, missing = validate_required_fields(data, required)
    if not valid:
        return jsonify(
            {"success": False, "message": f"Missing fields: {', '.join(missing)}"}
        ), 400

    academic_year, error = _parse_reference(
        data, "academic_year_id", AcademicYear, "academic_year_id"
    )
    if error:
        return jsonify({"success": False, "message": error}), 400
    category, error = _parse_reference(
        data, "category_id", ActivityCategory, "category_id"
    )
    if error:
        return jsonify({"success": False, "message": error}), 400

    activity_date, error = parse_date(data.get("activity_date"), "activity_date")
    if error:
        return jsonify({"success": False, "message": error}), 400
    if not academic_year.contains(activity_date):
        return jsonify(
            {
                "success": False,
                "message": "activity_date must fall within the selected academic year.",
            }
        ), 400

    units, error = _validate_units(data.get("duration_or_units", 1.0))
    if error:
        return jsonify({"success": False, "message": error}), 400

    activity_type = str(data["activity_type"]).strip().upper()
    rule = _find_active_rule(category.id, activity_type)
    if not rule:
        return jsonify(
            {
                "success": False,
                "message": "No active scoring rule is configured for this category and "
                "activity_type. Ask an administrator to configure one first.",
            }
        ), 400

    co_author_role = (data.get("co_author_role") or "").strip() or None
    if co_author_role and len(co_author_role) > 50:
        return jsonify({"success": False, "message": "co_author_role is too long."}), 400

    activity = AcademicActivity(
        faculty_id=user.id,
        academic_year_id=academic_year.id,
        category_id=category.id,
        activity_type=activity_type,
        title=str(data["title"]).strip(),
        description=data.get("description"),
        activity_date=activity_date,
        duration_or_units=units,
        co_author_role=co_author_role,
        status="DRAFT",
        category_limit_applied=category.max_score_limit,
    )
    if "additional_data" in data:
        activity.set_parsed_additional_data(data["additional_data"])
    activity.raw_score = APICalculationEngine.calculate_activity_raw_score(activity, rule)
    activity.eligible_score = 0.0
    activity.final_score = 0.0
    db.session.add(activity)
    db.session.commit()

    AuditService.log_action(
        user_id=user.id,
        action="ACTIVITY_CREATED",
        target_entity="AcademicActivity",
        target_id=activity.id,
        details=f"Created draft activity '{activity.title}'.",
    )
    return jsonify(
        {
            "success": True,
            "message": "Academic activity created in DRAFT status.",
            "activity": activity.to_dict(),
        }
    ), 201


def _validate_units(value):
    try:
        units = float(value)
    except (TypeError, ValueError):
        return None, "duration_or_units must be a valid number."
    if units <= 0 or units > 100000:
        return None, "duration_or_units must be greater than 0 and no more than 100000."
    return units, None


@activity_bp.get("")
@jwt_required()
def list_activities():
    user = get_current_authenticated_user()
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404

    faculty_id_param = request.args.get("faculty_id")
    query = AcademicActivity.query

    if faculty_id_param:
        target_id, error = parse_int(faculty_id_param, "faculty_id", minimum=1)
        if error:
            return jsonify({"success": False, "message": error}), 400
        target_user = db.session.get(User, target_id)
        if not target_user:
            return jsonify({"success": False, "message": "Faculty not found."}), 404
        if user.role == "faculty" and target_user.id != user.id:
            return jsonify({"success": False, "message": "Forbidden."}), 403
        if user.role == "hod" and target_user.department_id != user.department_id:
            return jsonify(
                {"success": False, "message": "Forbidden: faculty is outside your department."}
            ), 403
        query = query.filter_by(faculty_id=target_id)
    elif user.role == "faculty":
        query = query.filter_by(faculty_id=user.id)
    elif user.role == "hod":
        if not user.department_id:
            return jsonify(
                {"success": False, "message": "No department is assigned to this HOD."}
            ), 403
        query = query.join(User, AcademicActivity.faculty_id == User.id).filter(
            User.department_id == user.department_id
        )
    # Admin without faculty_id sees all activities.

    filters = (
        ("academic_year_id", AcademicActivity.academic_year_id),
        ("category_id", AcademicActivity.category_id),
    )
    for parameter, column in filters:
        value = request.args.get(parameter)
        if value:
            parsed, error = parse_int(value, parameter, minimum=1)
            if error:
                return jsonify({"success": False, "message": error}), 400
            query = query.filter(column == parsed)

    status = request.args.get("status")
    if status:
        normalized_status = status.upper().strip()
        if normalized_status not in {"DRAFT", "SUBMITTED", "APPROVED", "REJECTED"}:
            return jsonify({"success": False, "message": "Invalid status filter."}), 400
        query = query.filter_by(status=normalized_status)

    activities = query.order_by(
        AcademicActivity.activity_date.desc(), AcademicActivity.id.desc()
    ).all()
    return jsonify(
        {
            "success": True,
            "count": len(activities),
            "activities": [activity.to_dict() for activity in activities],
        }
    ), 200


@activity_bp.get("/<int:activity_id>")
@jwt_required()
def get_activity_detail(activity_id):
    user = get_current_authenticated_user()
    activity = db.session.get(AcademicActivity, activity_id)
    if not activity:
        return jsonify({"success": False, "message": "Activity not found."}), 404
    if not _can_view(user, activity):
        return jsonify({"success": False, "message": "Forbidden."}), 403

    payload = activity.to_dict(include_documents=True)
    payload["approval_history"] = [
        approval.to_dict() for approval in activity.approvals
    ]
    return jsonify({"success": True, "activity": payload}), 200


@activity_bp.put("/<int:activity_id>")
@jwt_required()
def update_activity(activity_id):
    user = get_current_authenticated_user()
    activity = db.session.get(AcademicActivity, activity_id)
    if not activity:
        return jsonify({"success": False, "message": "Activity not found."}), 404
    if activity.faculty_id != user.id and user.role != "admin":
        return jsonify({"success": False, "message": "Forbidden."}), 403
    if activity.status in {"SUBMITTED", "APPROVED"}:
        return jsonify(
            {
                "success": False,
                "message": "Activities cannot be edited after submission. "
                "Wait for HOD review or request a rejection.",
            }
        ), 409

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"success": False, "message": "No update fields supplied."}), 400

    if "title" in data:
        title = str(data["title"]).strip()
        if not title:
            return jsonify({"success": False, "message": "title cannot be empty."}), 400
        activity.title = title
    if "description" in data:
        activity.description = data["description"]
    if "co_author_role" in data:
        activity.co_author_role = (data.get("co_author_role") or "").strip() or None
    if "additional_data" in data:
        activity.set_parsed_additional_data(data["additional_data"])

    if "activity_type" in data:
        activity.activity_type = str(data["activity_type"]).strip().upper()
    if "category_id" in data:
        category, error = _parse_reference(
            data, "category_id", ActivityCategory, "category_id"
        )
        if error:
            return jsonify({"success": False, "message": error}), 400
        activity.category_id = category.id
    if "academic_year_id" in data:
        academic_year, error = _parse_reference(
            data, "academic_year_id", AcademicYear, "academic_year_id"
        )
        if error:
            return jsonify({"success": False, "message": error}), 400
        activity.academic_year_id = academic_year.id

    if "activity_date" in data:
        activity_date, error = parse_date(data["activity_date"], "activity_date")
        if error:
            return jsonify({"success": False, "message": error}), 400
        activity.activity_date = activity_date

    if "duration_or_units" in data:
        units, error = _validate_units(data["duration_or_units"])
        if error:
            return jsonify({"success": False, "message": error}), 400
        activity.duration_or_units = units

    if not activity.academic_year.contains(activity.activity_date):
        return jsonify(
            {
                "success": False,
                "message": "activity_date must fall within the selected academic year.",
            }
        ), 400

    rule = _find_active_rule(activity.category_id, activity.activity_type)
    if not rule:
        return jsonify(
            {
                "success": False,
                "message": "No active scoring rule exists for this category and activity type.",
            }
        ), 400

    activity.category_limit_applied = activity.category.max_score_limit
    activity.raw_score = APICalculationEngine.calculate_activity_raw_score(activity, rule)
    if activity.status == "REJECTED":
        activity.status = "DRAFT"
        activity.hod_remarks = None
        activity.submitted_at = None
        activity.verified_at = None

    db.session.commit()
    AuditService.log_action(
        user_id=user.id,
        action="ACTIVITY_UPDATED",
        target_entity="AcademicActivity",
        target_id=activity.id,
        details=f"Updated activity '{activity.title}'.",
    )
    return jsonify(
        {
            "success": True,
            "message": "Activity updated successfully.",
            "activity": activity.to_dict(),
        }
    ), 200


@activity_bp.delete("/<int:activity_id>")
@jwt_required()
def delete_activity(activity_id):
    user = get_current_authenticated_user()
    activity = db.session.get(AcademicActivity, activity_id)
    if not activity:
        return jsonify({"success": False, "message": "Activity not found."}), 404
    if activity.faculty_id != user.id and user.role != "admin":
        return jsonify({"success": False, "message": "Forbidden."}), 403
    if activity.status not in {"DRAFT", "REJECTED"}:
        return jsonify(
            {
                "success": False,
                "message": "Only DRAFT or REJECTED activities can be deleted.",
            }
        ), 409

    title = activity.title
    db.session.delete(activity)
    db.session.commit()
    AuditService.log_action(
        user_id=user.id,
        action="ACTIVITY_DELETED",
        target_entity="AcademicActivity",
        target_id=activity_id,
        details=f"Deleted activity '{title}'.",
    )
    return jsonify({"success": True, "message": "Activity deleted successfully."}), 200


@activity_bp.post("/<int:activity_id>/submit")
@role_required("faculty")
def submit_activity(activity_id):
    user = get_current_authenticated_user()
    activity = db.session.get(AcademicActivity, activity_id)
    if (
        activity
        and current_app.config.get("REQUIRE_ACTIVITY_DOCUMENT_FOR_SUBMISSION")
        and not activity.documents
    ):
        return jsonify(
            {
                "success": False,
                "message": "Upload at least one supporting document before submitting this activity.",
            }
        ), 400

    activity, error = ApprovalService.submit_activity(activity_id, user)
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        return jsonify({"success": False, "message": error}), status_code
    return jsonify(
        {
            "success": True,
            "message": "Activity submitted for HOD verification.",
            "activity": activity.to_dict(),
        }
    ), 200


@activity_bp.get("/<int:activity_id>/status")
@jwt_required()
def get_activity_status(activity_id):
    user = get_current_authenticated_user()
    activity = db.session.get(AcademicActivity, activity_id)
    if not activity:
        return jsonify({"success": False, "message": "Activity not found."}), 404
    if not _can_view(user, activity):
        return jsonify({"success": False, "message": "Forbidden."}), 403
    return jsonify(
        {
            "success": True,
            "activity_id": activity.id,
            "status": activity.status,
            "verification_status": activity.status,
            "hod_remarks": activity.hod_remarks,
            "submitted_at": activity.submitted_at.isoformat()
            if activity.submitted_at
            else None,
            "verified_at": activity.verified_at.isoformat()
            if activity.verified_at
            else None,
            "approval_history": [
                approval.to_dict() for approval in activity.approvals
            ],
        }
    ), 200
