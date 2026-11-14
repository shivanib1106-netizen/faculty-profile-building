import pytest


def test_register_success(client, sample_users):
    payload = {
        'username': 'new_faculty',
        'email': 'new.faculty@test.edu',
        'password': 'SecurePassword123!',
        'role': 'faculty',
        'department_id': sample_users['cse'].id
    }
    response = client.post('/api/auth/register', json=payload)
    assert response.status_code == 201
    data = response.get_json()
    assert data['success'] is True
    assert 'access_token' in data
    assert data['user']['username'] == 'new_faculty'


def test_register_duplicate_username(client, sample_users):
    payload = {
        'username': 'fac_user',  # already exists
        'email': 'unique@test.edu',
        'password': 'Password123!',
        'role': 'faculty'
    }
    response = client.post('/api/auth/register', json=payload)
    assert response.status_code == 409
    assert response.get_json()['success'] is False


def test_register_invalid_email(client, sample_users):
    payload = {
        'username': 'user_bad_email',
        'email': 'not-an-email',
        'password': 'Password123!',
        'role': 'faculty'
    }
    response = client.post('/api/auth/register', json=payload)
    assert response.status_code == 400
    assert 'Invalid email format' in response.get_json()['message']


def test_login_success(client, sample_users):
    payload = {
        'username': 'fac_user',
        'password': 'FacPass123!'
    }
    response = client.post('/api/auth/login', json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert 'access_token' in data
    assert data['user']['role'] == 'faculty'


def test_login_invalid_password(client, sample_users):
    payload = {
        'username': 'fac_user',
        'password': 'WrongPassword!'
    }
    response = client.post('/api/auth/login', json=payload)
    assert response.status_code == 401
    assert response.get_json()['success'] is False


def test_get_current_user_authenticated(client, sample_users, auth_headers):
    headers = auth_headers(sample_users['faculty'].id)
    response = client.get('/api/auth/me', headers=headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['user']['username'] == 'fac_user'


def test_get_current_user_unauthorized(client):
    response = client.get('/api/auth/me')
    assert response.status_code == 401
