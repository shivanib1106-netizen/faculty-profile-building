import re

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.extensions import db
from app.models.academic_year import AcademicYear
from app.models.activity import AcademicActivity
from app.models.api_score import APICalculationHistory
from app.models.audit_log import AuditLog
from app.models.department import Department
from app.models.faculty import FacultyProfile
from app.models.scoring_rule import APIScoringRule, ActivityCategory
from app.models.system_setting import SystemSetting
from app.models.user import User
from app.services.audit_service import AuditService
from app.utils.decorators import get_current_authenticated_user, role_required
from app.utils.validators import (
    parse_bool,
    parse_date,
    parse_int,
    validate_date_range,
    validate_email,
    validate_number,
    validate_password,
    validate_required_fields,
    validate_username,
)

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def _audit(admin, action, entity, target_id, details=None):
    AuditService.log_action(
        user_id=admin.id if admin else None,
        action=action,
        target_entity=entity,
        target_id=target_id,
        details=details,
    )


# ----------------------------- USERS -----------------------------
@admin_bp.get("/users")
@role_required("admin")
def list_users():
    query = User.query
    role = request.args.get("role")
    if role:
        normalized_role = role.lower().strip()
        if normalized_role not in {"faculty", "hod", "admin"}:
            return jsonify({"success": False, "message": "Invalid role filter."}), 400
        query = query.filter_by(role=normalized_role)

    department_id = request.args.get("department_id")
    if department_id:
        parsed, error = parse_int(department_id, "department_id", minimum=1)
        if error:
            return jsonify({"success": False, "message": error}), 400
        query = query.filter_by(department_id=parsed)

    search = (request.args.get("search") or "").strip()
    if search:
        query = query.filter(
            (func.lower(User.username).contains(search.lower()))
            | (func.lower(User.email).contains(search.lower()))
        )

    users = query.order_by(User.created_at.desc()).all()
    response = []
    for user in users:
        item = user.to_dict()
        item["profile"] = (
            user.faculty_profile.to_dict(include_relations=False)
            if user.faculty_profile
            else None
        )
        response.append(item)
    return jsonify({"success": True, "count": len(response), "users": response}), 200


@admin_bp.post("/users")
@role_required("admin")
def create_user_by_admin():
    admin = get_current_authenticated_user()
    data = request.get_json(silent=True) or {}
    required = ["username", "email", "password", "role"]
    valid, missing = validate_required_fields(data, required)
    if not valid:
        return jsonify(
            {"success": False, "message": f"Missing fields: {', '.join(missing)}"}
        ), 400

    username = str(data["username"]).strip()
    email = str(data["email"]).strip().lower()
    role = str(data["role"]).strip().lower()
    if not validate_username(username):
        return jsonify({"success": False, "message": "Invalid username format."}), 400
    if not validate_email(email):
        return jsonify({"success": False, "message": "Invalid email format."}), 400
    if role not in {"faculty", "hod", "admin"}:
        return jsonify({"success": False, "message": "Invalid role."}), 400
    password_valid, password_error = validate_password(data["password"])
    if not password_valid:
        return jsonify({"success": False, "message": password_error}), 400

    if User.query.filter(func.lower(User.username) == username.lower()).first():
        return jsonify({"success": False, "message": "Username already exists."}), 409
    if User.query.filter(func.lower(User.email) == email).first():
        return jsonify({"success": False, "message": "Email already registered."}), 409

    department_id = data.get("department_id")
    if department_id is not None:
        department_id, error = parse_int(department_id, "department_id", minimum=1)
        if error:
            return jsonify({"success": False, "message": error}), 400
        if not db.session.get(Department, department_id):
            return jsonify({"success": False, "message": "Invalid department_id."}), 400
    if role in {"hod", "faculty"} and not department_id:
        return jsonify(
            {"success": False, "message": "department_id is required for faculty and HOD accounts."}
        ), 400

    user = User(
        username=username,
        email=email,
        role=role,
        department_id=department_id,
        is_active=True,
    )
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()
    _audit(admin, "ADMIN_CREATED_USER", "User", user.id, f"Created {role} {username}.")
    return jsonify(
        {"success": True, "message": "User created.", "user": user.to_dict()}
    ), 201


@admin_bp.route("/users/<int:user_id>", methods=["GET", "PUT", "DELETE"])
@role_required("admin")
def manage_user(user_id):
    admin = get_current_authenticated_user()
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404

    if request.method == "GET":
        item = user.to_dict()
        item["profile"] = (
            user.faculty_profile.to_dict(include_relations=True)
            if user.faculty_profile
            else None
        )
        return jsonify({"success": True, "user": item}), 200

    if request.method == "DELETE":
        if user.id == admin.id:
            return jsonify(
                {"success": False, "message": "You cannot delete your own account."}
            ), 400
        if user.role == "admin":
            active_admins = User.query.filter_by(role="admin", is_active=True).count()
            if active_admins <= 1:
                return jsonify(
                    {"success": False, "message": "The last active administrator cannot be deleted."}
                ), 409
        user.is_active = False
        db.session.commit()
        _audit(admin, "ADMIN_DEACTIVATED_USER", "User", user.id)
        return jsonify(
            {"success": True, "message": "User deactivated.", "user": user.to_dict()}
        ), 200

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"success": False, "message": "No update fields supplied."}), 400

    if "role" in data:
        role = str(data["role"]).strip().lower()
        if role not in {"faculty", "hod", "admin"}:
            return jsonify({"success": False, "message": "Invalid role."}), 400
        if user.id == admin.id and role != "admin":
            return jsonify(
                {"success": False, "message": "You cannot remove your own administrator role."}
            ), 400
        if user.role == "admin" and role != "admin":
            active_admins = User.query.filter_by(role="admin", is_active=True).count()
            if active_admins <= 1:
                return jsonify(
                    {"success": False, "message": "The last active administrator cannot lose the role."}
                ), 409
        user.role = role

    if "department_id" in data:
        if data["department_id"] is None:
            user.department_id = None
        else:
            department_id, error = parse_int(
                data["department_id"], "department_id", minimum=1
            )
            if error:
                return jsonify({"success": False, "message": error}), 400
            if not db.session.get(Department, department_id):
                return jsonify({"success": False, "message": "Invalid department_id."}), 400
            user.department_id = department_id
        if user.faculty_profile:
            if user.department_id:
                user.faculty_profile.department_id = user.department_id
            else:
                return jsonify(
                    {"success": False, "message": "A faculty profile requires a department."}
                ), 400

    if "is_active" in data:
        is_active = parse_bool(data["is_active"], user.is_active)
        if user.id == admin.id and not is_active:
            return jsonify(
                {"success": False, "message": "You cannot deactivate your own account."}
            ), 400
        user.is_active = is_active

    if "email" in data:
        email = str(data["email"]).strip().lower()
        if not validate_email(email):
            return jsonify({"success": False, "message": "Invalid email."}), 400
        duplicate = User.query.filter(
            func.lower(User.email) == email, User.id != user.id
        ).first()
        if duplicate:
            return jsonify({"success": False, "message": "Email already in use."}), 409
        user.email = email

    if "password" in data:
        password_valid, password_error = validate_password(data["password"])
        if not password_valid:
            return jsonify({"success": False, "message": password_error}), 400
        user.set_password(data["password"])

    if user.role in {"faculty", "hod"} and not user.department_id:
        return jsonify(
            {"success": False, "message": "Faculty and HOD accounts require a department."}
        ), 400

    db.session.commit()
    _audit(admin, "ADMIN_UPDATED_USER", "User", user.id)
    return jsonify(
        {"success": True, "message": "User updated.", "user": user.to_dict()}
    ), 200


# ----------------------------- DEPARTMENTS -----------------------------
@admin_bp.route("/departments", methods=["GET", "POST"])
@role_required("admin")
def manage_departments():
    if request.method == "GET":
        departments = Department.query.order_by(Department.name.asc()).all()
        return jsonify(
            {
                "success": True,
                "departments": [department.to_dict() for department in departments],
            }
        ), 200

    admin = get_current_authenticated_user()
    data = request.get_json(silent=True) or {}
    valid, missing = validate_required_fields(data, ["name", "code"])
    if not valid:
        return jsonify(
            {"success": False, "message": f"Missing fields: {', '.join(missing)}"}
        ), 400

    name = str(data["name"]).strip()
    code = str(data["code"]).strip().upper()
    if not re.fullmatch(r"[A-Z0-9_-]{2,20}", code):
        return jsonify({"success": False, "message": "Invalid department code."}), 400
    if Department.query.filter(
        (func.lower(Department.name) == name.lower()) | (Department.code == code)
    ).first():
        return jsonify(
            {"success": False, "message": "Department name or code already exists."}
        ), 409

    department = Department(name=name, code=code, description=data.get("description"))
    db.session.add(department)
    db.session.commit()
    _audit(admin, "DEPARTMENT_CREATED", "Department", department.id)
    return jsonify(
        {
            "success": True,
            "message": "Department created.",
            "department": department.to_dict(),
        }
    ), 201


@admin_bp.route("/departments/<int:department_id>", methods=["GET", "PUT", "DELETE"])
@role_required("admin")
def department_detail_ops(department_id):
    admin = get_current_authenticated_user()
    department = db.session.get(Department, department_id)
    if not department:
        return jsonify({"success": False, "message": "Department not found."}), 404

    if request.method == "GET":
        return jsonify({"success": True, "department": department.to_dict()}), 200

    if request.method == "DELETE":
        if department.users or department.faculty_profiles:
            return jsonify(
                {
                    "success": False,
                    "message": "Cannot delete a department with assigned users or profiles.",
                }
            ), 409
        db.session.delete(department)
        db.session.commit()
        _audit(admin, "DEPARTMENT_DELETED", "Department", department_id)
        return jsonify({"success": True, "message": "Department deleted."}), 200

    data = request.get_json(silent=True) or {}
    if "name" in data:
        department.name = str(data["name"]).strip()
    if "code" in data:
        department.code = str(data["code"]).strip().upper()
    if "description" in data:
        department.description = data.get("description")
    duplicate = Department.query.filter(
        Department.id != department.id,
        (func.lower(Department.name) == department.name.lower())
        | (Department.code == department.code),
    ).first()
    if duplicate:
        return jsonify(
            {"success": False, "message": "Department name or code already exists."}
        ), 409
    db.session.commit()
    _audit(admin, "DEPARTMENT_UPDATED", "Department", department.id)
    return jsonify(
        {
            "success": True,
            "message": "Department updated.",
            "department": department.to_dict(),
        }
    ), 200


# ----------------------------- ACADEMIC YEARS -----------------------------
def _apply_active_year(academic_year):
    if academic_year.is_active:
        AcademicYear.query.filter(
            AcademicYear.id != academic_year.id, AcademicYear.is_active.is_(True)
        ).update({"is_active": False})


@admin_bp.route("/academic-years", methods=["GET", "POST"])
@role_required("admin")
def manage_academic_years():
    if request.method == "GET":
        years = AcademicYear.query.order_by(AcademicYear.start_date.desc()).all()
        return jsonify(
            {"success": True, "academic_years": [year.to_dict() for year in years]}
        ), 200

    admin = get_current_authenticated_user()
    data = request.get_json(silent=True) or {}
    valid, missing = validate_required_fields(
        data, ["year_label", "start_date", "end_date"]
    )
    if not valid:
        return jsonify(
            {"success": False, "message": f"Missing fields: {', '.join(missing)}"}
        ), 400

    start_date, error1 = parse_date(data["start_date"], "start_date")
    end_date, error2 = parse_date(data["end_date"], "end_date")
    if error1 or error2:
        return jsonify({"success": False, "message": error1 or error2}), 400
    dates_valid, dates_error = validate_date_range(start_date, end_date, "academic year")
    if not dates_valid:
        return jsonify({"success": False, "message": dates_error}), 400

    label = str(data["year_label"]).strip()
    if len(label) > 20 or AcademicYear.query.filter_by(year_label=label).first():
        return jsonify(
            {"success": False, "message": "Academic year label already exists or is too long."}
        ), 409

    academic_year = AcademicYear(
        year_label=label,
        start_date=start_date,
        end_date=end_date,
        is_active=parse_bool(data.get("is_active"), True),
    )
    db.session.add(academic_year)
    db.session.flush()
    _apply_active_year(academic_year)
    db.session.commit()
    _audit(admin, "ACADEMIC_YEAR_CREATED", "AcademicYear", academic_year.id)
    return jsonify(
        {
            "success": True,
            "message": "Academic year created.",
            "academic_year": academic_year.to_dict(),
        }
    ), 201


@admin_bp.route("/academic-years/<int:academic_year_id>", methods=["GET", "PUT", "DELETE"])
@role_required("admin")
def academic_year_detail_ops(academic_year_id):
    admin = get_current_authenticated_user()
    academic_year = db.session.get(AcademicYear, academic_year_id)
    if not academic_year:
        return jsonify({"success": False, "message": "Academic year not found."}), 404

    if request.method == "GET":
        return jsonify({"success": True, "academic_year": academic_year.to_dict()}), 200

    if request.method == "DELETE":
        if academic_year.activities or academic_year.calculation_histories:
            return jsonify(
                {
                    "success": False,
                    "message": "Cannot delete an academic year with activities or calculations.",
                }
            ), 409
        db.session.delete(academic_year)
        db.session.commit()
        _audit(admin, "ACADEMIC_YEAR_DELETED", "AcademicYear", academic_year_id)
        return jsonify({"success": True, "message": "Academic year deleted."}), 200

    data = request.get_json(silent=True) or {}
    if "year_label" in data:
        label = str(data["year_label"]).strip()
        if not label or len(label) > 20:
            return jsonify({"success": False, "message": "Invalid year_label."}), 400
        duplicate = AcademicYear.query.filter(
            AcademicYear.year_label == label, AcademicYear.id != academic_year.id
        ).first()
        if duplicate:
            return jsonify({"success": False, "message": "Year label already exists."}), 409
        academic_year.year_label = label
    if "start_date" in data:
        parsed, error = parse_date(data["start_date"], "start_date")
        if error:
            return jsonify({"success": False, "message": error}), 400
        academic_year.start_date = parsed
    if "end_date" in data:
        parsed, error = parse_date(data["end_date"], "end_date")
        if error:
            return jsonify({"success": False, "message": error}), 400
        academic_year.end_date = parsed
    if academic_year.start_date >= academic_year.end_date:
        return jsonify(
            {"success": False, "message": "start_date must be before end_date."}
        ), 400
    if "is_active" in data:
        academic_year.is_active = parse_bool(data["is_active"], academic_year.is_active)
    _apply_active_year(academic_year)
    db.session.commit()
    _audit(admin, "ACADEMIC_YEAR_UPDATED", "AcademicYear", academic_year.id)
    return jsonify(
        {
            "success": True,
            "message": "Academic year updated.",
            "academic_year": academic_year.to_dict(),
        }
    ), 200


# ----------------------------- SCORING CONFIGURATION -----------------------------
@admin_bp.route("/categories", methods=["GET", "POST"])
@role_required("admin")
def manage_categories():
    if request.method == "GET":
        categories = ActivityCategory.query.order_by(ActivityCategory.category_code.asc()).all()
        return jsonify(
            {"success": True, "categories": [category.to_dict() for category in categories]}
        ), 200

    admin = get_current_authenticated_user()
    data = request.get_json(silent=True) or {}
    valid, missing = validate_required_fields(data, ["category_code", "name"])
    if not valid:
        return jsonify(
            {"success": False, "message": f"Missing fields: {', '.join(missing)}"}
        ), 400

    code = str(data["category_code"]).strip().upper()
    name = str(data["name"]).strip()
    if ActivityCategory.query.filter_by(category_code=code).first():
        return jsonify({"success": False, "message": "Category code already exists."}), 409

    max_limit = None
    if data.get("max_score_limit") is not None:
        max_limit, error = validate_number(data["max_score_limit"], "max_score_limit", min_val=0)
        if error:
            return jsonify({"success": False, "message": error}), 400

    min_required = None
    if data.get("min_score_required") is not None:
        min_required, error = validate_number(data["min_score_required"], "min_score_required", min_val=0)
        if error:
            return jsonify({"success": False, "message": error}), 400

    category = ActivityCategory(
        category_code=code,
        name=name,
        description=data.get("description"),
        max_score_limit=max_limit,
        min_score_required=min_required,
    )
    db.session.add(category)
    db.session.commit()
    _audit(admin, "CATEGORY_CREATED", "ActivityCategory", category.id)
    return jsonify(
        {
            "success": True,
            "message": "Activity category created.",
            "category": category.to_dict(),
        }
    ), 201


@admin_bp.route("/categories/<int:category_id>", methods=["GET", "PUT", "DELETE"])
@role_required("admin")
def category_detail_ops(category_id):
    admin = get_current_authenticated_user()
    category = db.session.get(ActivityCategory, category_id)
    if not category:
        return jsonify({"success": False, "message": "Category not found."}), 404

    if request.method == "GET":
        return jsonify({"success": True, "category": category.to_dict()}), 200

    if request.method == "DELETE":
        if category.activities or category.scoring_rules:
            return jsonify(
                {
                    "success": False,
                    "message": "Cannot delete category that has existing activities or scoring rules.",
                }
            ), 409
        db.session.delete(category)
        db.session.commit()
        _audit(admin, "CATEGORY_DELETED", "ActivityCategory", category_id)
        return jsonify({"success": True, "message": "Category deleted successfully."}), 200

    data = request.get_json(silent=True) or {}
    if "name" in data:
        name = str(data["name"]).strip()
        if not name:
            return jsonify({"success": False, "message": "Category name cannot be empty."}), 400
        category.name = name

    if "max_score_limit" in data:
        if data["max_score_limit"] is None:
            category.max_score_limit = None
        else:
            value, error = validate_number(
                data["max_score_limit"], "max_score_limit", min_val=0
            )
            if error:
                return jsonify({"success": False, "message": error}), 400
            category.max_score_limit = value
    if "min_score_required" in data:
        if data["min_score_required"] is None:
            category.min_score_required = None
        else:
            value, error = validate_number(
                data["min_score_required"], "min_score_required", min_val=0
            )
            if error:
                return jsonify({"success": False, "message": error}), 400
            category.min_score_required = value
    if "description" in data:
        category.description = data.get("description")

    db.session.commit()
    _audit(admin, "CATEGORY_LIMITS_UPDATED", "ActivityCategory", category.id)
    return jsonify(
        {
            "success": True,
            "message": "Category configuration updated. Recalculate affected academic years "
            "to apply the new limits.",
            "recalculation_required": True,
            "category": category.to_dict(),
        }
    ), 200


def _validate_author_weights(value):
    if value is None:
        return None, None
    if not isinstance(value, dict):
        return None, "author_role_weights must be a JSON object."
    validated = {}
    for role, weight in value.items():
        role_name = str(role).strip()
        if not role_name or len(role_name) > 50:
            return None, "Each author role name must be 1-50 characters."
        numeric_weight, error = validate_number(
            weight, f"weight for {role_name}", min_val=0, max_val=10
        )
        if error:
            return None, error
        validated[role_name.lower()] = numeric_weight
    return validated, None


@admin_bp.route("/rules", methods=["GET", "POST"])
@role_required("admin")
def manage_scoring_rules():
    if request.method == "GET":
        query = APIScoringRule.query
        category_id = request.args.get("category_id")
        if category_id:
            parsed, error = parse_int(category_id, "category_id", minimum=1)
            if error:
                return jsonify({"success": False, "message": error}), 400
            query = query.filter_by(category_id=parsed)
        active = request.args.get("is_active")
        if active is not None:
            query = query.filter_by(is_active=parse_bool(active, True))
        rules = query.order_by(
            APIScoringRule.activity_type.asc(), APIScoringRule.rule_version.desc()
        ).all()
        return jsonify(
            {"success": True, "count": len(rules), "rules": [rule.to_dict() for rule in rules]}
        ), 200

    admin = get_current_authenticated_user()
    data = request.get_json(silent=True) or {}
    required = ["category_id", "activity_type", "rule_code", "description", "base_score"]
    valid, missing = validate_required_fields(data, required)
    if not valid:
        return jsonify(
            {"success": False, "message": f"Missing fields: {', '.join(missing)}"}
        ), 400

    category_id, error = parse_int(data["category_id"], "category_id", minimum=1)
    if error or not db.session.get(ActivityCategory, category_id):
        return jsonify({"success": False, "message": error or "Invalid category_id."}), 400

    base_score, error = validate_number(data["base_score"], "base_score", min_val=0)
    if error:
        return jsonify({"success": False, "message": error}), 400

    max_score = None
    if data.get("max_score_per_activity") is not None:
        max_score, error = validate_number(
            data["max_score_per_activity"], "max_score_per_activity", min_val=0
        )
        if error:
            return jsonify({"success": False, "message": error}), 400

    scoring_unit = str(data.get("scoring_unit", "fixed")).strip().lower()
    if scoring_unit not in {
        "fixed",
        "per_unit",
        "per_hour",
        "per_paper",
        "per_book",
        "per_chapter",
        "per_patent",
        "per_project",
    }:
        return jsonify({"success": False, "message": "Invalid scoring_unit."}), 400

    weights, error = _validate_author_weights(data.get("author_role_weights"))
    if error:
        return jsonify({"success": False, "message": error}), 400

    rule_code = str(data["rule_code"]).strip().upper()
    rule_version = str(data.get("rule_version", "INSTITUTION-V1")).strip()
    if not rule_version:
        return jsonify({"success": False, "message": "rule_version cannot be empty."}), 400
    if APIScoringRule.query.filter_by(rule_code=rule_code).first():
        return jsonify({"success": False, "message": "Rule code already exists."}), 409
    duplicate = APIScoringRule.query.filter_by(
        category_id=category_id,
        activity_type=str(data["activity_type"]).strip().upper(),
        rule_version=rule_version,
    ).first()
    if duplicate:
        return jsonify(
            {"success": False, "message": "A rule for this category, activity type and version already exists."}
        ), 409

    rule = APIScoringRule(
        category_id=category_id,
        activity_type=str(data["activity_type"]).strip().upper(),
        rule_code=rule_code,
        description=str(data["description"]).strip(),
        base_score=base_score,
        max_score_per_activity=max_score,
        scoring_unit=scoring_unit,
        author_role_weights=weights,
        rule_version=rule_version,
        is_active=parse_bool(data.get("is_active"), True),
    )
    db.session.add(rule)
    db.session.commit()
    _audit(admin, "SCORING_RULE_CREATED", "APIScoringRule", rule.id)
    return jsonify(
        {
            "success": True,
            "message": "Scoring rule created.",
            "recalculation_required": True,
            "rule": rule.to_dict(),
        }
    ), 201


@admin_bp.route("/rules/<int:rule_id>", methods=["GET", "PUT", "DELETE"])
@role_required("admin")
def rule_detail_ops(rule_id):
    admin = get_current_authenticated_user()
    rule = db.session.get(APIScoringRule, rule_id)
    if not rule:
        return jsonify({"success": False, "message": "Scoring rule not found."}), 404

    if request.method == "GET":
        return jsonify({"success": True, "rule": rule.to_dict()}), 200

    if request.method == "DELETE":
        db.session.delete(rule)
        db.session.commit()
        _audit(admin, "SCORING_RULE_DELETED", "APIScoringRule", rule_id)
        return jsonify({"success": True, "message": "Scoring rule deleted."}), 200

    data = request.get_json(silent=True) or {}
    if "base_score" in data:
        value, error = validate_number(data["base_score"], "base_score", min_val=0)
        if error:
            return jsonify({"success": False, "message": error}), 400
        rule.base_score = value
    if "max_score_per_activity" in data:
        if data["max_score_per_activity"] is None:
            rule.max_score_per_activity = None
        else:
            value, error = validate_number(
                data["max_score_per_activity"], "max_score_per_activity", min_val=0
            )
            if error:
                return jsonify({"success": False, "message": error}), 400
            rule.max_score_per_activity = value
    if "description" in data:
        rule.description = str(data["description"]).strip()
    if "scoring_unit" in data:
        scoring_unit = str(data["scoring_unit"]).strip().lower()
        if scoring_unit not in {
            "fixed",
            "per_unit",
            "per_hour",
            "per_paper",
            "per_book",
            "per_chapter",
            "per_patent",
            "per_project",
        }:
            return jsonify({"success": False, "message": "Invalid scoring_unit."}), 400
        rule.scoring_unit = scoring_unit
    if "author_role_weights" in data:
        weights, error = _validate_author_weights(data["author_role_weights"])
        if error:
            return jsonify({"success": False, "message": error}), 400
        rule.author_role_weights = weights
    if "rule_version" in data:
        rule.rule_version = str(data["rule_version"]).strip()
    if "is_active" in data:
        rule.is_active = parse_bool(data["is_active"], rule.is_active)

    duplicate = APIScoringRule.query.filter(
        APIScoringRule.id != rule.id,
        APIScoringRule.category_id == rule.category_id,
        APIScoringRule.activity_type == rule.activity_type,
        APIScoringRule.rule_version == rule.rule_version,
    ).first()
    if duplicate:
        return jsonify(
            {"success": False, "message": "Duplicate category/activity type/version combination."}
        ), 409

    db.session.commit()
    _audit(admin, "SCORING_RULE_UPDATED", "APIScoringRule", rule.id)
    return jsonify(
        {
            "success": True,
            "message": "Scoring rule updated. Recalculate affected academic years to use "
            "the new values.",
            "recalculation_required": True,
            "rule": rule.to_dict(),
        }
    ), 200


# ----------------------------- SETTINGS / MONITORING -----------------------------
@admin_bp.route("/settings", methods=["GET", "PUT"])
@role_required("admin")
def manage_settings():
    if request.method == "GET":
        settings = SystemSetting.query.order_by(SystemSetting.key.asc()).all()
        return jsonify(
            {"success": True, "settings": [setting.to_dict() for setting in settings]}
        ), 200

    admin = get_current_authenticated_user()
    data = request.get_json(silent=True) or {}
    updates = data.get("settings")
    if not isinstance(updates, dict) or not updates:
        return jsonify(
            {"success": False, "message": "Provide a non-empty 'settings' object."}
        ), 400

    saved = []
    for key, value in updates.items():
        key = str(key).strip()
        if not key or len(key) > 100:
            return jsonify({"success": False, "message": "Invalid setting key."}), 400
        setting = db.session.get(SystemSetting, key)
        if not setting:
            setting = SystemSetting(key=key)
            db.session.add(setting)
        setting.value = str(value) if value is not None else None
        setting.updated_by_user_id = admin.id
        saved.append(setting)
    db.session.commit()
    _audit(admin, "SETTINGS_UPDATED", "SystemSetting", None, f"Keys: {', '.join(updates)}")
    return jsonify(
        {
            "success": True,
            "message": "Settings updated.",
            "settings": [setting.to_dict() for setting in saved],
        }
    ), 200


@admin_bp.get("/audit-logs")
@role_required("admin")
def view_audit_logs():
    limit, error = parse_int(request.args.get("limit", 100), "limit", minimum=1)
    if error:
        return jsonify({"success": False, "message": error}), 400
    limit = min(limit, 500)
    query = AuditLog.query
    action = request.args.get("action")
    if action:
        query = query.filter_by(action=action)
    user_id = request.args.get("user_id")
    if user_id:
        parsed, error = parse_int(user_id, "user_id", minimum=1)
        if error:
            return jsonify({"success": False, "message": error}), 400
        query = query.filter_by(user_id=parsed)
    logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    return jsonify(
        {"success": True, "count": len(logs), "audit_logs": [log.to_dict() for log in logs]}
    ), 200


@admin_bp.get("/system-summary")
@role_required("admin")
def get_system_summary():
    return jsonify(
        {
            "success": True,
            "metrics": {
                "total_users": User.query.count(),
                "active_users": User.query.filter_by(is_active=True).count(),
                "total_faculty_profiles": FacultyProfile.query.count(),
                "total_departments": Department.query.count(),
                "total_activities": AcademicActivity.query.count(),
                "approved_activities": AcademicActivity.query.filter_by(
                    status="APPROVED"
                ).count(),
                "pending_verifications": AcademicActivity.query.filter_by(
                    status="SUBMITTED"
                ).count(),
                "rejected_activities": AcademicActivity.query.filter_by(
                    status="REJECTED"
                ).count(),
                "total_calculations": APICalculationHistory.query.count(),
            },
        }
    ), 200


@admin_bp.get("/faculty-profiles")
@role_required("admin")
def list_all_faculty_profiles():
    profiles = FacultyProfile.query.order_by(FacultyProfile.employee_id.asc()).all()
    return jsonify(
        {
            "success": True,
            "count": len(profiles),
            "profiles": [profile.to_dict(include_relations=True) for profile in profiles],
        }
    ), 200


@admin_bp.get("/reports/department-performance")
@role_required("admin")
def get_all_departments_performance():
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

    departments = Department.query.order_by(Department.name.asc()).all()
    dept_reports = []
    for dept in departments:
        faculty_users = User.query.filter_by(department_id=dept.id, role="faculty").all()
        total_faculty = len(faculty_users)

        total_activities = 0
        approved_activities = 0
        pending_activities = 0
        rejected_activities = 0
        scores = []

        for fac in faculty_users:
            q = AcademicActivity.query.filter_by(faculty_id=fac.id)
            if academic_year:
                q = q.filter_by(academic_year_id=academic_year.id)
            activities = q.all()
            total_activities += len(activities)
            approved_activities += sum(1 for a in activities if a.status == "APPROVED")
            pending_activities += sum(1 for a in activities if a.status == "SUBMITTED")
            rejected_activities += sum(1 for a in activities if a.status == "REJECTED")

            if academic_year:
                latest = (
                    APICalculationHistory.query.filter_by(
                        faculty_id=fac.id,
                        academic_year_id=academic_year.id,
                        status="OFFICIAL",
                    )
                    .order_by(APICalculationHistory.calculation_date.desc())
                    .first()
                )
                if latest:
                    scores.append(latest.total_final_score)

        avg_score = round(sum(scores) / len(scores), 2) if scores else 0.0

        dept_reports.append(
            {
                "department_id": dept.id,
                "department_name": dept.name,
                "department_code": dept.code,
                "total_faculty": total_faculty,
                "total_activities": total_activities,
                "approved_activities": approved_activities,
                "pending_activities": pending_activities,
                "rejected_activities": rejected_activities,
                "faculty_scored_count": len(scores),
                "average_api_score": avg_score,
            }
        )

    return jsonify(
        {
            "success": True,
            "academic_year": academic_year.to_dict() if academic_year else None,
            "departments": dept_reports,
        }
    ), 200


@admin_bp.get("/reports/faculty-scores")
@role_required("admin")
def get_faculty_scores_report():
    academic_year_id = request.args.get("academic_year_id")
    if not academic_year_id:
        ay = AcademicYear.query.filter_by(is_active=True).first()
        if not ay:
            return jsonify({"success": False, "message": "No active academic year found."}), 404
        academic_year = ay
    else:
        parsed, error = parse_int(academic_year_id, "academic_year_id", minimum=1)
        if error:
            return jsonify({"success": False, "message": error}), 400
        academic_year = db.session.get(AcademicYear, parsed)
        if not academic_year:
            return jsonify({"success": False, "message": "Academic year not found."}), 404

    query = User.query.filter_by(role="faculty")
    dept_id = request.args.get("department_id")
    if dept_id:
        parsed, error = parse_int(dept_id, "department_id", minimum=1)
        if error:
            return jsonify({"success": False, "message": error}), 400
        query = query.filter_by(department_id=parsed)

    faculty_list = query.all()
    records = []
    for fac in faculty_list:
        latest = (
            APICalculationHistory.query.filter_by(
                faculty_id=fac.id,
                academic_year_id=academic_year.id,
                status="OFFICIAL",
            )
            .order_by(APICalculationHistory.calculation_date.desc())
            .first()
        )
        profile = fac.faculty_profile
        records.append(
            {
                "faculty_id": fac.id,
                "employee_id": profile.employee_id if profile else "N/A",
                "name": fac.display_name,
                "department_id": fac.department_id,
                "department_name": fac.department.name if fac.department else None,
                "designation": profile.designation if profile else "N/A",
                "has_official_score": bool(latest),
                "category_1_score": latest.cat1_final_score if latest else 0.0,
                "category_2_score": latest.cat2_final_score if latest else 0.0,
                "category_3_score": latest.cat3_final_score if latest else 0.0,
                "total_api_score": latest.total_final_score if latest else 0.0,
                "calculation_date": latest.calculation_date.isoformat() if latest else None,
            }
        )

    records.sort(key=lambda r: r["total_api_score"], reverse=True)
    for rank, rec in enumerate(records, start=1):
        rec["rank"] = rank

    return jsonify(
        {
            "success": True,
            "academic_year": academic_year.to_dict(),
            "count": len(records),
            "faculty_scores": records,
        }
    ), 200
