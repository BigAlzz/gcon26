import crypto from 'node:crypto';

export const MAX_DOCUMENT_BYTES = 10_000_000;
export const ALLOWED_DOCUMENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

export function validateDocumentMetadata(body = {}) {
  const contentType = String(body.contentType || '').toLowerCase();
  const size = Number(body.size);
  if (!ALLOWED_DOCUMENT_TYPES.has(contentType)) throw Object.assign(new Error('Only PDF, JPG, and PNG documents are accepted'), { status: 400 });
  if (!Number.isInteger(size) || size < 1 || size > MAX_DOCUMENT_BYTES) throw Object.assign(new Error('Document size must be between 1 byte and 10 MB'), { status: 400 });
  return { contentType, size };
}

export function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function validateUploadedContent(document, contentType, content) {
  if (!content?.length || content.length > MAX_DOCUMENT_BYTES) throw Object.assign(new Error('Document size must be between 1 byte and 10 MB'), { status: 413 });
  if (document.size !== content.length) throw Object.assign(new Error('Uploaded content does not match the declared document size'), { status: 400 });
  const normalizedType = String(contentType || document.contentType || '').toLowerCase();
  if (!ALLOWED_DOCUMENT_TYPES.has(normalizedType)) throw Object.assign(new Error('Only PDF, JPG, and PNG documents are accepted'), { status: 400 });
  return { contentType: normalizedType, checksum: sha256(content) };
}

export function validateChecksum(expected, actual) {
  if (!actual) throw Object.assign(new Error('Document content has not been uploaded'), { status: 409 });
  if (expected && (!/^[a-f0-9]{64}$/.test(expected) || expected !== actual)) throw Object.assign(new Error('Document checksum does not match uploaded content'), { status: 409 });
}
