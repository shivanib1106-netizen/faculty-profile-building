import pytest
from app.models.scoring_rule import ActivityCategory, APIScoringRule
from app.models.activity import AcademicActivity
from app.models.document import SupportingDocument


def test_category_scores_and_overall_score_endpoints(client, sample_users, auth_headers):
    fac_headers = auth_headers(sample_users["faculty"].id)
    hod_headers = auth_headers(sample_users["hod"].id)

    # 1. Create and approve a Category 1 activity
    r1 = client.post(
        "/api/activities",
        json={
            "academic_year_id": sample_users["ay"].id,
            "category_id": sample_users["cat1"].id,
            "activity_type": "LECTURES_TEACHING",
            "title": "Algorithms Lecture Hours",
            "activity_date": "2023-09-10",
            "duration_or_units": 45.0,
        },
        headers=fac_headers,
    )
    act1_id = r1.get_json()["activity"]["id"]
    client.post(f"/api/activities/{act1_id}/submit", headers=fac_headers)
    client.post(
        f"/api/hod/activities/{act1_id}/verify",
        json={"action": "APPROVED"},
        headers=hod_headers,
    )

    # 2. View category-wise scores endpoint
    res_cat = client.get(
        f"/api/calculations/category-scores?academic_year_id={sample_users['ay'].id}",
        headers=fac_headers,
    )
    assert res_cat.status_code == 200
    cat_data = res_cat.get_json()
    assert cat_data["success"] is True
    assert "categories" in cat_data
    assert "category_breakdown" in cat_data
    assert cat_data["categories"]["category_1"]["final"] == 45.0

    # 3. View overall score endpoint
    res_overall = client.get(
        f"/api/calculations/overall-score?academic_year_id={sample_users['ay'].id}",
        headers=fac_headers,
    )
    assert res_overall.status_code == 200
    overall_data = res_overall.get_json()
    assert overall_data["success"] is True
    assert overall_data["total_final_score"] == 45.0
    assert overall_data["category_totals"]["category_1"] == 45.0


def test_hod_activity_remarks_and_faculty_profile(client, sample_users, auth_headers):
    fac_headers = auth_headers(sample_users["faculty"].id)
    hod_headers = auth_headers(sample_users["hod"].id)

    # Create faculty profile
    client.post(
        "/api/faculty/profile",
        json={
            "employee_id": "FAC-CSE-888",
            "department_id": sample_users["cse"].id,
            "designation": "Associate Professor",
            "first_name": "Ramesh",
            "last_name": "Gupta",
            "date_of_joining": "2018-07-01",
            "contact_number": "9876543219",
        },
        headers=fac_headers,
    )

    # Create activity
    r = client.post(
        "/api/activities",
        json={
            "academic_year_id": sample_users["ay"].id,
            "category_id": sample_users["cat1"].id,
            "activity_type": "LECTURES_TEACHING",
            "title": "Software Engineering Lab",
            "activity_date": "2023-10-10",
            "duration_or_units": 20.0,
        },
        headers=fac_headers,
    )
    act_id = r.get_json()["activity"]["id"]

    # HOD adds remarks on activity
    res_rem = client.post(
        f"/api/hod/activities/{act_id}/remarks",
        json={"remarks": "Laboratory attendance sheet verified."},
        headers=hod_headers,
    )
    assert res_rem.status_code == 200
    assert res_rem.get_json()["activity"]["hod_remarks"] == "Laboratory attendance sheet verified."

    # HOD views faculty profile
    res_prof = client.get(
        f"/api/hod/faculty/{sample_users['faculty'].id}/profile",
        headers=hod_headers,
    )
    assert res_prof.status_code == 200
    assert res_prof.get_json()["profile"]["employee_id"] == "FAC-CSE-888"


def test_admin_single_resource_get_endpoints(client, sample_users, auth_headers):
    admin_headers = auth_headers(sample_users["admin"].id)

    # 1. GET /api/admin/users/<id>
    res_user = client.get(
        f"/api/admin/users/{sample_users['faculty'].id}",
        headers=admin_headers,
    )
    assert res_user.status_code == 200
    assert res_user.get_json()["user"]["username"] == sample_users["faculty"].username

    # 2. GET /api/admin/departments/<id>
    res_dept = client.get(
        f"/api/admin/departments/{sample_users['cse'].id}",
        headers=admin_headers,
    )
    assert res_dept.status_code == 200
    assert res_dept.get_json()["department"]["code"] == "CSE"

    # 3. GET /api/admin/academic-years/<id>
    res_ay = client.get(
        f"/api/admin/academic-years/{sample_users['ay'].id}",
        headers=admin_headers,
    )
    assert res_ay.status_code == 200
    assert res_ay.get_json()["academic_year"]["year_label"] == "2023-2024"

    # 4. GET /api/admin/rules/<id>
    rule = APIScoringRule.query.first()
    res_rule = client.get(
        f"/api/admin/rules/{rule.id}",
        headers=admin_headers,
    )
    assert res_rule.status_code == 200
    assert res_rule.get_json()["rule"]["rule_code"] == rule.rule_code


def test_admin_category_crud(client, sample_users, auth_headers):
    admin_headers = auth_headers(sample_users["admin"].id)

    # Create category
    res_create = client.post(
        "/api/admin/categories",
        json={
            "category_code": "CATEGORY_IV",
            "name": "Institutional Governance and Leadership",
            "description": "Leadership positions and academic council contributions",
            "max_score_limit": 30.0,
            "min_score_required": 5.0,
        },
        headers=admin_headers,
    )
    assert res_create.status_code == 201
    cat_id = res_create.get_json()["category"]["id"]

    # Get single category
    res_get = client.get(f"/api/admin/categories/{cat_id}", headers=admin_headers)
    assert res_get.status_code == 200
    assert res_get.get_json()["category"]["category_code"] == "CATEGORY_IV"

    # Delete category
    res_del = client.delete(f"/api/admin/categories/{cat_id}", headers=admin_headers)
    assert res_del.status_code == 200
    assert res_del.get_json()["success"] is True


def test_admin_reports_endpoints(client, sample_users, auth_headers):
    admin_headers = auth_headers(sample_users["admin"].id)

    # 1. Department performance report
    res_dept_perf = client.get(
        f"/api/admin/reports/department-performance?academic_year_id={sample_users['ay'].id}",
        headers=admin_headers,
    )
    assert res_dept_perf.status_code == 200
    data = res_dept_perf.get_json()
    assert data["success"] is True
    assert len(data["departments"]) >= 2
    cse_dept = next(d for d in data["departments"] if d["department_code"] == "CSE")
    assert "average_api_score" in cse_dept
    assert "total_faculty" in cse_dept

    # 2. Faculty scores report
    res_scores = client.get(
        f"/api/admin/reports/faculty-scores?academic_year_id={sample_users['ay'].id}",
        headers=admin_headers,
    )
    assert res_scores.status_code == 200
    scores_data = res_scores.get_json()
    assert scores_data["success"] is True
    assert len(scores_data["faculty_scores"]) >= 2
    assert "rank" in scores_data["faculty_scores"][0]


def test_resubmit_activity_resets_rejected_documents(client, sample_users, auth_headers):
    import io
    fac_headers = auth_headers(sample_users["faculty"].id)
    hod_headers = auth_headers(sample_users["hod"].id)

    # Create activity
    res_act = client.post(
        "/api/activities",
        json={
            "academic_year_id": sample_users["ay"].id,
            "category_id": sample_users["cat2"].id,
            "activity_type": "WORKSHOP_FDP",
            "title": "Cybersecurity Workshop",
            "activity_date": "2023-11-12",
            "duration_or_units": 1.0,
        },
        headers=fac_headers,
    )
    act_id = res_act.get_json()["activity"]["id"]

    # Upload document attached to activity
    file_data = {
        "file": (io.BytesIO(b"%PDF-1.5 Sample Certificate Content"), "cert.pdf"),
        "document_type": "workshop_certificate",
        "activity_id": act_id,
    }
    res_doc = client.post(
        "/api/documents/upload",
        data=file_data,
        content_type="multipart/form-data",
        headers=fac_headers,
    )
    assert res_doc.status_code == 201
    doc_id = res_doc.get_json()["document"]["id"]

    # Submit activity
    client.post(f"/api/activities/{act_id}/submit", headers=fac_headers)

    # HOD rejects activity with remarks
    res_reject = client.post(
        f"/api/hod/activities/{act_id}/verify",
        json={"action": "REJECTED", "remarks": "Certificate does not show dates."},
        headers=hod_headers,
    )
    assert res_reject.status_code == 200

    # Document should now be REJECTED
    doc_check1 = client.get(f"/api/documents/{doc_id}", headers=fac_headers).get_json()["document"]
    assert doc_check1["verification_status"] == "REJECTED"

    # Faculty edits and resubmits
    client.put(
        f"/api/activities/{act_id}",
        json={"title": "Cybersecurity 5-Day Workshop (Updated)"},
        headers=fac_headers,
    )
    res_resubmit = client.post(f"/api/activities/{act_id}/submit", headers=fac_headers)
    assert res_resubmit.status_code == 200

    # Attached document should be reset to PENDING
    doc_check2 = client.get(f"/api/documents/{doc_id}", headers=fac_headers).get_json()["document"]
    assert doc_check2["verification_status"] == "PENDING"


def test_experience_filtering_and_profile_summary(client, sample_users, auth_headers):
    fac_headers = auth_headers(sample_users["faculty"].id)

    # 1. Create profile
    client.post(
        "/api/faculty/profile",
        json={
            "employee_id": "EXP-CSE-999",
            "department_id": sample_users["cse"].id,
            "designation": "Assistant Professor",
            "first_name": "Kavita",
            "last_name": "Patil",
            "date_of_joining": "2020-06-01",
            "contact_number": "9123456789",
        },
        headers=fac_headers,
    )

    # 2. Add teaching experience
    client.post(
        "/api/faculty/experience",
        json={
            "organization": "National Engineering College",
            "designation": "Lecturer",
            "experience_type": "teaching",
            "from_date": "2016-01-01",
            "to_date": "2019-12-31",
            "is_current": False,
            "description": "Undergraduate teaching",
        },
        headers=fac_headers,
    )

    # 3. Add research experience
    client.post(
        "/api/faculty/experience",
        json={
            "organization": "CSIR Research Institute",
            "designation": "Research Associate",
            "experience_type": "research",
            "from_date": "2014-01-01",
            "to_date": "2015-12-31",
            "is_current": False,
            "description": "Sponsored research",
        },
        headers=fac_headers,
    )

    # 4. Filter by experience_type
    res_teach = client.get("/api/faculty/experience?type=teaching", headers=fac_headers)
    assert res_teach.status_code == 200
    assert res_teach.get_json()["count"] == 1
    assert res_teach.get_json()["experiences"][0]["experience_type"] == "teaching"

    res_res = client.get("/api/faculty/experience?type=research", headers=fac_headers)
    assert res_res.status_code == 200
    assert res_res.get_json()["count"] == 1
    assert res_res.get_json()["experiences"][0]["experience_type"] == "research"

    # 5. Check profile experience summary
    res_prof = client.get("/api/faculty/profile", headers=fac_headers)
    assert res_prof.status_code == 200
    summary = res_prof.get_json()["profile"]["experience_summary"]
    assert summary["teaching_experience_years"] >= 3.9
    assert summary["research_experience_years"] >= 1.9
    assert summary["total_experience_years"] >= 5.8
