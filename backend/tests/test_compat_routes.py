"""Tests for frontend contract compatibility routes."""
import json
from app.models.academic_year import AcademicYear
from app.models.activity import AcademicActivity
from app.models.faculty import FacultyProfile


def test_system_reference_and_config_routes(client, sample_users, auth_headers):
    headers = auth_headers(sample_users["faculty"].id)

    # Academic years list
    res_years = client.get("/api/academic-years", headers=headers)
    assert res_years.status_code == 200
    years_data = res_years.get_json()
    assert isinstance(years_data, list)
    assert len(years_data) >= 1
    assert "year" in years_data[0]
    assert "status" in years_data[0]

    # Activity categories list
    res_cats = client.get("/api/activity-categories", headers=headers)
    assert res_cats.status_code == 200
    cats_data = res_cats.get_json()
    assert isinstance(cats_data, list)
    assert len(cats_data) >= 3
    assert "categoryKey" in cats_data[0]

    # Upload config
    res_cfg = client.get("/api/config/upload", headers=headers)
    assert res_cfg.status_code == 200
    cfg_data = res_cfg.get_json()
    assert "maxUploadSizeMb" in cfg_data
    assert "allowedFileTypes" in cfg_data
    assert "pdf" in cfg_data["allowedFileTypes"]


def test_faculty_dashboard_and_personal_profile_routes(client, sample_users, auth_headers):
    faculty = sample_users["faculty"]
    headers = auth_headers(faculty.id)

    # Create initial faculty profile
    client.post("/api/faculty/profile", json={
        "employee_id": "EMP-COMPAT-001",
        "department_id": sample_users["cse"].id,
        "designation": "Assistant Professor",
        "first_name": "Kavita",
        "last_name": "Patil",
        "date_of_joining": "2020-01-15",
        "contact_number": "9876543210",
    }, headers=headers)

    # Test dashboard summary
    res_dash = client.get("/api/faculty/dashboard/summary", headers=headers)
    assert res_dash.status_code == 200
    dash_data = res_dash.get_json()
    assert "profile" in dash_data
    assert "stats" in dash_data
    assert "completionPercentage" in dash_data
    assert dash_data["stats"]["totalActivities"] == 0

    # Test personal info update
    res_update = client.put("/api/faculty/profile/personal", json={
        "fullName": "Dr. Kavita Patil",
        "designation": "Associate Professor",
        "phone": "9811122233",
        "researchInterests": "Cloud Computing, Data Science",
    }, headers=headers)
    assert res_update.status_code == 200
    update_data = res_update.get_json()
    assert update_data["success"] is True
    assert update_data["data"]["fullName"] == "Dr. Kavita Patil"
    assert update_data["data"]["designation"] == "Associate Professor"


def test_faculty_scores_companion_endpoints(client, sample_users, auth_headers):
    faculty = sample_users["faculty"]
    headers = auth_headers(faculty.id)

    # Scores endpoint without academicYear returns active year score
    res_scores = client.get("/api/scores", headers=headers)
    assert res_scores.status_code == 200
    score_data = res_scores.get_json()
    assert "overallScore" in score_data
    assert "categories" in score_data
    assert len(score_data["categories"]) == 3

    # Category score endpoint
    res_cat1 = client.get("/api/scores/category/cat1", headers=headers)
    assert res_cat1.status_code == 200
    cat1_data = res_cat1.get_json()
    assert cat1_data["key"] == "cat1"
    assert "rawScore" in cat1_data
    assert "eligibleScore" in cat1_data


def test_hod_companion_endpoints(client, sample_users, auth_headers):
    hod = sample_users["hod"]
    headers = auth_headers(hod.id)

    # HOD summary
    res_sum = client.get("/api/hod/summary", headers=headers)
    assert res_sum.status_code == 200
    sum_data = res_sum.get_json()
    assert "departmentName" in sum_data
    assert "totalFaculty" in sum_data
    assert "facultyScoreOverview" in sum_data

    # HOD verifications list
    res_verifs = client.get("/api/hod/verifications", headers=headers)
    assert res_verifs.status_code == 200
    assert isinstance(res_verifs.get_json(), list)

    # HOD report preview
    res_rep = client.get("/api/hod/reports?type=department-summary", headers=headers)
    assert res_rep.status_code == 200
    assert "department" in res_rep.get_json()


def test_admin_companion_endpoints(client, sample_users, auth_headers):
    admin = sample_users["admin"]
    headers = auth_headers(admin.id)

    # Admin metrics
    res_metrics = client.get("/api/admin/metrics", headers=headers)
    assert res_metrics.status_code == 200
    metrics_data = res_metrics.get_json()
    assert "totalUsers" in metrics_data
    assert "totalDepartments" in metrics_data

    # Admin faculty list
    res_fac = client.get("/api/admin/faculty", headers=headers)
    assert res_fac.status_code == 200
    assert isinstance(res_fac.get_json(), list)

    # Toggle user status
    target_user_id = sample_users["faculty"].id
    res_status = client.patch(f"/api/admin/users/{target_user_id}/status", headers=headers)
    assert res_status.status_code == 200
    assert res_status.get_json()["success"] is True

    # Re-enable user status
    res_status2 = client.patch(f"/api/admin/users/{target_user_id}/status", headers=headers)
    assert res_status2.status_code == 200
    assert res_status2.get_json()["is_active"] is True


def test_notifications_and_password_companion_endpoints(client, sample_users, auth_headers):
    faculty = sample_users["faculty"]
    headers = auth_headers(faculty.id)

    # Notifications list
    res_notes = client.get("/api/notifications", headers=headers)
    assert res_notes.status_code == 200
    assert isinstance(res_notes.get_json(), list)

    # Read all notifications
    res_readall = client.post("/api/notifications/read-all", json={}, headers=headers)
    assert res_readall.status_code == 200
    assert res_readall.get_json()["success"] is True

    # Password change
    res_pwd = client.post("/api/auth/change-password", json={
        "oldPassword": "FacPass123!",
        "newPassword": "NewStrongPassword456!",
    }, headers=headers)
    assert res_pwd.status_code == 200
    assert res_pwd.get_json()["success"] is True

    # Revert password back for test idempotency
    res_pwd_revert = client.post("/api/auth/change-password", json={
        "oldPassword": "NewStrongPassword456!",
        "newPassword": "FacPass123!",
    }, headers=headers)
    assert res_pwd_revert.status_code == 200
