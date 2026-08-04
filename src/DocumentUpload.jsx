import React, { useState } from 'react';
import { uploadApiDocument } from './api.js?placement=1';

export function UploadableDocumentRow({ label, required, checked, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    const result = await uploadApiDocument({ type: label.toLowerCase().includes('id') ? 'identity' : 'results', label, file });
    if (result?.document) onChange();
    else setError('Upload could not be saved. Please try again.');
    setUploading(false);
    event.target.value = '';
  }

  return <label className={`document-row ${checked ? 'checked' : ''}`}>
    <input className="document-upload-input" type="file" accept="application/pdf,image/jpeg,image/png" onChange={handleFile} disabled={uploading} />
    <span className="doc-icon">{checked ? '✓' : '↑'}</span>
    <span><strong>{label}</strong><small>{required ? 'Required · PDF, JPG or PNG' : 'Optional'}</small>{error && <small className="document-upload-error">{error}</small>}</span>
    <b>{uploading ? 'Uploading…' : checked ? 'Uploaded' : 'Choose file'}</b>
  </label>;
}
