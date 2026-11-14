import pytest


def test_generate_pdf_report(client, sample_users, auth_headers):
    fac_headers = auth_headers(sample_users['faculty'].id)
    hod_headers = auth_headers(sample_users['hod'].id)

    # 1. Create Profile
    client.post('/api/faculty/profile', json={
        'employee_id': 'REP-CSE-101',
        'department_id': sample_users['cse'].id,
        'designation': 'Professor',
        'first_name': 'Suresh',
        'last_name': 'Verma',
        'date_of_joining': '2016-01-10',
        'contact_number': '9988112233'
    }, headers=fac_headers)

    # 2. Add an activity and approve it
    res_act = client.post('/api/activities', json={
        'academic_year_id': sample_users['ay'].id,
        'category_id': sample_users['cat3'].id,
        'activity_type': 'RESEARCH_PAPER_JOURNAL',
        'title': 'AI in Higher Education Governance',
        'activity_date': '2023-11-15',
        'duration_or_units': 1.0,
        'co_author_role': 'Sole Author'
    }, headers=fac_headers)
    act_id = res_act.get_json()['activity']['id']
    client.post(f'/api/activities/{act_id}/submit', headers=fac_headers)
    client.post(f'/api/hod/activities/{act_id}/verify', json={'action': 'APPROVED'}, headers=hod_headers)

    # 3. Request PDF report
    url = f"/api/calculations/report/pdf?academic_year_id={sample_users['ay'].id}"
    response = client.get(url, headers=fac_headers)

    assert response.status_code == 200
    assert response.headers['Content-Type'] == 'application/pdf'
    assert b'%PDF' in response.data[:10]  # Standard PDF binary header
    assert len(response.data) > 1000  # Non-trivial document size


def test_pdf_report_unauthorized(client, sample_users):
    # Request without token
    url = f"/api/calculations/report/pdf?academic_year_id={sample_users['ay'].id}"
    response = client.get(url)
    assert response.status_code == 401
