import os
import io
import pytest
from datetime import date
from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.department import Department
from app.models.academic_year import AcademicYear
from app.models.scoring_rule import ActivityCategory, APIScoringRule
from app.models.faculty import FacultyProfile, Qualification, WorkExperience
from flask_jwt_extended import create_access_token


@pytest.fixture(scope='session')
def app():
    """Create testing application instance."""
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()


@pytest.fixture(scope='function')
def db_session(app):
    """Provide a clean database session per test function."""
    with app.app_context():
        db.create_all()

        # Seed minimal baseline data
        cse = Department(name="Computer Science", code="CSE")
        ece = Department(name="Electronics", code="ECE")
        db.session.add_all([cse, ece])
        db.session.flush()

        ay = AcademicYear(
            year_label="2023-2024",
            start_date=date(2023, 6, 1),
            end_date=date(2024, 5, 31),
            is_active=True
        )
        db.session.add(ay)
        db.session.flush()

        cat1 = ActivityCategory(
            category_code="CATEGORY_I",
            name="Teaching, Learning and Evaluation",
            max_score_limit=80.0,
            min_score_required=75.0
        )
        cat2 = ActivityCategory(
            category_code="CATEGORY_II",
            name="Co-curricular, Extension and Professional Development",
            max_score_limit=50.0,
            min_score_required=15.0
        )
        cat3 = ActivityCategory(
            category_code="CATEGORY_III",
            name="Research and Academic Contributions",
            max_score_limit=None,
            min_score_required=30.0
        )
        db.session.add_all([cat1, cat2, cat3])
        db.session.flush()

        # Add key rules
        r1 = APIScoringRule(
            category_id=cat1.id,
            activity_type="LECTURES_TEACHING",
            rule_code="RULE_CAT1_TEST",
            description="Lectures per hour",
            base_score=1.0,
            max_score_per_activity=50.0,
            scoring_unit="per_hour"
        )
        r2 = APIScoringRule(
            category_id=cat2.id,
            activity_type="WORKSHOP_FDP",
            rule_code="RULE_CAT2_TEST",
            description="Workshops attended",
            base_score=15.0,
            max_score_per_activity=30.0,
            scoring_unit="per_unit"
        )
        r3 = APIScoringRule(
            category_id=cat3.id,
            activity_type="RESEARCH_PAPER_JOURNAL",
            rule_code="RULE_CAT3_TEST",
            description="Research paper in journal",
            base_score=25.0,
            max_score_per_activity=None,
            scoring_unit="per_paper",
            # Test configuration only. Real values must come from the
            # institution's approved API rules.
            author_role_weights={
                "sole author": 1.0,
                "first author": 0.7,
                "corresponding author": 0.7,
                "co-author": 0.3,
            },
        )
        db.session.add_all([r1, r2, r3])

        # Users
        admin = User(username="admin_user", email="admin@test.edu", role="admin")
        admin.set_password("AdminPass123!")

        hod_cse = User(username="hod_user", email="hod@test.edu", role="hod", department_id=cse.id)
        hod_cse.set_password("HodPass123!")

        hod_ece = User(username="hod_ece", email="hodece@test.edu", role="hod", department_id=ece.id)
        hod_ece.set_password("HodPass123!")

        faculty = User(username="fac_user", email="fac@test.edu", role="faculty", department_id=cse.id)
        faculty.set_password("FacPass123!")

        faculty_ece = User(username="fac_ece", email="facece@test.edu", role="faculty", department_id=ece.id)
        faculty_ece.set_password("FacPass123!")

        db.session.add_all([admin, hod_cse, hod_ece, faculty, faculty_ece])
        db.session.commit()

        yield db.session

        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app, db_session):
    return app.test_client()


@pytest.fixture
def auth_headers(app):
    def _get_headers(user_id):
        with app.app_context():
            token = create_access_token(identity=str(user_id))
            return {'Authorization': f'Bearer {token}'}
    return _get_headers


@pytest.fixture
def sample_users(db_session):
    admin = User.query.filter_by(username="admin_user").first()
    hod = User.query.filter_by(username="hod_user").first()
    hod_ece = User.query.filter_by(username="hod_ece").first()
    faculty = User.query.filter_by(username="fac_user").first()
    faculty_ece = User.query.filter_by(username="fac_ece").first()
    cse = Department.query.filter_by(code="CSE").first()
    ece = Department.query.filter_by(code="ECE").first()
    ay = AcademicYear.query.filter_by(year_label="2023-2024").first()
    cat1 = ActivityCategory.query.filter_by(category_code="CATEGORY_I").first()
    cat2 = ActivityCategory.query.filter_by(category_code="CATEGORY_II").first()
    cat3 = ActivityCategory.query.filter_by(category_code="CATEGORY_III").first()

    return {
        'admin': admin,
        'hod': hod,
        'hod_ece': hod_ece,
        'faculty': faculty,
        'faculty_ece': faculty_ece,
        'cse': cse,
        'ece': ece,
        'ay': ay,
        'cat1': cat1,
        'cat2': cat2,
        'cat3': cat3,
    }
