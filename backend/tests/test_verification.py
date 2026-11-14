import pytest


def test_hod_approval_workflow(client, sample_users, auth_headers):
    fac_headers = auth_headers(sample_users['faculty'].id)
    hod_headers = auth_headers(sample_users['hod'].id)

    # 1. Faculty creates activity
    res_create = client.post('/api/activities', json={
        'academic_year_id': sample_users['ay'].id,
        'category_id': sample_users['cat1'].id,
        'activity_type': 'LECTURES_TEACHING',
        'title': 'Compiler Design Lecture Hours',
        'activity_date': '2023-09-15',
        'duration_or_units': 30.0
    }, headers=fac_headers)
    act_id = res_create.get_json()['activity']['id']

    # 2. Faculty submits activity
    client.post(f'/api/activities/{act_id}/submit', headers=fac_headers)

    # 3. HOD views pending activities
    res_pending = client.get('/api/hod/activities/pending', headers=hod_headers)
    assert res_pending.status_code == 200
    pending_ids = [a['id'] for a in res_pending.get_json()['activities']]
    assert act_id in pending_ids

    # 4. HOD approves the activity
    res_verify = client.post(f'/api/hod/activities/{act_id}/verify', json={
        'action': 'APPROVED',
        'remarks': 'Verified against departmental logbook.'
    }, headers=hod_headers)
    assert res_verify.status_code == 200
    assert res_verify.get_json()['activity']['status'] == 'APPROVED'


def test_hod_department_isolation(client, sample_users, auth_headers):
    # ECE faculty creates and submits activity
    ece_fac_headers = auth_headers(sample_users['faculty_ece'].id)
    res_create = client.post('/api/activities', json={
        'academic_year_id': sample_users['ay'].id,
        'category_id': sample_users['cat2'].id,
        'activity_type': 'WORKSHOP_FDP',
        'title': 'VLSI Design Workshop',
        'activity_date': '2023-11-01',
        'duration_or_units': 1.0
    }, headers=ece_fac_headers)
    act_id = res_create.get_json()['activity']['id']
    client.post(f'/api/activities/{act_id}/submit', headers=ece_fac_headers)

    # CSE HOD attempts to verify ECE faculty activity -> MUST BE FORBIDDEN (400 or 403)
    cse_hod_headers = auth_headers(sample_users['hod'].id)
    res_verify = client.post(f'/api/hod/activities/{act_id}/verify', json={
        'action': 'APPROVED',
        'remarks': 'Cross dept approval attempt'
    }, headers=cse_hod_headers)
    assert res_verify.status_code in [400, 403]
    assert res_verify.get_json()['success'] is False


def test_hod_reject_requires_remarks(client, sample_users, auth_headers):
    fac_headers = auth_headers(sample_users['faculty'].id)
    hod_headers = auth_headers(sample_users['hod'].id)

    res_create = client.post('/api/activities', json={
        'academic_year_id': sample_users['ay'].id,
        'category_id': sample_users['cat1'].id,
        'activity_type': 'LECTURES_TEACHING',
        'title': 'Mentoring Session',
        'activity_date': '2023-10-01',
        'duration_or_units': 5.0
    }, headers=fac_headers)
    act_id = res_create.get_json()['activity']['id']
    client.post(f'/api/activities/{act_id}/submit', headers=fac_headers)

    # Reject without remarks -> should fail with 400
    res_reject = client.post(f'/api/hod/activities/{act_id}/verify', json={
        'action': 'REJECTED',
        'remarks': ''
    }, headers=hod_headers)
    assert res_reject.status_code == 400
    assert 'Remarks are mandatory' in res_reject.get_json()['message']

    # Reject with remarks -> should succeed
    res_reject_ok = client.post(f'/api/hod/activities/{act_id}/verify', json={
        'action': 'REJECTED',
        'remarks': 'Attendance sheets not attached.'
    }, headers=hod_headers)
    assert res_reject_ok.status_code == 200
    assert res_reject_ok.get_json()['activity']['status'] == 'REJECTED'
