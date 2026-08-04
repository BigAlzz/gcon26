import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DOCUMENT_BYTES, sha256, validateChecksum, validateDocumentMetadata, validateUploadedContent } from './upload-policy.mjs';

test('accepts approved document metadata and records a SHA-256 checksum', () => {
  const body = validateDocumentMetadata({ contentType: 'application/pdf', size: 4 });
  const content = Buffer.from('test');
  const uploaded = validateUploadedContent({ ...body }, body.contentType, content);
  assert.equal(uploaded.checksum, sha256(content));
  assert.equal(uploaded.contentType, 'application/pdf');
});

test('rejects unsupported types, oversized documents, and declared-size mismatches', () => {
  assert.throws(() => validateDocumentMetadata({ contentType: 'text/plain', size: 4 }), (error) => error.status === 400);
  assert.throws(() => validateDocumentMetadata({ contentType: 'image/png', size: MAX_DOCUMENT_BYTES + 1 }), (error) => error.status === 400);
  assert.throws(() => validateUploadedContent({ contentType: 'image/png', size: 5 }, 'image/png', Buffer.from('test')), (error) => error.status === 400);
});

test('rejects a checksum that does not match the uploaded content', () => {
  const actual = sha256(Buffer.from('valid'));
  validateChecksum(actual, actual);
  assert.throws(() => validateChecksum('a'.repeat(64), actual), (error) => error.status === 409);
  assert.throws(() => validateChecksum(undefined, undefined), (error) => error.status === 409);
});
