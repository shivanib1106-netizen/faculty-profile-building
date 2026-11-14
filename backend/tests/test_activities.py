import pytest


def test_create_activity(client, sample_users, auth_headers):
    headers = auth_headers(sample_users['faculty'].id)

    payload = {
        'academic_year_id': sample_users['ay'].id,
        'category_id': sample_users['cat1'].id,
        'activity_type': 'LECTURES_TEACHING',
        'title': 'Semester 1 - Advanced Database Systems',
        'description': '40 hours of lecture and lab classes',
        'activity_date': '2023-10-15',
        'duration_or_units': 40.0
    }
    res = client.post('/api/activities', json=payload, headers=headers)
    assert res.status_code == 201
    data = res.get_json()
    assert data['success'] is True
    assert data['activity']['status'] == 'DRAFT'
    # 40 hours * 1.0 = 40.0 raw score
    assert data['activity']['raw_score'] == 40.0
    assert data['activity']['eligible_score'] == 0.0  # Draft has 0 eligible score initially


def test_list_and_filter_activities(client, sample_users, auth_headers):
    headers = auth_headers(sample_users['faculty'].id)

    # Create two activities
    client.post('/api/activities', json={
        'academic_year_id': sample_users['ay'].id,
        'category_id': sample_users['cat1'].id,
        'activity_type': 'LECTURES_TEACHING',
        'title': 'Operating Systems Lecture',
        'activity_date': '2023-09-01',
        'duration_or_units': 20.0
    }, headers=headers)

    client.post('/api/activities', json={
        'academic_year_id': sample_users['ay'].id,
        'category_id': sample_users['cat2'].id,
        'activity_type': 'WORKSHOP_FDP',
        'title': 'AICTE One-Week FDP on Deep Learning',
        'activity_date': '2023-11-20',
        'duration_or_units': 1.0
    }, headers=headers)

    # Filter by Cat 1
    res_cat1 = client.get(f"/api/activities?category_id={sample_users['cat1'].id}", headers=headers)
    assert res_cat1.status_code == 200
    assert res_cat1.get_json()['count'] == 1

    # Filter by Cat 2
    res_cat2 = client.get(f"/api/activities?category_id={sample_users['cat2'].id}", headers=headers)
    assert res_cat2.status_code == 200
    assert res_cat2.get_json()['count'] == 1


def test_update_and_submit_activity(client, sample_users, auth_headers):
    headers = auth_headers(sample_users['faculty'].id)

    res_create = client.post('/api/activities', json={
        'academic_year_id': sample_users['ay'].id,
        'category_id': sample_users['cat3'].id,
        'activity_type': 'RESEARCH_PAPER_JOURNAL',
        'title': 'Optimized Cloud Scheduling',
        'activity_date': '2023-12-05',
        'duration_or_units': 1.0,
        'co_author_role': 'Sole Author'
    }, headers=headers)
    act_id = res_create.get_json()['activity']['id']

    # Update title
    res_update = client.put(f'/api/activities/{act_id}', json={
        'title': 'Optimized Cloud Scheduling with Edge Computing'
    }, headers=headers)
    assert res_update.status_code == 200
    assert res_update.get_json()['activity']['title'] == 'Optimized Cloud Scheduling with Edge Computing'

    # Submit for verification
    res_submit = client.post(f'/api/activities/{act_id}/submit', headers=headers)
    assert res_submit.status_code == 200
    assert res_submit.get_json()['activity']['status'] == 'SUBMITTED'
