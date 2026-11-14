from datetime import date

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models.department import Department
from app.models.faculty import FacultyProfile, Qualification, WorkExperience
from app.models.user import User
from app.services.audit_service import AuditService
from app.utils.decorators import get_current_authenticated_user, role_required
from app.utils.validators import (
    before_today,
    parse_bool,
    parse_date,
    validate_email,
    validate_required_fields,
)

faculty_bp = Blueprint("faculty", __name__, url_prefix="/api/faculty")


def _clean_required_text(value):
    return str(value).strip() if value is not None else ""


@faculty_bp.post("/profile")
@role_required("faculty")
def create_profile():
    user = get_current_authenticated_user()
    if user.faculty_profile:
        return jsonify(
            {
                "success": False,
                "message": "Profile already exists. Use PUT to update it.",
            }
        ), 409

    data = request.get_json(silent=True) or {}
    required = [
        "employee_id",
        "department_id",
        "designation",
        "first_name",
        "last_name",
        "date_of_joining",
        "contact_number",
    ]
    valid, missing = validate_required_fields(data, required)
    if not valid:
        return jsonify(
            {"success": False, "message": f"Missing required fields: {', '.join(missing)}"}
        ), 400

    employee_id = _clean_required_text(data.get("employee_id"))
    if len(employee_id) > 50:
        return jsonify({"success": False, "message": "employee_id is too long."}), 400
    if FacultyProfile.query.filter_by(employee_id=employee_id).first():
        return jsonify({"success": False, "message": "Employee ID already registered."}), 409

    try:
        department_id = int(data.get("department_id"))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "department_id must be an integer."}), 400
    department = db.session.get(Department, department_id)
    if not department:
        return jsonify({"success": False, "message": "Invalid department_id."}), 400

    joining_date, error = parse_date(data.get("date_of_joining"), "date_of_joining")
    if error:
        return jsonify({"success": False, "message": error}), 400
    today_valid, today_error = before_today(joining_date, "date_of_joining")
    if not today_valid:
        return jsonify({"success": False, "message": today_error}), 400

    birth_date = None
    if data.get("date_of_birth"):
        birth_date, error = parse_date(data["date_of_birth"], "date_of_birth")
        if error:
            return jsonify({"success": False, "message": error}), 400
        birth_valid, birth_error = before_today(birth_date, "date_of_birth")
        if not birth_valid:
            return jsonify({"success": False, "message": birth_error}), 400

    alternate_email = (data.get("alternate_email") or "").strip().lower() or None
    if alternate_email:
        if not validate_email(alternate_email):
            return jsonify(
                {"success": False, "message": "Invalid alternate_email format."}
            ), 400
        if User.query.filter_by(email=alternate_email).first():
            return jsonify(
                {"success": False, "message": "alternate_email is already in use."}
            ), 409

    profile = FacultyProfile(
        user_id=user.id,
        employee_id=employee_id,
        department_id=department.id,
        designation=_clean_required_text(data.get("designation")),
        first_name=_clean_required_text(data.get("first_name")),
        last_name=_clean_required_text(data.get("last_name")),
        date_of_birth=birth_date,
        gender=data.get("gender"),
        blood_group=data.get("blood_group"),
        date_of_joining=joining_date,
        contact_number=_clean_required_text(data.get("contact_number"))[:20],
        alternate_email=alternate_email,
        address=data.get("address"),
        research_interests=data.get("research_interests"),
        professional_memberships=data.get("professional_memberships"),
        subjects_handled=data.get("subjects_handled"),
    )
    user.department_id = department.id
    db.session.add(profile)
    db.session.commit()

    AuditService.log_action(
        user_id=user.id,
        action="PROFILE_CREATED",
        target_entity="FacultyProfile",
        target_id=profile.id,
        details=f"Profile created for {profile.full_name} ({profile.employee_id}).",
    )
    return jsonify(
        {
            "success": True,
            "message": "Faculty profile created successfully.",
            "profile": profile.to_dict(),
        }
    ), 201


@faculty_bp.get("/profile")
@jwt_required()
def get_profile():
    current_user = get_current_authenticated_user()
    if not current_user:
        return jsonify({"success": False, "message": "User not found."}), 404

    target_id = request.args.get("faculty_id")
    if target_id and target_id != str(current_user.id):
        try:
            target_user = db.session.get(User, int(target_id))
        except (TypeError, ValueError):
            return jsonify({"success": False, "message": "Invalid faculty_id."}), 400
        if not target_user:
            return jsonify({"success": False, "message": "Requested faculty not found."}), 404
        if current_user.role == "admin":
            profile = target_user.faculty_profile
        elif current_user.role == "hod":
            if current_user.department_id != target_user.department_id:
                return jsonify(
                    {
                        "success": False,
                        "message": "Forbidden: HOD can only view profiles in the assigned department.",
                    }
                ), 403
            profile = target_user.faculty_profile
        else:
            return jsonify(
                {"success": False, "message": "Forbidden: you can only view your own profile."}
            ), 403
    else:
        profile = current_user.faculty_profile

    if not profile:
        return jsonify(
            {"success": False, "message": "Faculty profile not found. Please create one."}
        ), 404

    profile_dict = profile.to_dict(include_relations=True)
    return jsonify(
        {
            "success": True,
            "profile": profile_dict,
            "personalInfo": profile_dict.get("personalInfo", {}),
            "qualifications": profile_dict.get("qualifications", []),
            "experience": profile_dict.get("work_experiences", []),
        }
    ), 200


@faculty_bp.put("/profile")
@role_required("faculty")
def update_profile():
    user = get_current_authenticated_user()
    profile = user.faculty_profile
    if not profile:
        return jsonify({"success": False, "message": "Faculty profile not found."}), 404

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"success": False, "message": "No update fields supplied."}), 400

    text_fields = [
        "designation",
        "first_name",
        "last_name",
        "contact_number",
        "gender",
        "blood_group",
        "address",
        "research_interests",
        "professional_memberships",
        "subjects_handled",
    ]
    for field in text_fields:
        if field in data:
            value = data[field]
            if field in {"designation", "first_name", "last_name", "contact_number"}:
                value = _clean_required_text(value)
                if not value:
                    return jsonify(
                        {"success": False, "message": f"{field} cannot be empty."}
                    ), 400
            setattr(profile, field, value)

    for field in ("date_of_birth", "date_of_joining"):
        if field in data:
            parsed, error = parse_date(data[field], field)
            if error:
                return jsonify({"success": False, "message": error}), 400
            valid, date_error = before_today(parsed, field)
            if not valid:
                return jsonify({"success": False, "message": date_error}), 400
            setattr(profile, field, parsed)

    if "alternate_email" in data:
        alternate_email = (data.get("alternate_email") or "").strip().lower() or None
        if alternate_email and not validate_email(alternate_email):
            return jsonify(
                {"success": False, "message": "Invalid alternate_email format."}
            ), 400
        profile.alternate_email = alternate_email

    db.session.commit()
    AuditService.log_action(
        user_id=user.id,
        action="PROFILE_UPDATED",
        target_entity="FacultyProfile",
        target_id=profile.id,
        details="Faculty updated their profile.",
    )
    return jsonify(
        {
            "success": True,
            "message": "Profile updated successfully.",
            "profile": profile.to_dict(),
        }
    ), 200


@faculty_bp.put("/profile/personal")
@role_required("faculty")
def update_personal_info():
    user = get_current_authenticated_user()
    profile = user.faculty_profile
    if not profile:
        return jsonify({"success": False, "message": "Faculty profile not found."}), 404

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"success": False, "message": "No update fields supplied."}), 400

    if data.get("fullName"):
        parts = data["fullName"].strip().split(" ", 1)
        profile.first_name = parts[0]
        if len(parts) > 1:
            profile.last_name = parts[1]
    if data.get("first_name"):
        profile.first_name = data["first_name"].strip()
    if data.get("last_name"):
        profile.last_name = data["last_name"].strip()
    if data.get("phone") or data.get("contact_number"):
        profile.contact_number = (data.get("phone") or data.get("contact_number")).strip()
    if data.get("designation"):
        profile.designation = data["designation"].strip()
    if data.get("address"):
        profile.address = data["address"].strip()
    if data.get("gender"):
        profile.gender = data["gender"].strip()
    if data.get("bloodGroup") or data.get("blood_group"):
        profile.blood_group = (data.get("bloodGroup") or data.get("blood_group")).strip()
    if data.get("alternateEmail") or data.get("alternate_email"):
        profile.alternate_email = (data.get("alternateEmail") or data.get("alternate_email")).strip().lower()
    if data.get("researchInterests") or data.get("research_interests"):
        profile.research_interests = (data.get("researchInterests") or data.get("research_interests")).strip()
    if data.get("teachingInterests") or data.get("subjects_handled"):
        profile.subjects_handled = (data.get("teachingInterests") or data.get("subjects_handled")).strip()

    db.session.commit()
    AuditService.log_action(
        user_id=user.id,
        action="PROFILE_PERSONAL_UPDATED",
        target_entity="FacultyProfile",
        target_id=profile.id,
        details="Faculty updated personal information.",
    )
    profile_dict = profile.to_dict()
    return jsonify({
        "success": True,
        "message": "Personal information updated successfully.",
        "data": profile_dict.get("personalInfo", profile_dict),
    }), 200


@faculty_bp.get("/dashboard/summary")
@role_required("faculty")
def get_dashboard_summary():
    user = get_current_authenticated_user()
    profile = user.faculty_profile
    if not profile:
        return jsonify({"success": False, "message": "Faculty profile not found."}), 404

    from app.models.activity import AcademicActivity
    from app.models.academic_year import AcademicYear
    from app.services.api_calculation import APICalculationEngine

    activities = AcademicActivity.query.filter_by(faculty_id=user.id).all()
    total_activities = len(activities)
    submitted = [a for a in activities if a.status in {"SUBMITTED", "APPROVED", "REJECTED"}]
    approved = [a for a in activities if a.status == "APPROVED"]
    pending = [a for a in activities if a.status == "SUBMITTED"]
    rejected = [a for a in activities if a.status == "REJECTED"]
    draft = [a for a in activities if a.status == "DRAFT"]

    stats = {
        "totalSubmitted": len(submitted),
        "totalActivities": total_activities,
        "approved": len(approved),
        "pending": len(pending),
        "rejected": len(rejected),
        "draft": len(draft),
    }

    filled_fields = sum(1 for v in [
        profile.first_name, profile.last_name, profile.employee_id,
        profile.designation, profile.contact_number, profile.date_of_joining,
        profile.department_id, profile.address, profile.research_interests
    ] if v)
    has_quals = 1 if profile.qualifications else 0
    has_exp = 1 if profile.work_experiences else 0
    completion_pct = int(round(((filled_fields / 9.0) * 0.7 + (has_quals * 0.15) + (has_exp * 0.15)) * 100))

    active_year = AcademicYear.query.filter_by(is_active=True).first()
    api_score = None
    if active_year:
        try:
            calc = APICalculationEngine.calculate_faculty_api(
                faculty_id=user.id,
                academic_year_id=active_year.id,
                calculation_type="VERIFIED_ONLY",
                user_id=user.id,
                save_history=False,
            )
            api_score = {
                "academicYear": active_year.year_label,
                "calculationDate": calc.get("calculation_date", "")[:10],
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
                        "totalActivities": sum(1 for a in activities if a.category and "I" in a.category.category_code and "II" not in a.category.category_code and "III" not in a.category.category_code),
                        "approvedActivities": sum(1 for a in approved if a.category and "I" in a.category.category_code and "II" not in a.category.category_code and "III" not in a.category.category_code),
                        "rawScore": calc.get("category_1", {}).get("raw", 0),
                        "eligibleScore": calc.get("category_1", {}).get("eligible", 0),
                        "applicableCap": calc.get("category_1", {}).get("cap_applied") or 100,
                        "finalScore": calc.get("category_1", {}).get("final", 0),
                        "status": "Verified",
                    },
                    {
                        "key": "cat2",
                        "title": "Category II – Co-curricular & Professional Development",
                        "totalActivities": sum(1 for a in activities if a.category and "II" in a.category.category_code and "III" not in a.category.category_code),
                        "approvedActivities": sum(1 for a in approved if a.category and "II" in a.category.category_code and "III" not in a.category.category_code),
                        "rawScore": calc.get("category_2", {}).get("raw", 0),
                        "eligibleScore": calc.get("category_2", {}).get("eligible", 0),
                        "applicableCap": calc.get("category_2", {}).get("cap_applied") or 50,
                        "finalScore": calc.get("category_2", {}).get("final", 0),
                        "status": "Verified",
                    },
                    {
                        "key": "cat3",
                        "title": "Category III – Research and Academic Contributions",
                        "totalActivities": sum(1 for a in activities if a.category and "III" in a.category.category_code),
                        "approvedActivities": sum(1 for a in approved if a.category and "III" in a.category.category_code),
                        "rawScore": calc.get("category_3", {}).get("raw", 0),
                        "eligibleScore": calc.get("category_3", {}).get("eligible", 0),
                        "applicableCap": calc.get("category_3", {}).get("cap_applied") or 80,
                        "finalScore": calc.get("category_3", {}).get("final", 0),
                        "status": "Verified",
                    },
                ],
            }
        except Exception:
            api_score = None

    recent = AcademicActivity.query.filter_by(faculty_id=user.id).order_by(
        AcademicActivity.created_at.desc()
    ).limit(6).all()

    profile_dict = profile.to_dict()
    return jsonify({
        "profile": profile_dict.get("personalInfo", profile_dict),
        "personalInfo": profile_dict.get("personalInfo", profile_dict),
        "completionPercentage": completion_pct,
        "stats": stats,
        "apiScore": api_score,
        "recentActivities": [a.to_dict() for a in recent],
    }), 200


@faculty_bp.route("/qualifications", methods=["GET", "POST"])
@role_required("faculty")
def manage_qualifications():
    user = get_current_authenticated_user()
    profile = user.faculty_profile
    if not profile:
        return jsonify(
            {
                "success": False,
                "message": "Create a faculty profile before managing qualifications.",
            }
        ), 400

    if request.method == "GET":
        qualifications = Qualification.query.filter_by(
            faculty_profile_id=profile.id
        ).order_by(Qualification.year_of_passing.desc()).all()
        q_list = [item.to_dict() for item in qualifications]
        return jsonify(
            {
                "success": True,
                "qualifications": q_list,
                "data": q_list,
            }
        ), 200

    data = request.get_json(silent=True) or {}
    university = _clean_required_text(data.get("board_university") or data.get("university"))
    degree = _clean_required_text(data.get("degree"))
    institution = _clean_required_text(data.get("institution") or university)
    year_raw = data.get("year_of_passing") or data.get("yearOfPassing")
    if not (degree and institution and university and year_raw):
        return jsonify({"success": False, "message": "Missing required qualification fields."}), 400

    try:
        year_of_passing = int(year_raw)
    except (TypeError, ValueError):
        return jsonify(
            {"success": False, "message": "year_of_passing must be an integer."}
        ), 400
    if not 1900 <= year_of_passing <= date.today().year + 1:
        return jsonify(
            {"success": False, "message": "year_of_passing is outside a valid range."}
        ), 400

    qualification = Qualification(
        faculty_profile_id=profile.id,
        degree=degree,
        specialization=data.get("specialization"),
        institution=institution,
        board_university=university,
        year_of_passing=year_of_passing,
        percentage_or_cgpa=data.get("percentage_or_cgpa") or data.get("percentageOrCgpa"),
    )
    db.session.add(qualification)
    db.session.commit()
    AuditService.log_action(
        user_id=user.id,
        action="QUALIFICATION_ADDED",
        target_entity="Qualification",
        target_id=qualification.id,
        details=f"Added qualification {qualification.degree}.",
    )
    q_dict = qualification.to_dict()
    return jsonify(
        {
            "success": True,
            "message": "Qualification added successfully.",
            "qualification": q_dict,
            "data": q_dict,
        }
    ), 201


@faculty_bp.put("/qualifications/<int:qualification_id>")
@role_required("faculty")
def update_qualification(qualification_id):
    user = get_current_authenticated_user()
    if not user.faculty_profile:
        return jsonify({"success": False, "message": "Profile not found."}), 404
    qualification = Qualification.query.filter_by(
        id=qualification_id, faculty_profile_id=user.faculty_profile.id
    ).first()
    if not qualification:
        return jsonify({"success": False, "message": "Qualification not found."}), 404

    data = request.get_json(silent=True) or {}
    for field in ("degree", "specialization", "institution", "percentage_or_cgpa"):
        if field in data:
            setattr(qualification, field, data[field])
    if "percentageOrCgpa" in data:
        qualification.percentage_or_cgpa = data["percentageOrCgpa"]
    if "board_university" in data:
        qualification.board_university = data["board_university"]
    elif "university" in data:
        qualification.board_university = data["university"]
    year_val = data.get("year_of_passing") or data.get("yearOfPassing")
    if year_val is not None:
        try:
            year = int(year_val)
        except (TypeError, ValueError):
            return jsonify({"success": False, "message": "Invalid year_of_passing."}), 400
        if not 1900 <= year <= date.today().year + 1:
            return jsonify({"success": False, "message": "Invalid year_of_passing."}), 400
        qualification.year_of_passing = year
    db.session.commit()
    q_dict = qualification.to_dict()
    return jsonify(
        {
            "success": True,
            "message": "Qualification updated.",
            "qualification": q_dict,
            "data": q_dict,
        }
    ), 200


@faculty_bp.delete("/qualifications/<int:qualification_id>")
@role_required("faculty")
def delete_qualification(qualification_id):
    user = get_current_authenticated_user()
    if not user.faculty_profile:
        return jsonify({"success": False, "message": "Profile not found."}), 404
    qualification = Qualification.query.filter_by(
        id=qualification_id, faculty_profile_id=user.faculty_profile.id
    ).first()
    if not qualification:
        return jsonify({"success": False, "message": "Qualification not found."}), 404
    db.session.delete(qualification)
    db.session.commit()
    AuditService.log_action(
        user_id=user.id,
        action="QUALIFICATION_DELETED",
        target_entity="Qualification",
        target_id=qualification_id,
    )
    return jsonify({"success": True, "message": "Qualification deleted."}), 200


@faculty_bp.route("/experience", methods=["GET", "POST"])
@role_required("faculty")
def manage_experience():
    user = get_current_authenticated_user()
    profile = user.faculty_profile
    if not profile:
        return jsonify(
            {
                "success": False,
                "message": "Create a faculty profile before managing experience.",
            }
        ), 400

    if request.method == "GET":
        query = WorkExperience.query.filter_by(faculty_profile_id=profile.id)
        exp_type = request.args.get("experience_type") or request.args.get("type")
        if exp_type:
            query = query.filter_by(experience_type=str(exp_type).strip().lower())
        experiences = query.order_by(WorkExperience.from_date.desc()).all()
        exp_list = [item.to_dict() for item in experiences]
        return jsonify(
            {
                "success": True,
                "count": len(experiences),
                "experiences": exp_list,
                "data": exp_list,
            }
        ), 200

    data = request.get_json(silent=True) or {}
    org = _clean_required_text(data.get("organization") or data.get("institution"))
    desig = _clean_required_text(data.get("designation"))
    raw_type = str(data.get("experience_type") or data.get("employmentType") or "teaching").strip().lower()
    if "teach" in raw_type or "full" in raw_type or "adjunct" in raw_type:
        exp_type = "teaching"
    elif "res" in raw_type or "postdoc" in raw_type:
        exp_type = "research"
    elif "ind" in raw_type:
        exp_type = "industry"
    elif "prev" in raw_type:
        exp_type = "previous"
    else:
        exp_type = raw_type if raw_type in {"teaching", "research", "industry", "previous"} else "teaching"

    raw_from = data.get("from_date") or data.get("startDate")
    if not (org and desig and raw_from):
        return jsonify(
            {"success": False, "message": "organization, designation, and from_date are required."}
        ), 400

    from_date, error = parse_date(raw_from, "from_date")
    if error:
        return jsonify({"success": False, "message": error}), 400

    raw_to = data.get("to_date") or data.get("endDate")
    to_date = None
    if raw_to:
        to_date, error = parse_date(raw_to, "to_date")
        if error:
            return jsonify({"success": False, "message": error}), 400
    if to_date and from_date > to_date:
        return jsonify(
            {"success": False, "message": "from_date must be before to_date."}
        ), 400

    is_current = parse_bool(data.get("is_current") if data.get("is_current") is not None else data.get("isCurrent"), False)
    if is_current:
        to_date = None

    experience = WorkExperience(
        faculty_profile_id=profile.id,
        organization=org,
        designation=desig,
        experience_type=exp_type,
        from_date=from_date,
        to_date=to_date,
        is_current=is_current,
        description=data.get("description") or data.get("totalExperience"),
    )
    db.session.add(experience)
    db.session.commit()
    AuditService.log_action(
        user_id=user.id,
        action="EXPERIENCE_ADDED",
        target_entity="WorkExperience",
        target_id=experience.id,
        details=f"Added experience at {experience.organization}.",
    )
    e_dict = experience.to_dict()
    return jsonify(
        {
            "success": True,
            "message": "Work experience added successfully.",
            "experience": e_dict,
            "data": e_dict,
        }
    ), 201


@faculty_bp.put("/experience/<int:experience_id>")
@role_required("faculty")
def update_experience(experience_id):
    user = get_current_authenticated_user()
    if not user.faculty_profile:
        return jsonify({"success": False, "message": "Profile not found."}), 404
    experience = WorkExperience.query.filter_by(
        id=experience_id, faculty_profile_id=user.faculty_profile.id
    ).first()
    if not experience:
        return jsonify({"success": False, "message": "Work experience not found."}), 404

    data = request.get_json(silent=True) or {}
    for field in ("designation", "description"):
        if field in data:
            setattr(experience, field, data[field])
    if "organization" in data:
        experience.organization = data["organization"]
    elif "institution" in data:
        experience.organization = data["institution"]
    if "totalExperience" in data and "description" not in data:
        experience.description = data["totalExperience"]

    if "experience_type" in data or "employmentType" in data:
        raw_val = str(data.get("experience_type") or data.get("employmentType")).strip().lower()
        if "teach" in raw_val or "full" in raw_val:
            experience.experience_type = "teaching"
        elif "res" in raw_val:
            experience.experience_type = "research"
        elif "ind" in raw_val:
            experience.experience_type = "industry"
        elif "prev" in raw_val:
            experience.experience_type = "previous"
        elif raw_val in {"teaching", "research", "industry", "previous"}:
            experience.experience_type = raw_val

    raw_from = data.get("from_date") or data.get("startDate")
    if raw_from:
        parsed, error = parse_date(raw_from, "from_date")
        if error:
            return jsonify({"success": False, "message": error}), 400
        experience.from_date = parsed

    raw_to = data.get("to_date") or data.get("endDate")
    if raw_to is not None:
        if raw_to == "":
            experience.to_date = None
        else:
            parsed, error = parse_date(raw_to, "to_date")
            if error:
                return jsonify({"success": False, "message": error}), 400
            experience.to_date = parsed

    if "is_current" in data or "isCurrent" in data:
        cur_val = data.get("is_current") if "is_current" in data else data.get("isCurrent")
        experience.is_current = parse_bool(cur_val, False)
        if experience.is_current:
            experience.to_date = None

    if experience.to_date and experience.from_date > experience.to_date:
        return jsonify(
            {"success": False, "message": "from_date must be before to_date."}
        ), 400
    db.session.commit()
    e_dict = experience.to_dict()
    return jsonify(
        {
            "success": True,
            "message": "Work experience updated.",
            "experience": e_dict,
            "data": e_dict,
        }
    ), 200


@faculty_bp.delete("/experience/<int:experience_id>")
@role_required("faculty")
def delete_experience(experience_id):
    user = get_current_authenticated_user()
    if not user.faculty_profile:
        return jsonify({"success": False, "message": "Profile not found."}), 404
    experience = WorkExperience.query.filter_by(
        id=experience_id, faculty_profile_id=user.faculty_profile.id
    ).first()
    if not experience:
        return jsonify({"success": False, "message": "Work experience not found."}), 404
    db.session.delete(experience)
    db.session.commit()
    AuditService.log_action(
        user_id=user.id,
        action="EXPERIENCE_DELETED",
        target_entity="WorkExperience",
        target_id=experience_id,
    )
    return jsonify({"success": True, "message": "Work experience deleted."}), 200
