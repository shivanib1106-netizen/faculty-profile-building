"""Security-focused tests: token revocation, upload validation and RBAC."""

import io

from app.models.user import TokenBlocklist


def test_logout_revokes_access_token(client, sample_users, auth_headers):
    headers = auth_headers(sample_users['faculty'].id)

    assert client.get('/api/auth/me', headers=headers).status_code == 200

    logout = client.post('/api/auth/logout', headers=headers)
    assert logout.status_code == 200

    # The same token must now be rejected by the blocklist loader.
    reused = client.get('/api/auth/me', headers=headers)
    assert reused.status_code == 401
    assert 'revoked' in reused.get_json()['message'].lower()

    assert TokenBlocklist.query.count() == 1


def test_public_registration_cannot_create_admin(client):
    response = client.post(
        '/api/auth/register',
        json={
            'username': 'sneaky_admin',
            'email': 'sneaky@test.edu',
            'password': 'Password123!',
            'role': 'admin',
        },
    )
    assert response.status_code == 403
    assert response.get_json()['success'] is False


def test_faculty_cannot_use_admin_endpoints(client, sample_users, auth_headers):
    headers = auth_headers(sample_users['faculty'].id)
    assert client.get('/api/admin/users', headers=headers).status_code == 403
    assert client.get('/api/admin/rules', headers=headers).status_code == 403
    assert client.get('/api/admin/audit-logs', headers=headers).status_code == 403


def test_hod_cannot_use_admin_endpoints(client, sample_users, auth_headers):
    headers = auth_headers(sample_users['hod'].id)
    assert client.get('/api/admin/users', headers=headers).status_code == 403
    assert client.get('/api/admin/settings', headers=headers).status_code == 403


def test_faculty_cannot_view_another_profile(client, sample_users, auth_headers):
    headers = auth_headers(sample_users['faculty'].id)
    response = client.get(
        f"/api/faculty/profile?faculty_id={sample_users['faculty_ece'].id}",
        headers=headers,
    )
    assert response.status_code == 403


def test_hod_can_view_own_department_only(client, sample_users, auth_headers):
    headers = auth_headers(sample_users['hod'].id)
    own = client.get(
        f"/api/faculty/profile?faculty_id={sample_users['faculty'].id}", headers=headers
    )
    other = client.get(
        f"/api/faculty/profile?faculty_id={sample_users['faculty_ece'].id}",
        headers=headers,
    )
    # Neither profile exists yet, but department isolation is evaluated first.
    assert own.status_code == 404
    assert other.status_code == 403


def test_upload_rejects_content_mismatched_with_extension(
    client, sample_users, auth_headers
):
    headers = auth_headers(sample_users['faculty'].id)
    response = client.post(
        '/api/documents/upload',
        data={
            'file': (io.BytesIO(b"This is plain text, not a PDF"), 'fake.pdf'),
            'document_type': 'general',
        },
        content_type='multipart/form-data',
        headers=headers,
    )
    assert response.status_code == 400
    assert 'does not match' in response.get_json()['message']


def test_upload_requires_authentication(client):
    response = client.post(
        '/api/documents/upload',
        data={
            'file': (io.BytesIO(b"%PDF-1.4 content"), 'certificate.pdf'),
            'document_type': 'general',
        },
        content_type='multipart/form-data',
    )
    assert response.status_code == 401


def test_invalid_token_is_rejected(client):
    response = client.get(
        '/api/auth/me', headers={'Authorization': 'Bearer not-a-real-token'}
    )
    assert response.status_code == 401
    assert response.get_json()['success'] is False
