import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../components/Layout';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Icon from '../components/Icon';
import { documentApi } from '../api/documentApi';
import { triggerDownload } from '../api/apiClient';
import { useUploadConfig } from '../hooks/useReferenceData';

const DOCUMENT_CATEGORIES = [
  'Educational Qualification',
  'Work Experience',
  'Research Publication',
  'Workshop / FDP',
  'Teaching Material',
  'Patent / Project',
  'Other Academic Record',
];

const extensionOf = (name = '') => name.split('.').pop().toLowerCase();

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

export const Documents = () => {
  const { config, error: configError } = useUploadConfig();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(DOCUMENT_CATEGORIES[0]);
  const [file, setFile] = useState(null);
  const [formError, setFormError] = useState('');
  const [uploading, setUploading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const fileInputRef = useRef(null);

  const allowedTypes = config?.allowedFileTypes || [];
  const maxSizeMb = config?.maxUploadSizeMb || 0;
  const acceptAttribute = allowedTypes.length
    ? allowedTypes.map((extension) => `.${extension}`).join(',')
    : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await documentApi.getDocuments();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load your documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return documents.filter((document) => {
      const matchesStatus = statusFilter === 'all' || document.status === statusFilter;
      const matchesSearch =
        !needle ||
        [document.title, document.fileName, document.category]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      return matchesStatus && matchesSearch;
    });
  }, [documents, search, statusFilter]);

  const resetUploadForm = () => {
    setTitle('');
    setCategory(DOCUMENT_CATEGORIES[0]);
    setFile(null);
    setFormError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openUpload = () => {
    resetUploadForm();
    setUploadOpen(true);
  };

  const validateFile = (selected) => {
    if (!selected) return 'Choose a file to upload.';
    if (allowedTypes.length && !allowedTypes.includes(extensionOf(selected.name))) {
      return `Unsupported file type. Allowed: ${allowedTypes.join(', ')}.`;
    }
    if (maxSizeMb && selected.size > maxSizeMb * 1024 * 1024) {
      return `The file is larger than the ${maxSizeMb} MB limit.`;
    }
    return '';
  };

  const handleFileChange = (selected) => {
    const validationError = validateFile(selected);
    setFormError(validationError);
    setFile(validationError ? null : selected);
    if (!selected) return;
    if (!title.trim()) setTitle(selected.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    setFormError('');
    const validationError = validateFile(file);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    if (!title.trim()) {
      setFormError('A document title is required.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('category', category);
      formData.append('file', file);
      const result = await documentApi.uploadDocument(formData);
      const created = result?.data;
      if (created) {
        setDocuments((previous) => [created, ...previous]);
      } else {
        await load();
      }
      setSuccess('Document uploaded successfully. Verification is pending.');
      setUploadOpen(false);
      resetUploadForm();
    } catch (err) {
      setFormError(err.message || 'The document could not be uploaded.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (document) => {
    setDownloadingId(document.id);
    setError('');
    try {
      const blob = await documentApi.downloadDocument(document.id);
      triggerDownload(blob, document.fileName || document.title || 'document');
    } catch (err) {
      setError(err.message || 'The document could not be downloaded.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await documentApi.deleteDocument(deleteTarget.id);
      setDocuments((previous) => previous.filter((document) => document.id !== deleteTarget.id));
      setSuccess('Document deleted.');
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message || 'The document could not be deleted.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout title="Document Vault">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1>Supporting Documents</h1>
          <p className="page-header-subtitle">
            Upload certificates and proofs that support your academic activity claims.
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={openUpload}>
            <Icon name="upload" size={15} /> Upload document
          </button>
        </div>
      </div>

      <ErrorMessage message={error} onRetry={load} />
      {success && (
        <div className="alert-box alert-box-success" role="status">
          <Icon name="checkCircle" size={16} /> {success}
        </div>
      )}

      <div className="info-strip">
        <div>
          <span className="info-strip-label">Accepted file types</span>
          <span>{allowedTypes.length ? allowedTypes.join(', ').toUpperCase() : 'Provided by server at upload'}</span>
        </div>
        <div>
          <span className="info-strip-label">Maximum size</span>
          <span>{maxSizeMb ? `${maxSizeMb} MB per file` : 'Provided by server at upload'}</span>
        </div>
        <div>
          <span className="info-strip-label">Access</span>
          <span>Documents are served through authenticated API downloads</span>
        </div>
      </div>
      {configError && (
        <div className="alert-box alert-box-warning" role="status">
          <Icon name="alert" size={16} /> {configError} The server will still validate your file.
        </div>
      )}

      <div className="table-filter-bar">
        <div className="filter-inputs-group">
          <div className="search-input-wrapper">
            <span className="search-icon"><Icon name="search" size={15} /></span>
            <input
              type="search"
              className="form-control"
              placeholder="Search documents"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter documents by verification status"
          >
            <option value="all">All statuses</option>
            <option value="Verified">Verified</option>
            <option value="Pending">Pending</option>
            <option value="Rejected">Rejected</option>
          </select>
          <span className="filter-result-count">{filtered.length} document(s)</span>
        </div>
      </div>

      {loading ? (
        <Loading message="Loading your documents..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="folder"
          title="No documents to show"
          description="Upload degree certificates, publication proofs or experience letters to support your profile."
          action={
            <button type="button" className="btn btn-primary" onClick={openUpload}>
              <Icon name="upload" size={15} /> Upload your first document
            </button>
          }
        />
      ) : (
        <div className="academic-card">
          <div className="table-responsive">
            <table className="academic-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Category</th>
                  <th>File</th>
                  <th>Uploaded</th>
                  <th>Verification</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((document) => (
                  <tr key={document.id}>
                    <td>
                      <div className="table-cell-title">{document.title}</div>
                      <div className="table-cell-subtext">{document.fileType || 'File'}</div>
                    </td>
                    <td>{document.category || '—'}</td>
                    <td>
                      <div className="table-cell-title">{document.fileName}</div>
                      <div className="table-cell-subtext">{document.fileSize || '—'}</div>
                    </td>
                    <td>{formatDate(document.uploadDate)}</td>
                    <td><StatusBadge status={document.status} /></td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="table-btn"
                          onClick={() => handleDownload(document)}
                          disabled={downloadingId === document.id}
                        >
                          <Icon name="download" size={14} />{' '}
                          {downloadingId === document.id ? 'Downloading' : 'Download'}
                        </button>
                        <button
                          type="button"
                          className="table-btn table-btn-danger"
                          onClick={() => setDeleteTarget(document)}
                        >
                          <Icon name="trash" size={14} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={uploadOpen}
        onClose={() => (uploading ? null : setUploadOpen(false))}
        title="Upload Supporting Document"
      >
        <form onSubmit={handleUpload} noValidate>
          {formError && <ErrorMessage message={formError} />}

          <div className="form-group">
            <label className="form-label required" htmlFor="document-title">Document title</label>
            <input
              id="document-title"
              type="text"
              className="form-control"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. IEEE publication acceptance letter"
              disabled={uploading}
            />
          </div>

          <div className="form-group">
            <label className="form-label required" htmlFor="document-category">Category</label>
            <select
              id="document-category"
              className="form-control"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              disabled={uploading}
            >
              {DOCUMENT_CATEGORIES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label required" htmlFor="document-file">File</label>
            <label
              className={`upload-dropzone ${file ? 'has-file' : ''}`}
              htmlFor="document-file"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleFileChange(event.dataTransfer.files?.[0] || null);
              }}
            >
              <Icon name="upload" size={26} />
              <span className="upload-dropzone-title">
                {file ? file.name : 'Choose a file or drag it here'}
              </span>
              <span className="upload-dropzone-hint">
                {allowedTypes.length
                  ? `${allowedTypes.join(', ').toUpperCase()} up to ${maxSizeMb} MB`
                  : 'The server will validate the file type and size'}
              </span>
              <input
                ref={fileInputRef}
                id="document-file"
                type="file"
                className="upload-file-input"
                accept={acceptAttribute}
                onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
                disabled={uploading}
              />
            </label>
          </div>

          {uploading && (
            <div className="upload-progress" role="status" aria-live="polite">
              <div className="upload-progress-bar"></div>
              <span>Uploading to the server...</span>
            </div>
          )}

          <div className="modal-inline-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setUploadOpen(false)}
              disabled={uploading}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload document'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete document?"
        message={`"${deleteTarget?.title || 'This document'}" will be permanently removed. Activities that reference it may need a replacement proof.`}
        confirmText="Delete document"
        confirmVariant="danger"
        isLoading={deleting}
      />
    </Layout>
  );
};

export default Documents;
