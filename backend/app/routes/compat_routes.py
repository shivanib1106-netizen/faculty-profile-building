"""Companion REST API routes for full compatibility with React frontend contract.

These routes fulfill the specifications in `docs/API_CONTRACT.md` and seamlessly
integrate with the React client in `src/api/` while delegating to the core
services, models, and calculation engines.
"""
from datetime import datetime, timezone
from flask import Blueprint, current_app, jsonify, request, send_file
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models.academic_year import AcademicYear
from app.models.activity import AcademicActivity
from app.models.department import Department
from app.models.faculty import FacultyProfile
from app.models.notification import Notification
from app.models.scoring_rule import ActivityCategory, APIScoringRule
from app.models.system_setting import SystemSetting
from app.models.user import User
from app.services.api_calculation import APICalculationEngine
from app.services.approval_service import ApprovalService
from app.services.audit_service import AuditService
from app.services.report_service import ReportService
from app.utils.decorators import get_current_authenticated_user, role_required

compat_bp = Blueprint("compat", __name__, url_prefix="/api")


# ------------------------------------------------------------------------------
# 1. System Reference Data (Any Authenticated Role)
# ------------------------------------------------------------------------------

@compat_bp.get("/academic-years")
@jwt_required()
def list_academic_years():
    years = AcademicYear.query.order_by(AcademicYear.start_date.desc()).all()
    return jsonify([y.to_dict() for y in years]), 200


@compat_bp.get("/activity-categories")
@jwt_required()
def list_activity_categories():
    categories = ActivityCategory.query.order_by(ActivityCategory.category_code.asc()).all()
    return jsonify([c.to_dict() for c in categories]), 200


@compat_bp.get("/config/upload")
@jwt_required()
def get_upload_config():
    max_mb = current_app.config.get("MAX_CONTENT_LENGTH", 16 * 1024 * 1024) // (1024 * 1024)
    allowed = current_app.config.get("ALLOWED_EXTENSIONS", {"pdf", "png", "jpg", "jpeg", "doc", "docx"})
    if isinstance(allowed, str):
        allowed = [ext.strip().lower() for ext in allowed.split(",") if ext.strip()]
    else:
        allowed = list(allowed)
    return jsonify({
        "maxUploadSizeMb": max_mb,
        "allowedFileTypes": allowed,
        "allowedMimeTypes": ["application/pdf", "image/jpeg", "image/png"],
    }), 200


# ------------------------------------------------------------------------------
# 2. Score Retrieval Endpoints (/scores, /scores/category/<key>)
# ------------------------------------------------------------------------------

def _build_frontend_score_object(faculty_user, academic_year):
    activities = AcademicActivity.query.filter_by(
        faculty_id=faculty_user.id, academic_year_id=academic_year.id
    ).all()
    approved = [a for a in activities if a.status == "APPROVED"]

    try:
        calc = APICalculationEngine.calculate_faculty_api(
            faculty_id=faculty_user.id,
            academic_year_id=academic_year.id,
            calculation_type="VERIFIED_ONLY",
            user_id=faculty_user.id,
            save_history=False,
        )
    except Exception:
        return None

    cat1_acts = [a for a in activities if a.category and "I" in a.category.category_code and "II" not in a.category.category_code and "III" not in a.category.category_code]
    cat2_acts = [a for a in activities if a.category and "II" in a.category.category_code and "III" not in a.category.category_code]
    cat3_acts = [a for a in activities if a.category and "III" in a.category.category_code]

    score_obj = {
        "academicYear": academic_year.year_label,
        "calculationDate": calc.get("calculation_date", datetime.now(timezone.utc).isoformat())[:10],
        "verificationStatus": "Verified" if approved else "Provisional",
        "overallScore": {
            "totalClaimed": calc.get("total_raw_score", 0),
            "totalApproved": calc.get("total_eligible_score", 0),
            "applicableCap": 230,
            "finalAccepted": calc.get("total_final_score", 0),
        },
        "categories": [
            {
                "key": "cat1",
                "title": "Category I – Teaching, Learning and Evaluation",
                "totalActivities": len(cat1_acts),
                "approvedActivities": sum(1 for a in cat1_acts if a.status == "APPROVED"),
                "rawScore": calc.get("category_1", {}).get("raw", 0),
                "eligibleScore": calc.get("category_1", {}).get("eligible", 0),
                "applicableCap": calc.get("category_1", {}).get("cap_applied") or 100,
                "finalScore": calc.get("category_1", {}).get("final", 0),
                "status": "Verified" if any(a.status == "APPROVED" for a in cat1_acts) else "Pending",
                "breakdown": [
                    {
                        "item": a.title,
                        "claimed": a.raw_score,
                        "approved": a.final_score if a.status == "APPROVED" else 0,
                    }
                    for a in cat1_acts
                ],
            },
            {
                "key": "cat2",
                "title": "Category II – Co-curricular, Extension and Professional Development",
                "totalActivities": len(cat2_acts),
                "approvedActivities": sum(1 for a in cat2_acts if a.status == "APPROVED"),
                "rawScore": calc.get("category_2", {}).get("raw", 0),
                "eligibleScore": calc.get("category_2", {}).get("eligible", 0),
                "applicableCap": calc.get("category_2", {}).get("cap_applied") or 50,
                "finalScore": calc.get("category_2", {}).get("final", 0),
                "status": "Verified" if any(a.status == "APPROVED" for a in cat2_acts) else "Pending",
                "breakdown": [
                    {
                        "item": a.title,
                        "claimed": a.raw_score,
                        "approved": a.final_score if a.status == "APPROVED" else 0,
                    }
                    for a in cat2_acts
                ],
            },
            {
                "key": "cat3",
                "title": "Category III – Research and Academic Contributions",
                "totalActivities": len(cat3_acts),
                "approvedActivities": sum(1 for a in cat3_acts if a.status == "APPROVED"),
                "rawScore": calc.get("category_3", {}).get("raw", 0),
                "eligibleScore": calc.get("category_3", {}).get("eligible", 0),
                "applicableCap": calc.get("category_3", {}).get("cap_applied") or 80,
                "finalScore": calc.get("category_3", {}).get("final", 0),
                "status": "Verified" if any(a.status == "APPROVED" for a in cat3_acts) else "Pending",
                "breakdown": [
                    {
                        "item": a.title,
                        "claimed": a.raw_score,
                        "approved": a.final_score if a.status == "APPROVED" else 0,
                    }
                    for a in cat3_acts
                ],
            },
        ],
    }
    return score_obj


@compat_bp.get("/scores")
@role_required("faculty")
def get_faculty_scores():
    user = get_current_authenticated_user()
    year_param = request.args.get("academicYear")
    if year_param:
        academic_year = AcademicYear.query.filter(
            (AcademicYear.year_label == year_param) | (AcademicYear.id == (int(year_param) if year_param.isdigit() else 0))
        ).first()
    else:
        academic_year = AcademicYear.query.filter_by(is_active=True).first()

    if not academic_year:
        return jsonify({"message": "Academic year not found."}), 404

    score_obj = _build_frontend_score_object(user, academic_year)
    if not score_obj:
        return jsonify({"message": "No calculated score found for this year."}), 404
    return jsonify(score_obj), 200


@compat_bp.get("/scores/category/<string:category_key>")
@role_required("faculty")
def get_faculty_category_score(category_key):
    user = get_current_authenticated_user()
    year_param = request.args.get("academicYear")
    if year_param:
        academic_year = AcademicYear.query.filter(
            (AcademicYear.year_label == year_param) | (AcademicYear.id == (int(year_param) if year_param.isdigit() else 0))
        ).first()
    else:
        academic_year = AcademicYear.query.filter_by(is_active=True).first()

    if not academic_year:
        return jsonify({"message": "Academic year not found."}), 404

    score_obj = _build_frontend_score_object(user, academic_year)
    if not score_obj:
        return jsonify({"message": "No calculated score found for this year."}), 404

    target_key = category_key.lower().strip()
    match = next((c for c in score_obj["categories"] if c["key"] == target_key), None)
    if not match:
        return jsonify({"message": "Category not found."}), 404
    return jsonify(match), 200


# ------------------------------------------------------------------------------
# 3. HOD Companion Routes (/hod/summary, /hod/verifications, /hod/reports)
# ------------------------------------------------------------------------------

@compat_bp.get("/hod/summary")
@role_required("hod")
def get_hod_dashboard_summary():
    user = get_current_authenticated_user()
    dept = user.department
    dept_id = user.department_id

    faculty_users = User.query.filter_by(role="faculty", department_id=dept_id).all()
    faculty_ids = [f.id for f in faculty_users]

    activities = AcademicActivity.query.filter(AcademicActivity.faculty_id.in_(faculty_ids)).all() if faculty_ids else []
    submitted_count = sum(1 for a in activities if a.status in {"SUBMITTED", "APPROVED", "REJECTED"})
    pending_count = sum(1 for a in activities if a.status == "SUBMITTED")
    approved_count = sum(1 for a in activities if a.status == "APPROVED")
    rejected_count = sum(1 for a in activities if a.status == "REJECTED")

    recent = AcademicActivity.query.filter(
        AcademicActivity.faculty_id.in_(faculty_ids)
    ).order_by(AcademicActivity.created_at.desc()).limit(6).all() if faculty_ids else []

    active_year = AcademicYear.query.filter_by(is_active=True).first()
    overview_list = []
    for f in faculty_users:
        prof = f.faculty_profile
        f_acts = [a for a in activities if a.faculty_id == f.id]
        score_val = None
        if active_year:
            try:
                calc = APICalculationEngine.calculate_faculty_api(
                    faculty_id=f.id,
                    academic_year_id=active_year.id,
                    calculation_type="VERIFIED_ONLY",
                    user_id=user.id,
                    save_history=False,
                )
                score_val = calc.get("total_final_score", 0)
            except Exception:
                score_val = None
        overview_list.append({
            "id": f.id,
            "name": prof.full_name if prof else f.username,
            "employeeId": prof.employee_id if prof else f"EMP-{f.id}",
            "submitted": sum(1 for a in f_acts if a.status in {"SUBMITTED", "APPROVED", "REJECTED"}),
            "approved": sum(1 for a in f_acts if a.status == "APPROVED"),
            "pending": sum(1 for a in f_acts if a.status == "SUBMITTED"),
            "score": score_val,
            "status": "Active" if f.is_active else "Inactive",
        })

    return jsonify({
        "departmentName": dept.name if dept else "Department",
        "totalFaculty": len(faculty_users),
        "totalSubmitted": submitted_count,
        "pendingVerification": pending_count,
        "approvedActivities": approved_count,
        "rejectedActivities": rejected_count,
        "recentSubmissions": [a.to_dict() for a in recent],
        "facultyScoreOverview": overview_list,
    }), 200


@compat_bp.get("/hod/verifications")
@role_required("hod")
def get_hod_verifications():
    user = get_current_authenticated_user()
    dept_id = user.department_id

    query = AcademicActivity.query.join(User, AcademicActivity.faculty_id == User.id).filter(
        User.department_id == dept_id,
        AcademicActivity.faculty_id != user.id,
    )

    status_param = request.args.get("status")
    if status_param and status_param != "all":
        query = query.filter(AcademicActivity.status == status_param.upper())
    else:
        # Default to submitted if none passed, or return all
        pass

    cat_param = request.args.get("category")
    if cat_param and cat_param != "all":
        query = query.join(ActivityCategory, AcademicActivity.category_id == ActivityCategory.id).filter(
            (ActivityCategory.category_code == cat_param) | (ActivityCategory.name == cat_param)
        )

    year_param = request.args.get("academicYear")
    if year_param and year_param != "all":
        query = query.join(AcademicYear, AcademicActivity.academic_year_id == AcademicYear.id).filter(
            (AcademicYear.year_label == year_param) | (AcademicYear.id == (int(year_param) if year_param.isdigit() else 0))
        )

    search_param = request.args.get("search")
    if search_param:
        query = query.filter(AcademicActivity.title.ilike(f"%{search_param.strip()}%"))

    activities = query.order_by(AcademicActivity.created_at.desc()).all()
    return jsonify([a.to_dict() for a in activities]), 200


@compat_bp.get("/hod/faculty/<int:faculty_id>/scores")
@role_required("hod")
def get_hod_faculty_scores(faculty_id):
    user = get_current_authenticated_user()
    target_user = db.session.get(User, faculty_id)
    if not target_user or target_user.department_id != user.department_id:
        return jsonify({"message": "Faculty not found in your department."}), 404

    year_param = request.args.get("academicYear")
    if year_param:
        academic_year = AcademicYear.query.filter(
            (AcademicYear.year_label == year_param) | (AcademicYear.id == (int(year_param) if year_param.isdigit() else 0))
        ).first()
    else:
        academic_year = AcademicYear.query.filter_by(is_active=True).first()

    if not academic_year:
        return jsonify({"message": "Academic year not found."}), 404

    score_obj = _build_frontend_score_object(target_user, academic_year)
    if not score_obj:
        return jsonify({"message": "No score found."}), 404
    return jsonify(score_obj), 200


@compat_bp.get("/hod/reports")
@role_required("hod")
def get_hod_report_preview():
    user = get_current_authenticated_user()
    dept = user.department
    report_type = request.args.get("type", "department-summary")
    year_param = request.args.get("academicYear")

    active_year = None
    if year_param:
        active_year = AcademicYear.query.filter(
            (AcademicYear.year_label == year_param) | (AcademicYear.id == (int(year_param) if year_param.isdigit() else 0))
        ).first()
    if not active_year:
        active_year = AcademicYear.query.filter_by(is_active=True).first()

    faculty_list = User.query.filter_by(role="faculty", department_id=user.department_id).all()
    rows = []
    for f in faculty_list:
        prof = f.faculty_profile
        acts = AcademicActivity.query.filter_by(faculty_id=f.id).all()
        rows.append({
            "facultyName": prof.full_name if prof else f.username,
            "employeeId": prof.employee_id if prof else f"EMP-{f.id}",
            "designation": prof.designation if prof else "Faculty",
            "activitiesCount": len(acts),
            "approvedCount": sum(1 for a in acts if a.status == "APPROVED"),
        })

    return jsonify({
        "reportType": report_type,
        "department": dept.name if dept else "Department",
        "academicYear": active_year.year_label if active_year else "Current",
        "generatedDate": datetime.now(timezone.utc).isoformat()[:10],
        "rows": rows,
    }), 200


@compat_bp.get("/hod/reports/download")
@role_required("hod")
def download_hod_report():
    user = get_current_authenticated_user()
    active_year = AcademicYear.query.filter_by(is_active=True).first()
    faculty_user = User.query.filter_by(role="faculty", department_id=user.department_id).first()
    if not faculty_user or not active_year:
        return jsonify({"message": "No faculty or academic year available to generate report."}), 404

    pdf_buffer = ReportService.generate_api_report_pdf(
        faculty_id=faculty_user.id,
        academic_year_id=active_year.id,
        calculation_type="VERIFIED_ONLY",
    )
    return send_file(
        pdf_buffer,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"HOD_Department_Report_{user.department_id}.pdf",
    )


# ------------------------------------------------------------------------------
# 4. Reports Companion Routes (/reports/preview, /reports/download)
# ------------------------------------------------------------------------------

@compat_bp.get("/reports/preview")
@role_required("faculty")
def get_faculty_report_preview():
    user = get_current_authenticated_user()
    report_type = request.args.get("type", "faculty-api")
    year_param = request.args.get("academicYear")

    active_year = None
    if year_param:
        active_year = AcademicYear.query.filter(
            (AcademicYear.year_label == year_param) | (AcademicYear.id == (int(year_param) if year_param.isdigit() else 0))
        ).first()
    if not active_year:
        active_year = AcademicYear.query.filter_by(is_active=True).first()

    if not active_year:
        return jsonify({"message": "Academic year not found."}), 404

    score_obj = _build_frontend_score_object(user, active_year)
    return jsonify({
        "reportType": report_type,
        "facultyName": user.display_name,
        "academicYear": active_year.year_label,
        "generatedDate": datetime.now(timezone.utc).isoformat()[:10],
        "score": score_obj,
    }), 200


@compat_bp.get("/reports/download")
@role_required("faculty")
def download_faculty_report_pdf():
    user = get_current_authenticated_user()
    year_param = request.args.get("academicYear")
    active_year = None
    if year_param:
        active_year = AcademicYear.query.filter(
            (AcademicYear.year_label == year_param) | (AcademicYear.id == (int(year_param) if year_param.isdigit() else 0))
        ).first()
    if not active_year:
        active_year = AcademicYear.query.filter_by(is_active=True).first()

    if not active_year:
        return jsonify({"message": "Academic year not found."}), 404

    pdf_buffer = ReportService.generate_api_report_pdf(
        faculty_id=user.id,
        academic_year_id=active_year.id,
        calculation_type="VERIFIED_ONLY",
    )
    return send_file(
        pdf_buffer,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"API_Score_Report_{user.username}_{active_year.year_label}.pdf",
    )


# ------------------------------------------------------------------------------
# 5. Admin Companion Routes
# ------------------------------------------------------------------------------

@compat_bp.get("/admin/metrics")
@role_required("admin")
def get_admin_metrics():
    total_users = User.query.count()
    total_faculty = User.query.filter_by(role="faculty").count()
    total_depts = Department.query.count()
    total_activities = AcademicActivity.query.count()
    pending = AcademicActivity.query.filter_by(status="SUBMITTED").count()
    active_year = AcademicYear.query.filter_by(is_active=True).first()

    from app.models.audit_log import AuditLog
    recent_logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(8).all()
    summary = [
        {
            "id": l.id,
            "action": l.action.replace("_", " ").title(),
            "target": f"{l.target_entity} #{l.target_id}" if l.target_entity else "System",
            "time": l.created_at.isoformat(),
        }
        for l in recent_logs
    ]

    return jsonify({
        "totalUsers": total_users,
        "totalFaculty": total_faculty,
        "totalDepartments": total_depts,
        "totalActivities": total_activities,
        "pendingApprovals": pending,
        "activeAcademicYear": active_year.year_label if active_year else "N/A",
        "systemActivitySummary": summary,
    }), 200


@compat_bp.get("/admin/faculty")
@role_required("admin")
def get_admin_faculty_list():
    users = User.query.filter_by(role="faculty").order_by(User.username.asc()).all()
    return jsonify([u.to_dict() for u in users]), 200


@compat_bp.patch("/admin/users/<int:user_id>/status")
@role_required("admin")
def toggle_user_status(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"message": "User not found."}), 404

    user.is_active = not user.is_active
    db.session.commit()
    AuditService.log_action(
        user_id=get_current_authenticated_user().id,
        action="USER_STATUS_TOGGLED",
        target_entity="User",
        target_id=user.id,
        details=f"User {user.username} active status set to {user.is_active}.",
    )
    return jsonify({"success": True, "message": "User status updated.", "is_active": user.is_active}), 200


@compat_bp.patch("/admin/academic-years/<int:academic_year_id>/set-active")
@role_required("admin")
def set_active_academic_year(academic_year_id):
    target_year = db.session.get(AcademicYear, academic_year_id)
    if not target_year:
        return jsonify({"message": "Academic year not found."}), 404

    # Deactivate others and set target
    AcademicYear.query.update({"is_active": False})
    target_year.is_active = True
    db.session.commit()
    AuditService.log_action(
        user_id=get_current_authenticated_user().id,
        action="ACADEMIC_YEAR_SET_ACTIVE",
        target_entity="AcademicYear",
        target_id=target_year.id,
        details=f"Academic year {target_year.year_label} set as active.",
    )
    return jsonify({"success": True, "message": f"Academic year {target_year.year_label} set to active."}), 200


@compat_bp.get("/admin/scoring-rules")
@role_required("admin")
def get_admin_scoring_rules_compat():
    rules = APIScoringRule.query.order_by(APIScoringRule.rule_code.asc()).all()
    return jsonify([r.to_dict() for r in rules]), 200


@compat_bp.put("/admin/scoring-rules/<int:rule_id>")
@role_required("admin")
def update_admin_scoring_rule_compat(rule_id):
    from app.routes.admin_routes import update_scoring_rule
    return update_scoring_rule(rule_id)


@compat_bp.get("/admin/activity-categories")
@role_required("admin")
def get_admin_activity_categories_compat():
    categories = ActivityCategory.query.order_by(ActivityCategory.category_code.asc()).all()
    return jsonify([c.to_dict() for c in categories]), 200


@compat_bp.post("/admin/activity-categories")
@role_required("admin")
def create_admin_activity_category_compat():
    from app.routes.admin_routes import create_category
    return create_category()


@compat_bp.put("/admin/activity-categories/<int:category_id>")
@role_required("admin")
def update_admin_activity_category_compat(category_id):
    from app.routes.admin_routes import update_category
    return update_category(category_id)


@compat_bp.get("/admin/reports/preview")
@role_required("admin")
def get_admin_reports_preview():
    report_type = request.args.get("type", "institution-api")
    active_year = AcademicYear.query.filter_by(is_active=True).first()
    faculty_users = User.query.filter_by(role="faculty").all()
    records = []
    for f in faculty_users:
        prof = f.faculty_profile
        records.append({
            "facultyName": prof.full_name if prof else f.username,
            "department": prof.department.name if prof and prof.department else "N/A",
            "employeeId": prof.employee_id if prof else f"EMP-{f.id}",
            "status": "Active" if f.is_active else "Inactive",
        })
    return jsonify({
        "reportType": report_type,
        "academicYear": active_year.year_label if active_year else "Current",
        "totalRecords": len(records),
        "data": records,
    }), 200


@compat_bp.get("/admin/reports/download")
@role_required("admin")
def download_admin_report_pdf():
    faculty_user = User.query.filter_by(role="faculty").first()
    active_year = AcademicYear.query.filter_by(is_active=True).first()
    if not faculty_user or not active_year:
        return jsonify({"message": "No data available to generate report."}), 404

    pdf_buffer = ReportService.generate_api_report_pdf(
        faculty_id=faculty_user.id,
        academic_year_id=active_year.id,
        calculation_type="VERIFIED_ONLY",
    )
    return send_file(
        pdf_buffer,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"Institution_Admin_Report_{active_year.year_label}.pdf",
    )


# ------------------------------------------------------------------------------
# 6. Notifications Companion Routes (/notifications, /notifications/<id>/read)
# ------------------------------------------------------------------------------

@compat_bp.get("/notifications")
@jwt_required()
def get_user_notifications():
    user = get_current_authenticated_user()
    if not user:
        return jsonify({"message": "User not found."}), 404
    notes = Notification.query.filter_by(user_id=user.id).order_by(
        Notification.created_at.desc()
    ).all()
    # Format according to API contract Section 10
    formatted = [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "timestamp": n.created_at.isoformat(),
            "read": n.is_read,
            "type": n.notification_type or "system",
        }
        for n in notes
    ]
    return jsonify(formatted), 200


@compat_bp.patch("/notifications/<int:notification_id>/read")
@jwt_required()
def mark_user_notification_read(notification_id):
    user = get_current_authenticated_user()
    note = Notification.query.filter_by(id=notification_id, user_id=user.id).first()
    if not note:
        return jsonify({"message": "Notification not found."}), 404
    note.is_read = True
    db.session.commit()
    return jsonify({"success": True}), 200


@compat_bp.post("/notifications/read-all")
@jwt_required()
def mark_all_user_notifications_read():
    user = get_current_authenticated_user()
    Notification.query.filter_by(user_id=user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"success": True}), 200
