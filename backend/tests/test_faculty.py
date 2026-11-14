import pytest


def test_create_and_view_faculty_profile(client, sample_users, auth_headers):
    headers = auth_headers(sample_users['faculty'].id)

    profile_payload = {
        'employee_id': 'EMP-CSE-001',
        'department_id': sample_users['cse'].id,
        'designation': 'Assistant Professor',
        'first_name': 'Anita',
        'last_name': 'Deshmukh',
        'date_of_birth': '1988-05-20',
        'gender': 'Female',
        'date_of_joining': '2019-08-01',
        'contact_number': '+91-9988776655',
        'alternate_email': 'anita.alt@example.com',
        'research_interests': 'Data Mining, Big Data',
        'subjects_handled': 'Data Warehousing, Python Programming'
    }

    # 1. Create Profile
    res = client.post('/api/faculty/profile', json=profile_payload, headers=headers)
    assert res.status_code == 201
    data = res.get_json()
    assert data['success'] is True
    assert data['profile']['employee_id'] == 'EMP-CSE-001'

    # 2. View Own Profile
    res_get = client.get('/api/faculty/profile', headers=headers)
    assert res_get.status_code == 200
    assert res_get.get_json()['profile']['first_name'] == 'Anita'

    # 3. HOD of same department can view
    hod_headers = auth_headers(sample_users['hod'].id)
    res_hod = client.get(f"/api/faculty/profile?faculty_id={sample_users['faculty'].id}", headers=hod_headers)
    assert res_hod.status_code == 200

    # 4. HOD of other department is FORBIDDEN
    hod_ece_headers = auth_headers(sample_users['hod_ece'].id)
    res_hod_ece = client.get(f"/api/faculty/profile?faculty_id={sample_users['faculty'].id}", headers=hod_ece_headers)
    assert res_hod_ece.status_code == 403


def test_update_profile(client, sample_users, auth_headers):
    headers = auth_headers(sample_users['faculty'].id)
    # First create profile
    client.post('/api/faculty/profile', json={
        'employee_id': 'EMP-002',
        'department_id': sample_users['cse'].id,
        'designation': 'Lecturer',
        'first_name': 'Test',
        'last_name': 'User',
        'date_of_joining': '2020-01-01',
        'contact_number': '1234567890'
    }, headers=headers)

    # Update designation and phone
    res_update = client.put('/api/faculty/profile', json={
        'designation': 'Assistant Professor (Senior Scale)',
        'contact_number': '9876543210'
    }, headers=headers)
    assert res_update.status_code == 200
    updated_data = res_update.get_json()['profile']
    assert updated_data['designation'] == 'Assistant Professor (Senior Scale)'
    assert updated_data['contact_number'] == '9876543210'


def test_qualifications_crud(client, sample_users, auth_headers):
    headers = auth_headers(sample_users['faculty'].id)
    # Profile creation
    client.post('/api/faculty/profile', json={
        'employee_id': 'EMP-003',
        'department_id': sample_users['cse'].id,
        'designation': 'Assistant Professor',
        'first_name': 'Vikram',
        'last_name': 'Singh',
        'date_of_joining': '2018-06-01',
        'contact_number': '9123456780'
    }, headers=headers)

    # Add qualification
    q_payload = {
        'degree': 'Ph.D.',
        'specialization': 'Computer Engineering',
        'institution': 'IIT Bombay',
        'board_university': 'IIT Bombay',
        'year_of_passing': 2017,
        'percentage_or_cgpa': '9.5 CGPA'
    }
    res_add = client.post('/api/faculty/qualifications', json=q_payload, headers=headers)
    assert res_add.status_code == 201
    qual_id = res_add.get_json()['qualification']['id']

    # List qualifications
    res_list = client.get('/api/faculty/qualifications', headers=headers)
    assert res_list.status_code == 200
    assert len(res_list.get_json()['qualifications']) == 1

    # Delete qualification
    res_del = client.delete(f'/api/faculty/qualifications/{qual_id}', headers=headers)
    assert res_del.status_code == 200
    assert client.get('/api/faculty/qualifications', headers=headers).get_json()['qualifications'] == []


def test_experience_crud(client, sample_users, auth_headers):
    headers = auth_headers(sample_users['faculty'].id)
    # Profile
    client.post('/api/faculty/profile', json={
        'employee_id': 'EMP-004',
        'department_id': sample_users['cse'].id,
        'designation': 'Assistant Professor',
        'first_name': 'Meera',
        'last_name': 'Nair',
        'date_of_joining': '2021-07-01',
        'contact_number': '9876500000'
    }, headers=headers)

    # Add experience
    exp_payload = {
        'organization': 'Apex Software Tech',
        'designation': 'Software Engineer',
        'experience_type': 'industry',
        'from_date': '2019-01-01',
        'to_date': '2021-06-30',
        'is_current': False,
        'description': 'Backend Python developer'
    }
    res_add = client.post('/api/faculty/experience', json=exp_payload, headers=headers)
    assert res_add.status_code == 201
    exp_id = res_add.get_json()['experience']['id']

    # List
    res_list = client.get('/api/faculty/experience', headers=headers)
    assert res_list.status_code == 200
    assert len(res_list.get_json()['experiences']) == 1

    # Delete
    res_del = client.delete(f'/api/faculty/experience/{exp_id}', headers=headers)
    assert res_del.status_code == 200
