"""Administrator configuration and management tests."""

from datetime import date


def _admin_headers(auth_headers, sample_users):
    return auth_headers(sample_users['admin'].id)


def test_admin_department_and_year_management(client, sample_users, auth_headers):
    headers = _admin_headers(auth_headers, sample_users)

    created = client.post(
        '/api/admin/departments',
        json={'name': 'Civil Engineering', 'code': 'CIVIL'},
        headers=headers,
    )
    assert created.status_code == 201
    department = created.get_json()['department']

    duplicate = client.post(
        '/api/admin/departments',
        json={'name': 'Civil Engineering', 'code': 'CIVIL2'},
        headers=headers,
    )
    assert duplicate.status_code == 409

    year = client.post(
        '/api/admin/academic-years',
        json={
            'year_label': '2024-2025',
            'start_date': '2024-06-01',
            'end_date': '2025-05-31',
            'is_active': True,
        },
        headers=headers,
    )
    assert year.status_code == 201
    year_data = year.get_json()['academic_year']
    assert year_data['is_active'] is True

    # The previously active fixture year must have been deactivated.
    years = client.get('/api/admin/academic-years', headers=headers).get_json()
    active = [item for item in years['academic_years'] if item['is_active']]
    assert len(active) == 1

    deleted = client.delete(
        f"/api/admin/departments/{department['id']}", headers=headers
    )
    assert deleted.status_code == 200


def test_admin_creates_hod_and_deactivates_user(client, sample_users, auth_headers):
    headers = _admin_headers(auth_headers, sample_users)

    created = client.post(
        '/api/admin/users',
        json={
            'username': 'new_hod',
            'email': 'new.hod@test.edu',
            'password': 'Password123!',
            'role': 'hod',
            'department_id': sample_users['cse'].id,
        },
        headers=headers,
    )
    assert created.status_code == 201
    user_id = created.get_json()['user']['id']

    # HOD accounts require a department.
    missing_department = client.post(
        '/api/admin/users',
        json={
            'username': 'bad_hod',
            'email': 'bad.hod@test.edu',
            'password': 'Password123!',
            'role': 'hod',
        },
        headers=headers,
    )
    assert missing_department.status_code == 400

    deactivated = client.delete(f'/api/admin/users/{user_id}', headers=headers)
    assert deactivated.status_code == 200
    assert deactivated.get_json()['user']['is_active'] is False

    # The admin cannot deactivate the only active administrator.
    self_deactivate = client.delete(
        f"/api/admin/users/{sample_users['admin'].id}", headers=headers
    )
    assert self_deactivate.status_code == 400


def test_admin_configures_rules_and_category_limits(client, sample_users, auth_headers):
    headers = _admin_headers(auth_headers, sample_users)

    created = client.post(
        '/api/admin/rules',
        json={
            'category_id': sample_users['cat1'].id,
            'activity_type': 'INNOVATIVE_TEACHING',
            'rule_code': 'RULE_INNOVATION_V1',
            'description': 'Institution-approved innovation score',
            'base_score': 4.0,
            'max_score_per_activity': 12.0,
            'scoring_unit': 'per_unit',
            'rule_version': 'INSTITUTION-V1',
            'author_role_weights': {'sole author': 1.0, 'co-author': 0.5},
        },
        headers=headers,
    )
    assert created.status_code == 201
    rule = created.get_json()['rule']
    assert rule['base_score'] == 4.0
    assert rule['author_role_weights']['co-author'] == 0.5

    # Duplicate rule_code must be rejected.
    duplicate = client.post(
        '/api/admin/rules',
        json={
            'category_id': sample_users['cat1'].id,
            'activity_type': 'OTHER_TEACHING',
            'rule_code': 'RULE_INNOVATION_V1',
            'description': 'Duplicate code',
            'base_score': 1.0,
        },
        headers=headers,
    )
    assert duplicate.status_code == 409

    negative = client.post(
        '/api/admin/rules',
        json={
            'category_id': sample_users['cat1'].id,
            'activity_type': 'NEGATIVE_TEST',
            'rule_code': 'RULE_NEGATIVE',
            'description': 'Invalid negative score',
            'base_score': -5,
        },
        headers=headers,
    )
    assert negative.status_code == 400

    limits = client.put(
        f"/api/admin/categories/{sample_users['cat2'].id}",
        json={'max_score_limit': 40.0, 'min_score_required': 10.0},
        headers=headers,
    )
    assert limits.status_code == 200
    assert limits.get_json()['category']['max_score_limit'] == 40.0
    assert limits.get_json()['recalculation_required'] is True


def test_admin_settings_and_audit_log(client, sample_users, auth_headers):
    headers = _admin_headers(auth_headers, sample_users)

    saved = client.put(
        '/api/admin/settings',
        json={'settings': {'institution_name': 'Test College'}},
        headers=headers,
    )
    assert saved.status_code == 200
    assert saved.get_json()['settings'][0]['value'] == 'Test College'

    fetched = client.get('/api/admin/settings', headers=headers)
    assert fetched.status_code == 200
    assert fetched.get_json()['settings'][0]['key'] == 'institution_name'

    logs = client.get('/api/admin/audit-logs?limit=10', headers=headers)
    assert logs.status_code == 200
    actions = [entry['action'] for entry in logs.get_json()['audit_logs']]
    assert 'SETTINGS_UPDATED' in actions

    summary = client.get('/api/admin/system-summary', headers=headers)
    assert summary.status_code == 200
    assert summary.get_json()['metrics']['total_users'] >= 5


def test_admin_rule_update_marks_recalculation_required(
    client, sample_users, auth_headers
):
    headers = _admin_headers(auth_headers, sample_users)

    created = client.post(
        '/api/admin/rules',
        json={
            'category_id': sample_users['cat3'].id,
            'activity_type': 'BOOK_PUBLICATION',
            'rule_code': 'RULE_BOOK_V1',
            'description': 'Book publication score',
            'base_score': 10.0,
            'scoring_unit': 'per_book',
            'rule_version': 'INSTITUTION-V1',
        },
        headers=headers,
    )
    rule_id = created.get_json()['rule']['id']

    updated = client.put(
        f'/api/admin/rules/{rule_id}',
        json={'base_score': 12.5, 'rule_version': 'INSTITUTION-V2'},
        headers=headers,
    )
    assert updated.status_code == 200
    body = updated.get_json()
    assert body['recalculation_required'] is True
    assert body['rule']['base_score'] == 12.5
    assert body['rule']['rule_version'] == 'INSTITUTION-V2'

    deleted = client.delete(f'/api/admin/rules/{rule_id}', headers=headers)
    assert deleted.status_code == 200
