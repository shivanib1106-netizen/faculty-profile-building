import pytest
from app.services.api_calculation import APICalculationEngine
from app.models.activity import AcademicActivity


def test_api_calculation_engine_and_caps(client, sample_users, auth_headers):
    fac_headers = auth_headers(sample_users['faculty'].id)
    hod_headers = auth_headers(sample_users['hod'].id)

    # Activity 1: Category I (100 hours -> capped by single activity cap of 50.0)
    res1 = client.post('/api/activities', json={
        'academic_year_id': sample_users['ay'].id,
        'category_id': sample_users['cat1'].id,
        'activity_type': 'LECTURES_TEACHING',
        'title': 'Lecture Course 1',
        'activity_date': '2023-08-01',
        'duration_or_units': 100.0  # rule cap is 50.0
    }, headers=fac_headers)
    act1_id = res1.get_json()['activity']['id']

    # Activity 2: Category I (50 hours -> 50.0 raw)
    res2 = client.post('/api/activities', json={
        'academic_year_id': sample_users['ay'].id,
        'category_id': sample_users['cat1'].id,
        'activity_type': 'LECTURES_TEACHING',
        'title': 'Lecture Course 2',
        'activity_date': '2023-09-01',
        'duration_or_units': 50.0
    }, headers=fac_headers)
    act2_id = res2.get_json()['activity']['id']

    # Activity 3: Category III Research Paper (25.0 points)
    res3 = client.post('/api/activities', json={
        'academic_year_id': sample_users['ay'].id,
        'category_id': sample_users['cat3'].id,
        'activity_type': 'RESEARCH_PAPER_JOURNAL',
        'title': 'Neural Network Paper',
        'activity_date': '2023-10-01',
        'duration_or_units': 1.0,
        'co_author_role': 'First Author'  # 70% of 25 = 17.5
    }, headers=fac_headers)
    act3_id = res3.get_json()['activity']['id']

    # Submit and Approve act1 and act3; leave act2 as DRAFT
    client.post(f'/api/activities/{act1_id}/submit', headers=fac_headers)
    client.post(f'/api/hod/activities/{act1_id}/verify', json={'action': 'APPROVED'}, headers=hod_headers)

    client.post(f'/api/activities/{act3_id}/submit', headers=fac_headers)
    client.post(f'/api/hod/activities/{act3_id}/verify', json={'action': 'APPROVED'}, headers=hod_headers)

    # 1. Official calculation ('VERIFIED_ONLY')
    res_calc = client.post('/api/calculations/calculate', json={
        'academic_year_id': sample_users['ay'].id,
        'calculation_type': 'VERIFIED_ONLY'
    }, headers=fac_headers)
    assert res_calc.status_code == 200
    calc_data = res_calc.get_json()['calculation']

    # Cat 1: act1 has 50.0 approved, act2 is draft (0 eligible). Total cat1 = 50.0
    assert calc_data['categories']['category_1']['final'] == 50.0

    # Cat 3: act3 has 17.5 (first author 70% of 25)
    assert calc_data['categories']['category_3']['final'] == 17.5

    # Total verified score = 50.0 + 17.5 = 67.5
    assert calc_data['total_final_score'] == 67.5

    # 2. Check history was recorded
    res_hist = client.get(f"/api/calculations/history?academic_year_id={sample_users['ay'].id}", headers=fac_headers)
    assert res_hist.status_code == 200
    assert res_hist.get_json()['count'] >= 1


def test_category_cap_enforcement(client, sample_users, auth_headers):
    """
    Test that when eligible sum exceeds category cap (e.g. 80 for Cat 1),
    the final score is capped strictly at 80.
    """
    fac_headers = auth_headers(sample_users['faculty'].id)
    hod_headers = auth_headers(sample_users['hod'].id)

    # Create two approved Cat 1 activities: 50.0 + 50.0 = 100.0 eligible
    for i in range(2):
        r = client.post('/api/activities', json={
            'academic_year_id': sample_users['ay'].id,
            'category_id': sample_users['cat1'].id,
            'activity_type': 'LECTURES_TEACHING',
            'title': f'Course {i+1}',
            'activity_date': f'2023-08-0{i+1}',
            'duration_or_units': 50.0
        }, headers=fac_headers)
        aid = r.get_json()['activity']['id']
        client.post(f'/api/activities/{aid}/submit', headers=fac_headers)
        client.post(f'/api/hod/activities/{aid}/verify', json={'action': 'APPROVED'}, headers=hod_headers)

    res_calc = client.post('/api/calculations/calculate', json={
        'academic_year_id': sample_users['ay'].id,
        'calculation_type': 'VERIFIED_ONLY'
    }, headers=fac_headers)
    calc_data = res_calc.get_json()['calculation']

    # Raw: 100, Eligible: 100, Capped Final: 80.0 (Cat 1 max limit is 80.0)
    assert calc_data['categories']['category_1']['eligible'] == 100.0
    assert calc_data['categories']['category_1']['final'] == 80.0
    assert calc_data['categories']['category_1']['cap_applied'] == 80.0
    assert calc_data['total_final_score'] == 80.0


def test_recalculation_supersedes_previous_official_history(
    client, sample_users, auth_headers
):
    fac_headers = auth_headers(sample_users['faculty'].id)
    hod_headers = auth_headers(sample_users['hod'].id)

    created = client.post('/api/activities', json={
        'academic_year_id': sample_users['ay'].id,
        'category_id': sample_users['cat2'].id,
        'activity_type': 'WORKSHOP_FDP',
        'title': 'Outcome Based Education Workshop',
        'activity_date': '2023-12-05',
        'duration_or_units': 1.0
    }, headers=fac_headers)
    activity_id = created.get_json()['activity']['id']
    client.post(f'/api/activities/{activity_id}/submit', headers=fac_headers)
    client.post(
        f'/api/hod/activities/{activity_id}/verify',
        json={'action': 'APPROVED', 'remarks': 'Certificate verified.'},
        headers=hod_headers,
    )

    first = client.post('/api/calculations/calculate', json={
        'academic_year_id': sample_users['ay'].id,
        'calculation_type': 'VERIFIED_ONLY'
    }, headers=fac_headers)
    assert first.status_code == 200
    first_history_id = first.get_json()['calculation']['calculation_history_id']
    assert first.get_json()['calculation']['rule_version'] != 'UNCONFIGURED'

    second = client.post('/api/calculations/calculate', json={
        'academic_year_id': sample_users['ay'].id,
        'calculation_type': 'VERIFIED_ONLY'
    }, headers=fac_headers)
    assert second.status_code == 200
    second_history_id = second.get_json()['calculation']['calculation_history_id']
    assert second_history_id != first_history_id

    old = client.get(
        f'/api/calculations/history/{first_history_id}', headers=fac_headers
    )
    assert old.status_code == 200
    assert old.get_json()['calculation']['status'] == 'SUPERSEDED'

    latest = client.get(
        f"/api/calculations/latest?academic_year_id={sample_users['ay'].id}",
        headers=fac_headers,
    )
    assert latest.status_code == 200
    assert latest.get_json()['calculation']['id'] == second_history_id
    assert latest.get_json()['calculation']['status'] == 'OFFICIAL'


def test_provisional_calculation_includes_unverified_activity(
    client, sample_users, auth_headers
):
    fac_headers = auth_headers(sample_users['faculty'].id)

    client.post('/api/activities', json={
        'academic_year_id': sample_users['ay'].id,
        'category_id': sample_users['cat3'].id,
        'activity_type': 'RESEARCH_PAPER_JOURNAL',
        'title': 'Draft Research Paper',
        'activity_date': '2023-10-10',
        'duration_or_units': 1.0,
        'co_author_role': 'Sole Author'
    }, headers=fac_headers)

    official = client.post('/api/calculations/calculate', json={
        'academic_year_id': sample_users['ay'].id,
        'calculation_type': 'VERIFIED_ONLY'
    }, headers=fac_headers).get_json()['calculation']
    assert official['total_final_score'] == 0.0
    assert official['calculation_type'] == 'VERIFIED_ONLY'

    provisional = client.post('/api/calculations/calculate', json={
        'academic_year_id': sample_users['ay'].id,
        'calculation_type': 'ALL_ACTIVITIES'
    }, headers=fac_headers).get_json()['calculation']
    assert provisional['total_final_score'] == 25.0
    assert provisional['calculation_type'] == 'ALL_ACTIVITIES'

    history = client.get(
        f"/api/calculations/history?status=PROVISIONAL", headers=fac_headers
    )
    assert history.status_code == 200
    assert history.get_json()['count'] == 1
