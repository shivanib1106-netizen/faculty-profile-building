import io
import pytest


def test_upload_and_download_document(client, sample_users, auth_headers):
    headers = auth_headers(sample_users['faculty'].id)

    # 1. Upload valid PDF
    data = {
        'file': (io.BytesIO(b"%PDF-1.4 Fake test PDF content"), 'certificate.pdf'),
        'document_type': 'certificate'
    }
    res = client.post(
        '/api/documents/upload',
        data=data,
        content_type='multipart/form-data',
        headers=headers
    )
    assert res.status_code == 201
    doc_id = res.get_json()['document']['id']
    assert res.get_json()['document']['original_filename'] == 'certificate.pdf'

    # 2. View details
    res_details = client.get(f'/api/documents/{doc_id}', headers=headers)
    assert res_details.status_code == 200
    assert res_details.get_json()['document']['document_type'] == 'certificate'

    # 3. Download document
    res_down = client.get(f'/api/documents/{doc_id}/download', headers=headers)
    assert res_down.status_code == 200
    assert b"%PDF-1.4" in res_down.data

    # 4. Another faculty (ECE) attempting to download is FORBIDDEN
    ece_headers = auth_headers(sample_users['faculty_ece'].id)
    res_unauth = client.get(f'/api/documents/{doc_id}/download', headers=ece_headers)
    assert res_unauth.status_code == 403


def test_upload_invalid_extension(client, sample_users, auth_headers):
    headers = auth_headers(sample_users['faculty'].id)
    data = {
        'file': (io.BytesIO(b"binary executable payload"), 'malicious.exe'),
        'document_type': 'general'
    }
    res = client.post(
        '/api/documents/upload',
        data=data,
        content_type='multipart/form-data',
        headers=headers
    )
    assert res.status_code == 400
    assert 'File type not allowed' in res.get_json()['message']
