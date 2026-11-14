from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models.academic_year import AcademicYear
from app.models.api_score import APICalculationHistory
from app.models.user import User
from app.services.api_calculation import APICalculationEngine
from app.services.audit_service import AuditService
from app.services.report_service import ReportService
from app.utils.decorators import get_current_authenticated_user, role_required
from app.utils.validators import parse_int

calculation_bp = Blueprint("calculation", __name__, url_prefix="/api/calculations")

VALID_CALCULATION_TYPES = {"VERIFIED_ONLY", "ALL_ACTIVITIES"}


def _calculation_type(value, default="VERIFIED_ONLY"):
    normalized = str(value or default).strip().upper()
    if normalized not in VALID_CALCULATION_TYPES:
        raise ValueError(
            "calculation_type must be VERIFIED_ONLY or ALL_ACTIVITIES."
        )
    return normalized


def _resolve_target_faculty(user, raw_faculty_id):
    if raw_faculty_id is None or str(raw_faculty_id) == str(user.id):
        if user.role != "faculty":
            raise PermissionError(
                "faculty_id is required for HOD and Admin accounts."
            )
        target = user
    else:
        faculty_id, error = parse_int(raw_faculty_id, "faculty_id", minimum=1)
        if error:
            raise ValueError(error)
        target = db.session.get(User, faculty_id)
        if not target:
            raise LookupError("Faculty user not found.")

    if target.role != "faculty":
        raise PermissionError("API scores are calculated for faculty accounts only.")

    if user.role == "faculty" and target.id != user.id:
        raise PermissionError("You can only access your own API score.")
    if user.role == "hod":
        if target.department_id != user.department_id:
            raise PermissionError(
                "HOD can only access faculty in the assigned department."
            )
    return target


def _resolve_academic_year(raw_id):
    year_id, error = parse_int(raw_id, "academic_year_id", minimum=1)
    if error:
        raise ValueError(error)
    academic_year = db.session.get(AcademicYear, year_id)
    if not academic_year:
        raise LookupError("Academic year not found.")
    return academic_year


def _error_response(exc):
    if isinstance(exc, PermissionError):
        return jsonify({"success": False, "message": str(exc)}), 403
    if isinstance(exc, LookupError):
        return jsonify({"success": False, "message": str(exc)}), 404
    return jsonify({"success": False, "message": str(exc)}), 400


@calculation_bp.post("/calculate")
@jwt_required()
def calculate_score():
    user = get_current_authenticated_user()
    data = request.get_json(silent=True) or {}
    try:
        academic_year = _resolve_academic_year(data.get("academic_year_id"))
        target = _resolve_target_faculty(user, data.get("faculty_id"))
        calculation_type = _calculation_type(
            data.get("calculation_type"), "VERIFIED_ONLY"
        )
        result = APICalculationEngine.calculate_faculty_api(
            faculty_id=target.id,
            academic_year_id=academic_year.id,
            calculation_type=calculation_type,
            user_id=user.id,
            save_history=True,
        )
    except (ValueError, PermissionError, LookupError) as exc:
        return _error_response(exc)

    AuditService.log_action(
        user_id=user.id,
        action="API_CALCULATION_RUN",
        target_entity="APICalculationHistory",
        target_id=result.get("calculation_history_id"),
        details=(
            f"Calculated {calculation_type} API score for faculty {target.id}, "
            f"academic year {academic_year.year_label}."
        ),
    )
    return jsonify(
        {
            "success": True,
            "message": f"API score calculation complete ({calculation_type}).",
            "calculation": result,
        }
    ), 200


@calculation_bp.get("/summary")
@jwt_required()
def get_summary():
    user = get_current_authenticated_user()
    try:
        academic_year = _resolve_academic_year(request.args.get("academic_year_id"))
        target = _resolve_target_faculty(user, request.args.get("faculty_id"))
        calculation_type = _calculation_type(
            request.args.get("calculation_type"), "VERIFIED_ONLY"
        )
        result = APICalculationEngine.calculate_faculty_api(
            faculty_id=target.id,
            academic_year_id=academic_year.id,
            calculation_type=calculation_type,
            user_id=user.id,
            save_history=False,
        )
    except (ValueError, PermissionError, LookupError) as exc:
        return _error_response(exc)
    return jsonify({"success": True, "summary": result}), 200


@calculation_bp.get("/category-scores")
@jwt_required()
def get_category_scores():
    user = get_current_authenticated_user()
    try:
        academic_year = _resolve_academic_year(request.args.get("academic_year_id"))
        target = _resolve_target_faculty(user, request.args.get("faculty_id"))
        calculation_type = _calculation_type(
            request.args.get("calculation_type"), "VERIFIED_ONLY"
        )
        result = APICalculationEngine.calculate_faculty_api(
            faculty_id=target.id,
            academic_year_id=academic_year.id,
            calculation_type=calculation_type,
            user_id=user.id,
            save_history=False,
        )
    except (ValueError, PermissionError, LookupError) as exc:
        return _error_response(exc)
    return jsonify(
        {
            "success": True,
            "faculty_id": target.id,
            "faculty_name": target.display_name,
            "academic_year_id": academic_year.id,
            "academic_year": academic_year.year_label,
            "calculation_type": calculation_type,
            "categories": result.get("categories", {}),
            "category_breakdown": result.get("category_breakdown", []),
        }
    ), 200


@calculation_bp.get("/overall-score")
@jwt_required()
def get_overall_score():
    user = get_current_authenticated_user()
    try:
        academic_year = _resolve_academic_year(request.args.get("academic_year_id"))
        target = _resolve_target_faculty(user, request.args.get("faculty_id"))
        calculation_type = _calculation_type(
            request.args.get("calculation_type"), "VERIFIED_ONLY"
        )
        result = APICalculationEngine.calculate_faculty_api(
            faculty_id=target.id,
            academic_year_id=academic_year.id,
            calculation_type=calculation_type,
            user_id=user.id,
            save_history=False,
        )
    except (ValueError, PermissionError, LookupError) as exc:
        return _error_response(exc)
    return jsonify(
        {
            "success": True,
            "faculty_id": target.id,
            "faculty_name": target.display_name,
            "academic_year_id": academic_year.id,
            "academic_year": academic_year.year_label,
            "calculation_type": calculation_type,
            "total_raw_score": result.get("total_raw_score", 0.0),
            "total_eligible_score": result.get("total_eligible_score", 0.0),
            "total_final_score": result.get("total_final_score", 0.0),
            "rule_version": result.get("rule_version", "UNCONFIGURED"),
            "category_totals": {
                "category_1": result.get("categories", {}).get("category_1", {}).get("final", 0.0),
                "category_2": result.get("categories", {}).get("category_2", {}).get("final", 0.0),
                "category_3": result.get("categories", {}).get("category_3", {}).get("final", 0.0),
            },
        }
    ), 200


@calculation_bp.get("/latest")
@jwt_required()
def get_latest_official():
    user = get_current_authenticated_user()
    try:
        academic_year = _resolve_academic_year(request.args.get("academic_year_id"))
        target = _resolve_target_faculty(user, request.args.get("faculty_id"))
    except (ValueError, PermissionError, LookupError) as exc:
        return _error_response(exc)

    history = APICalculationEngine.get_latest_official(target.id, academic_year.id)
    if not history:
        return jsonify(
            {
                "success": True,
                "message": "No official calculation exists for this academic year.",
                "calculation": None,
            }
        ), 200
    return jsonify(
        {"success": True, "calculation": history.to_dict(include_details=True)}
    ), 200


@calculation_bp.get("/history")
@jwt_required()
def get_calculation_history():
    user = get_current_authenticated_user()
    raw_faculty_id = request.args.get("faculty_id")
    try:
        if raw_faculty_id:
            target = _resolve_target_faculty(user, raw_faculty_id)
            query = APICalculationHistory.query.filter_by(faculty_id=target.id)
        elif user.role == "faculty":
            query = APICalculationHistory.query.filter_by(faculty_id=user.id)
        elif user.role == "hod":
            faculty_ids = [
                row[0]
                for row in db.session.query(User.id)
                .filter_by(role="faculty", department_id=user.department_id)
                .all()
            ]
            query = APICalculationHistory.query.filter(
                APICalculationHistory.faculty_id.in_(faculty_ids or [-1])
            )
        else:
            query = APICalculationHistory.query
    except (ValueError, PermissionError, LookupError) as exc:
        return _error_response(exc)

    academic_year_id = request.args.get("academic_year_id")
    if academic_year_id:
        parsed, error = parse_int(academic_year_id, "academic_year_id", minimum=1)
        if error:
            return jsonify({"success": False, "message": error}), 400
        query = query.filter_by(academic_year_id=parsed)

    calculation_type = request.args.get("calculation_type")
    if calculation_type:
        normalized = calculation_type.upper().strip()
        if normalized not in VALID_CALCULATION_TYPES:
            return jsonify(
                {"success": False, "message": "Invalid calculation_type filter."}
            ), 400
        query = query.filter_by(calculation_type=normalized)

    status = request.args.get("status")
    if status:
        normalized = status.upper().strip()
        if normalized not in {"OFFICIAL", "PROVISIONAL", "SUPERSEDED"}:
            return jsonify({"success": False, "message": "Invalid status filter."}), 400
        query = query.filter_by(status=normalized)

    history = query.order_by(APICalculationHistory.calculation_date.desc()).all()
    return jsonify(
        {
            "success": True,
            "count": len(history),
            "history": [record.to_dict() for record in history],
        }
    ), 200


@calculation_bp.get("/history/<int:history_id>")
@jwt_required()
def get_history_detail(history_id):
    user = get_current_authenticated_user()
    history = db.session.get(APICalculationHistory, history_id)
    if not history:
        return jsonify(
            {"success": False, "message": "Calculation history record not found."}
        ), 404

    if user.role == "faculty" and history.faculty_id != user.id:
        return jsonify({"success": False, "message": "Forbidden."}), 403
    if user.role == "hod":
        faculty = history.faculty
        if not faculty or faculty.department_id != user.department_id:
            return jsonify(
                {"success": False, "message": "Forbidden: record belongs to another department."}
            ), 403
    return jsonify(
        {"success": True, "calculation": history.to_dict(include_details=True)}
    ), 200


@calculation_bp.get("/report/pdf")
@jwt_required()
def download_api_report_pdf():
    user = get_current_authenticated_user()
    try:
        academic_year = _resolve_academic_year(request.args.get("academic_year_id"))
        target = _resolve_target_faculty(user, request.args.get("faculty_id"))
        calculation_type = _calculation_type(
            request.args.get("calculation_type"), "VERIFIED_ONLY"
        )
        pdf_stream = ReportService.generate_api_report_pdf(
            faculty_id=target.id,
            academic_year_id=academic_year.id,
            calculation_type=calculation_type,
        )
    except (ValueError, PermissionError, LookupError) as exc:
        return _error_response(exc)

    AuditService.log_action(
        user_id=user.id,
        action="API_REPORT_DOWNLOADED",
        target_entity="FacultyProfile",
        target_id=target.id,
        details=(
            f"Downloaded API report for {target.display_name}, "
            f"academic year {academic_year.year_label}."
        ),
    )
    filename = (
        f"API_Report_Faculty_{target.id}_{academic_year.year_label.replace('-', '_')}.pdf"
    )
    return send_file(
        pdf_stream,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=filename,
    )


@calculation_bp.post("/recalculate-all")
@role_required("admin")
def recalculate_all():
    admin = get_current_authenticated_user()
    data = request.get_json(silent=True) or {}
    try:
        academic_year = _resolve_academic_year(data.get("academic_year_id"))
    except (ValueError, LookupError) as exc:
        return _error_response(exc)

    results = APICalculationEngine.recalculate_academic_year(
        academic_year_id=academic_year.id,
        user_id=admin.id,
    )
    AuditService.log_action(
        user_id=admin.id,
        action="API_RECALCULATED_ALL",
        target_entity="AcademicYear",
        target_id=academic_year.id,
        details=f"Recalculated {len(results)} faculty score(s).",
    )
    return jsonify(
        {
            "success": True,
            "message": f"Recalculation complete for {len(results)} faculty member(s).",
            "academic_year": academic_year.to_dict(),
            "results": results,
        }
    ), 200
