"""Initialise baseline data.

Seeds default departments, academic years, activity categories, demo accounts,
and standard institution-approved UGC Regulation 2018 template scoring rules for
Category I, Category II, and Category III activities. All scoring rules and caps
can be configured or customized by administrators.
"""
import os
from datetime import date

from app import create_app
from app.extensions import db
from app.models.academic_year import AcademicYear
from app.models.department import Department
from app.models.faculty import FacultyProfile, Qualification, WorkExperience
from app.models.scoring_rule import ActivityCategory, APIScoringRule
from app.models.system_setting import SystemSetting
from app.models.user import User


def _ensure_department(name, code, description):
    department = Department.query.filter_by(code=code).first()
    if not department:
        department = Department(name=name, code=code, description=description)
        db.session.add(department)
        db.session.flush()
    return department


def _ensure_user(username, email, role, password, department=None):
    user = User.query.filter_by(username=username).first()
    if not user:
        user = User(
            username=username,
            email=email,
            role=role,
            department_id=department.id if department else None,
            is_active=True,
        )
        user.set_password(password)
        db.session.add(user)
        db.session.flush()
    return user


def seed_database():
    app = create_app()
    with app.app_context():
        db.create_all()
        print("Seeding baseline data (no scoring values are seeded)...")

        cse = _ensure_department(
            "Computer Science and Engineering",
            "CSE",
            "Department of Computer Science and Engineering",
        )
        ece = _ensure_department(
            "Electronics and Communication Engineering",
            "ECE",
            "Department of Electronics and Communication Engineering",
        )
        me = _ensure_department(
            "Mechanical Engineering",
            "ME",
            "Department of Mechanical Engineering",
        )
        it = _ensure_department(
            "Information Technology", "IT", "Department of Information Technology"
        )

        current_start = date.today().year if date.today().month >= 6 else date.today().year - 1
        year_specs = [
            (f"{current_start - 1}-{current_start}", current_start - 1, False),
            (f"{current_start}-{current_start + 1}", current_start, True),
        ]
        for label, start_year, is_active in year_specs:
            existing = AcademicYear.query.filter_by(year_label=label).first()
            if not existing:
                db.session.add(
                    AcademicYear(
                        year_label=label,
                        start_date=date(start_year, 6, 1),
                        end_date=date(start_year + 1, 5, 31),
                        is_active=is_active,
                    )
                )
        if not AcademicYear.query.filter_by(is_active=True).first():
            latest = AcademicYear.query.order_by(AcademicYear.start_date.desc()).first()
            if latest:
                latest.is_active = True

        categories = [
            (
                "CATEGORY_I",
                "Teaching, Learning and Evaluation",
                "Teaching workload, learning materials, innovation, curriculum, "
                "examination duties, evaluation and student mentoring.",
                80.0,
                75.0,
            ),
            (
                "CATEGORY_II",
                "Co-curricular, Extension and Professional Development",
                "Extension and community activities, NSS/NCC, workshops, FDPs, "
                "seminars, conferences and institutional responsibilities.",
                50.0,
                15.0,
            ),
            (
                "CATEGORY_III",
                "Research and Academic Contributions",
                "Publications, books and chapters, patents, projects, research "
                "guidance, conference presentations, awards and consultancy.",
                None,
                30.0,
            ),
        ]
        cat_map = {}
        for code, name, description, max_cap, min_req in categories:
            cat = ActivityCategory.query.filter_by(category_code=code).first()
            if not cat:
                cat = ActivityCategory(
                    category_code=code,
                    name=name,
                    description=description,
                    max_score_limit=max_cap,
                    min_score_required=min_req,
                )
                db.session.add(cat)
                db.session.flush()
            cat_map[code] = cat

        ugc_rules = [
            # Category I - Teaching, Learning and Evaluation
            (
                "CATEGORY_I",
                "LECTURES_AND_TEACHING",
                "RULE_UGC_CAT1_LECTURES",
                "Lectures, seminars, tutorials, practicals, contact hours",
                1.0,
                50.0,
                "per_hour",
                {},
            ),
            (
                "CATEGORY_I",
                "TEACHING_MATERIALS",
                "RULE_UGC_CAT1_MATERIALS",
                "Preparation and imparting of knowledge / instruction as per curriculum",
                10.0,
                20.0,
                "per_unit",
                {},
            ),
            (
                "CATEGORY_I",
                "INNOVATIVE_TEACHING_METHODS",
                "RULE_UGC_CAT1_INNOVATION",
                "Use of participatory and innovative teaching-learning methodologies",
                10.0,
                20.0,
                "per_unit",
                {},
            ),
            (
                "CATEGORY_I",
                "CURRICULUM_DEVELOPMENT",
                "RULE_UGC_CAT1_CURRICULUM",
                "Curriculum enrichment and development of syllabus",
                10.0,
                20.0,
                "per_unit",
                {},
            ),
            (
                "CATEGORY_I",
                "EXAMINATION_DUTIES",
                "RULE_UGC_CAT1_EXAMS",
                "Examination duties (invigilation, question paper setting, evaluation)",
                10.0,
                20.0,
                "per_unit",
                {},
            ),
            (
                "CATEGORY_I",
                "EVALUATION_AND_ASSESSMENT",
                "RULE_UGC_CAT1_EVALUATION",
                "Continuous assessment, evaluation and grading duties",
                10.0,
                20.0,
                "per_unit",
                {},
            ),
            (
                "CATEGORY_I",
                "STUDENT_MENTORING",
                "RULE_UGC_CAT1_MENTORING",
                "Student mentoring, counselling and remedial classes",
                5.0,
                10.0,
                "per_unit",
                {},
            ),
            (
                "CATEGORY_I",
                "OTHER_TEACHING_ACTIVITIES",
                "RULE_UGC_CAT1_OTHER",
                "Other approved teaching and evaluation activities",
                5.0,
                10.0,
                "per_unit",
                {},
            ),
            # Category II - Co-curricular, Extension and Professional Development
            (
                "CATEGORY_II",
                "EXTENSION_ACTIVITIES",
                "RULE_UGC_CAT2_EXTENSION",
                "Extension and social outreach activities",
                10.0,
                20.0,
                "per_unit",
                {},
            ),
            (
                "CATEGORY_II",
                "COMMUNITY_ENGAGEMENT",
                "RULE_UGC_CAT2_COMMUNITY",
                "Community work and societal engagement",
                10.0,
                20.0,
                "per_unit",
                {},
            ),
            (
                "CATEGORY_II",
                "NSS_NCC_ACTIVITIES",
                "RULE_UGC_CAT2_NSS_NCC",
                "NSS / NCC officer duties and youth development",
                10.0,
                20.0,
                "per_unit",
                {},
            ),
            (
                "CATEGORY_II",
                "WORKSHOPS",
                "RULE_UGC_CAT2_WORKSHOPS",
                "Workshops and symposiums attended / organized",
                10.0,
                20.0,
                "per_unit",
                {},
            ),
            (
                "CATEGORY_II",
                "FACULTY_DEVELOPMENT_PROGRAMMES",
                "RULE_UGC_CAT2_FDP",
                "Faculty Development Programmes (one/two-week FDPs / refresher courses)",
                15.0,
                30.0,
                "per_unit",
                {},
            ),
            (
                "CATEGORY_II",
                "SEMINARS_AND_CONFERENCES",
                "RULE_UGC_CAT2_SEMINARS",
                "Seminars, conferences, and training courses",
                10.0,
                20.0,
                "per_unit",
                {},
            ),
            (
                "CATEGORY_II",
                "PROFESSIONAL_DEVELOPMENT",
                "RULE_UGC_CAT2_PROF_DEV",
                "Professional development and continuing education",
                10.0,
                20.0,
                "per_unit",
                {},
            ),
            (
                "CATEGORY_II",
                "INSTITUTIONAL_RESPONSIBILITIES",
                "RULE_UGC_CAT2_INST_RESP",
                "Institutional responsibilities, committee work, IQAC, admissions",
                10.0,
                25.0,
                "per_unit",
                {},
            ),
            # Category III - Research and Academic Contributions
            (
                "CATEGORY_III",
                "RESEARCH_PUBLICATIONS",
                "RULE_UGC_CAT3_PUBS",
                "Research publications in refereed / peer-reviewed journals",
                25.0,
                None,
                "per_paper",
                {
                    "sole author": 1.0,
                    "first author": 0.7,
                    "corresponding author": 0.7,
                    "co-author": 0.3,
                },
            ),
            (
                "CATEGORY_III",
                "BOOKS_AND_CHAPTERS",
                "RULE_UGC_CAT3_BOOKS",
                "Books authored or chapters contributed to edited volumes",
                10.0,
                None,
                "per_book",
                {"sole author": 1.0, "co-author": 0.5},
            ),
            (
                "CATEGORY_III",
                "RESEARCH_PAPERS",
                "RULE_UGC_CAT3_PAPERS",
                "Conference proceedings full papers / indexed papers",
                15.0,
                None,
                "per_paper",
                {
                    "sole author": 1.0,
                    "first author": 0.7,
                    "corresponding author": 0.7,
                    "co-author": 0.3,
                },
            ),
            (
                "CATEGORY_III",
                "PATENTS",
                "RULE_UGC_CAT3_PATENTS",
                "Patents granted / published (national / international)",
                30.0,
                None,
                "per_patent",
                {"sole inventor": 1.0, "co-inventor": 0.6},
            ),
            (
                "CATEGORY_III",
                "RESEARCH_PROJECTS",
                "RULE_UGC_CAT3_PROJECTS",
                "Sponsored research projects completed / ongoing",
                20.0,
                None,
                "per_project",
                {},
            ),
            (
                "CATEGORY_III",
                "RESEARCH_GUIDANCE",
                "RULE_UGC_CAT3_GUIDANCE",
                "Research guidance: Ph.D. awarded / thesis submitted / M.Phil.",
                10.0,
                None,
                "per_unit",
                {},
            ),
            (
                "CATEGORY_III",
                "CONFERENCE_PRESENTATIONS",
                "RULE_UGC_CAT3_CONF",
                "Papers presented in international / national conferences",
                5.0,
                None,
                "per_unit",
                {},
            ),
            (
                "CATEGORY_III",
                "RESEARCH_AWARDS",
                "RULE_UGC_CAT3_AWARDS",
                "Academic / research awards and fellowship recognitions",
                15.0,
                None,
                "per_unit",
                {},
            ),
            (
                "CATEGORY_III",
                "CONSULTANCY",
                "RULE_UGC_CAT3_CONSULTANCY",
                "Consultancy projects undertaken for industry / government",
                10.0,
                None,
                "per_project",
                {},
            ),
            (
                "CATEGORY_III",
                "OTHER_RESEARCH_CONTRIBUTIONS",
                "RULE_UGC_CAT3_OTHER",
                "Other approved research contributions",
                5.0,
                None,
                "per_unit",
                {},
            ),
        ]
        for cat_code, act_type, rule_code, desc, base_score, max_cap, unit, weights in ugc_rules:
            if not APIScoringRule.query.filter_by(rule_code=rule_code).first():
                cat = cat_map.get(cat_code)
                if cat:
                    db.session.add(
                        APIScoringRule(
                            category_id=cat.id,
                            activity_type=act_type,
                            rule_code=rule_code,
                            description=desc,
                            base_score=base_score,
                            max_score_per_activity=max_cap,
                            scoring_unit=unit,
                            author_role_weights=weights if weights else None,
                            rule_version="UGC-REGULATION-2018-V1",
                            is_active=True,
                        )
                    )

        admin_password = os.getenv("SEED_ADMIN_PASSWORD", "AdminDemo123!")
        hod_password = os.getenv("SEED_HOD_PASSWORD", "HodDemo123!")
        faculty_password = os.getenv("SEED_FACULTY_PASSWORD", "FacultyDemo123!")

        admin = _ensure_user(
            "admin", "admin@college.example", "admin", admin_password, department=None
        )
        hod = _ensure_user(
            "hod_cse", "hod.cse@college.example", "hod", hod_password, cse
        )
        faculty = _ensure_user(
            "faculty_demo",
            "faculty.demo@college.example",
            "faculty",
            faculty_password,
            cse,
        )

        if not faculty.faculty_profile:
            profile = FacultyProfile(
                user_id=faculty.id,
                employee_id="DEMO-CSE-001",
                department_id=cse.id,
                designation="Assistant Professor",
                first_name="Demo",
                last_name="Faculty",
                date_of_birth=date(1988, 5, 20),
                gender="Prefer not to say",
                date_of_joining=date(2019, 8, 1),
                contact_number="+91-9000000000",
                alternate_email=None,
                address="Demo address",
                research_interests="Replace with actual research interests",
                professional_memberships="Replace with memberships",
                subjects_handled="Replace with subjects",
            )
            db.session.add(profile)
            db.session.flush()
            db.session.add(
                Qualification(
                    faculty_profile_id=profile.id,
                    degree="Ph.D.",
                    specialization="Computer Science",
                    institution="Sample University",
                    board_university="Sample University",
                    year_of_passing=2018,
                    percentage_or_cgpa=None,
                )
            )
            db.session.add(
                WorkExperience(
                    faculty_profile_id=profile.id,
                    organization="Sample College",
                    designation="Assistant Professor",
                    experience_type="teaching",
                    from_date=date(2019, 8, 1),
                    to_date=None,
                    is_current=True,
                    description="Teaching and research duties.",
                )
            )

        settings = {
            "institution_name": ("Sample College", "Institution display name."),
            "api_guideline_reference": (
                "",
                "Reference number/date of the officially approved API guidelines.",
            ),
            "official_score_note": (
                "Official score includes only HOD-approved activities.",
                "Note displayed with official API calculations.",
            ),
        }
        for key, (value, description) in settings.items():
            if not db.session.get(SystemSetting, key):
                db.session.add(
                    SystemSetting(
                        key=key, value=value, description=description, updated_by_user_id=admin.id
                    )
                )

        db.session.commit()
        print("Baseline data and UGC Regulation 2018 template scoring rules created.")
        print("Demo accounts (change these passwords immediately):")
        print(f"  Admin   : admin / {admin_password}")
        print(f"  HOD     : hod_cse / {hod_password}")
        print(f"  Faculty : faculty_demo / {faculty_password}")
        print("Standard UGC Regulation 2018 template rules and category caps are initialized.")
        print("Administrators can customize rules via /api/admin/rules and category caps via /api/admin/categories.")


if __name__ == "__main__":
    seed_database()
