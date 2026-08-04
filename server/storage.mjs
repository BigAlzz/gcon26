import crypto from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialStore, DEFAULT_CYCLE_REQUIREMENTS, ORG_GCON, ROLES } from './domain.mjs';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.join(rootDir, 'data');
const dataFile = path.join(dataDir, 'gcon-local-store.enc');
const documentsDir = path.join(dataDir, 'documents');
const key = crypto.scryptSync(process.env.GCON_LOCAL_ENCRYPTION_KEY || 'gcon-local-development-key-change-me', 'gcon-local-salt', 32);

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return JSON.stringify({ iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') });
}

function decrypt(payload) {
  const { iv, tag, ciphertext } = JSON.parse(payload);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8'));
}

export class LocalEncryptedStore {
  constructor() {
    this.state = null;
  }

  async load() {
    let needsSave = false;
    try {
      this.state = decrypt(await readFile(dataFile, 'utf8'));
    } catch {
      this.state = createInitialStore();
      await this.save();
    }
    if (Number(this.state.schemaVersion || 1) < 2 || !Array.isArray(this.state.users) || !Array.isArray(this.state.organisations)) {
      this.state = migrateLegacyState(this.state);
      await this.save();
    }
    this.state.schemaVersion = Math.max(2, Number(this.state.schemaVersion || 1));
    this.state.referenceCounters ||= {};
    this.state.documents ||= [];
    this.state.cycle ||= {};
    if (!this.state.cycle.requirements) { this.state.cycle.requirements = { ...DEFAULT_CYCLE_REQUIREMENTS }; needsSave = true; }
    if (!this.state.cycle.documentTypes) { this.state.cycle.documentTypes = ['Certified copy of ID', 'Statement of results / certificate']; needsSave = true; }
    this.state.notifications ||= [];
    this.state.applicantChats ||= {};
    this.state.communications ||= [];
    this.state.invitations ||= [];
    this.state.sessions ||= {};
    this.state.authUsers ||= {};
    if (needsSave) await this.save();
    return this.state;
  }

  async save() {
    await mkdir(dataDir, { recursive: true });
    await writeFile(dataFile, encrypt(this.state), 'utf8');
  }

  async transaction(callback) {
    const result = await callback(this.state);
    await this.save();
    return result;
  }

  async saveDocument(id, buffer) {
    await mkdir(documentsDir, { recursive: true });
    const safeName = `${id.replace(/[^a-zA-Z0-9_-]/g, '')}.bin`;
    const target = path.join(documentsDir, safeName);
    await writeFile(target, buffer);
    return { objectKey: `local/${safeName}`, target };
  }
}

function migrateLegacyState(legacy) {
  const migrated = createInitialStore();
  migrated.cycle = { ...migrated.cycle, ...(legacy.cycle || {}) };
  migrated.lettersIssued = Boolean(legacy.lettersIssued);
  const legacyApplications = Array.isArray(legacy.applications) ? legacy.applications : [];
  migrated.applications = legacyApplications.map((application, index) => ({
    ...application,
    ownerUserId: application.ownerUserId || (index === 0 ? 'user-learner-demo' : `user-applicant-${index + 1}`),
    organisationId: application.organisationId || ORG_GCON,
    releasedToOrganisationIds: application.releasedToOrganisationIds || (['Shortlisted', 'Placed'].includes(application.status) ? [ORG_GCON] : []),
    documents: Array.isArray(application.documents) ? application.documents : [],
  }));
  migrated.auditLog = Array.isArray(legacy.auditLog) ? legacy.auditLog.map((entry, index) => ({ id: entry.id || `legacy-audit-${index + 1}`, organisationId: ORG_GCON, actorUserId: entry.actorUserId || 'system', ...entry })) : migrated.auditLog;
  migrated.reviewTasks = migrated.applications.filter((application) => ['Under review', 'Correction requested'].includes(application.status)).map((application, index) => ({ id: `review-${index + 1}`, ref: application.ref, assignedTo: 'user-reviewer', status: application.status === 'Correction requested' ? 'correction_required' : 'open' }));
  migrated.documents = migrated.applications.flatMap((application) => (application.documents || []).map((document) => ({ ...document, ref: application.ref, ownerUserId: application.ownerUserId, organisationId: application.organisationId, objectKey: document.objectKey || `applications/${application.ref}/${document.id || `legacy-${crypto.randomUUID()}`}` })));
  return migrated;
}

export function providerStatus() {
  return {
    mode: 'local-development-adapter',
    database: process.env.DATABASE_URL ? 'DATABASE_URL present; PostgreSQL adapter still requires activation' : 'encrypted local state; configure DATABASE_URL for production',
    objectStorage: process.env.AZURE_STORAGE_CONNECTION_STRING ? 'Azure Blob connection present; Blob adapter still requires activation' : 'local document adapter; configure AZURE_STORAGE_CONNECTION_STRING for production',
    secrets: process.env.AZURE_KEY_VAULT_URI ? 'Key Vault binding configured' : 'environment key fallback; configure AZURE_KEY_VAULT_URI for production',
  };
}

export function publicStoragePath() {
  return dataFile;
}
