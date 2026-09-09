import crypto from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import { createDemoApplicantPool, createInitialStore, DEFAULT_CYCLE_REQUIREMENTS, DEMO_CANDIDATE_CONTACTS, isReviewableApplication, ORG_GCON, ROLES } from './domain.mjs';
import { DEFAULT_CAMPUS_CAPACITIES } from '../shared/campusCapacity.mjs';

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

const SQLSERVER_PROVIDER_NAMES = new Set(['sqlserver', 'mssql', 'microsoft-sql-server']);
const SQLSERVER_STATE_ID = 'gcon-primary';

export function sqlServerConnectionString() {
  return String(process.env.MSSQL_CONNECTION_STRING || process.env.SQLSERVER_CONNECTION_STRING || '').trim();
}

export function sqlServerRequested() {
  const provider = String(process.env.GCON_DATABASE_PROVIDER || '').trim().toLowerCase();
  if (provider === 'local') return false;
  return SQLSERVER_PROVIDER_NAMES.has(provider) || Boolean(sqlServerConnectionString());
}

function seedDemoData() {
  if (String(process.env.GCON_SEED_DEMO_DATA || '').toLowerCase() === 'false') return false;
  return !sqlServerRequested();
}

function normalizeState(input, { includeDemoData = seedDemoData() } = {}) {
  let state = input;
  let needsSave = false;
  if (!state || Number(state.schemaVersion || 1) < 2 || !Array.isArray(state.users) || !Array.isArray(state.organisations)) {
    state = migrateLegacyState(state || {});
    needsSave = true;
  }
  state.schemaVersion = Math.max(2, Number(state.schemaVersion || 1));
  state.applications ||= [];
  for (const application of state.applications) {
    const demoContact = DEMO_CANDIDATE_CONTACTS[application.ref];
    const profile = application.profile || {};
    const contactMobile = application.contactMobile || application.mobile || profile.mobile || demoContact?.contactMobile;
    const contactEmail = application.contactEmail || application.email || profile.email || demoContact?.contactEmail;
    if (contactMobile && application.contactMobile !== contactMobile) { application.contactMobile = contactMobile; needsSave = true; }
    if (contactEmail && application.contactEmail !== contactEmail) { application.contactEmail = contactEmail; needsSave = true; }
  }
  state.referenceCounters ||= {};
  state.documents ||= [];
  state.reviewTasks ||= [];
  state.cycle ||= {};
  state.cycle.campusCapacities ||= { ...DEFAULT_CAMPUS_CAPACITIES };
  for (const [campus, capacity] of Object.entries(DEFAULT_CAMPUS_CAPACITIES)) state.cycle.campusCapacities[campus] ??= capacity;
  if (!state.cycle.requirements) { state.cycle.requirements = { ...DEFAULT_CYCLE_REQUIREMENTS }; needsSave = true; }
  if (!state.cycle.documentTypes) { state.cycle.documentTypes = ['Certified copy of ID', 'Statement of results / certificate']; needsSave = true; }
  state.notifications ||= [];
  state.applicantChats ||= {};
  state.communications ||= [];
  state.invitations ||= [];
  state.sessions ||= {};
  state.authUsers ||= {};
  const existingRefs = new Set(state.applications.map((application) => application.ref));
  const missingDemoApplicants = includeDemoData ? createDemoApplicantPool().filter((application) => !existingRefs.has(application.ref)) : [];
  if (missingDemoApplicants.length) {
    state.applications.push(...missingDemoApplicants);
    for (const application of missingDemoApplicants) {
      if (isReviewableApplication(application)) state.reviewTasks.push({ id: `review-${application.ref}`, ref: application.ref, assignedTo: 'user-reviewer', status: 'open' });
      for (const document of application.documents || []) state.documents.push({ ...document, ref: application.ref, ownerUserId: application.ownerUserId, organisationId: application.organisationId, objectKey: `applications/${application.ref}/${document.id}` });
    }
    needsSave = true;
  }
  return { state, needsSave };
}

async function ensureSqlServerSchema(pool) {
  await pool.request().batch(`
    IF SCHEMA_ID(N'gcon') IS NULL EXEC(N'CREATE SCHEMA [gcon] AUTHORIZATION [dbo]');
    IF OBJECT_ID(N'gcon.runtime_state', N'U') IS NULL
    BEGIN
      CREATE TABLE [gcon].[runtime_state] (
        [state_id] NVARCHAR(64) NOT NULL CONSTRAINT [PK_runtime_state] PRIMARY KEY,
        [schema_version] INT NOT NULL,
        [state_json] NVARCHAR(MAX) NOT NULL CONSTRAINT [CK_runtime_state_json] CHECK (ISJSON([state_json]) = 1),
        [row_version] BIGINT NOT NULL CONSTRAINT [DF_runtime_state_row_version] DEFAULT (1),
        [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_runtime_state_created_at] DEFAULT SYSUTCDATETIME(),
        [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_runtime_state_updated_at] DEFAULT SYSUTCDATETIME()
      );
    END;
    IF OBJECT_ID(N'gcon.document_blobs', N'U') IS NULL
    BEGIN
      CREATE TABLE [gcon].[document_blobs] (
        [document_id] NVARCHAR(160) NOT NULL CONSTRAINT [PK_document_blobs] PRIMARY KEY,
        [content] VARBINARY(MAX) NOT NULL,
        [content_type] NVARCHAR(200) NULL,
        [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_document_blobs_created_at] DEFAULT SYSUTCDATETIME(),
        [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_document_blobs_updated_at] DEFAULT SYSUTCDATETIME()
      );
    END;
  `);
}

function createSqlServerPool(connectionString) {
  const config = sql.ConnectionPool.parseConnectionString(connectionString);
  const encrypt = process.env.MSSQL_ENCRYPT === undefined ? (config.options.encrypt ?? true) : process.env.MSSQL_ENCRYPT !== 'false';
  const trustServerCertificate = process.env.MSSQL_TRUST_SERVER_CERTIFICATE === undefined ? (config.options.trustServerCertificate ?? false) : process.env.MSSQL_TRUST_SERVER_CERTIFICATE === 'true';
  config.options = {
    ...config.options,
    encrypt,
    trustServerCertificate,
    appName: process.env.MSSQL_APP_NAME || 'gcon-2027-api',
  };
  config.pool = { max: Number(process.env.MSSQL_POOL_MAX || 10), min: Number(process.env.MSSQL_POOL_MIN || 0), idleTimeoutMillis: 30_000 };
  config.requestTimeout = Number(process.env.MSSQL_REQUEST_TIMEOUT_MS || 30_000);
  config.connectionTimeout = Number(process.env.MSSQL_CONNECTION_TIMEOUT_MS || 15_000);
  return new sql.ConnectionPool(config);
}

export class SqlServerStore {
  constructor(connectionString = sqlServerConnectionString()) {
    if (!connectionString) throw new Error('MSSQL_CONNECTION_STRING is required when GCON_DATABASE_PROVIDER=sqlserver');
    this.connectionString = connectionString;
    this.pool = createSqlServerPool(connectionString);
    this.schemaReady = null;
    this.state = null;
    this.rowVersion = null;
  }

  async connect() {
    if (!this.pool.connected) await this.pool.connect();
    this.schemaReady ||= process.env.MSSQL_AUTO_MIGRATE === 'false' ? Promise.resolve() : ensureSqlServerSchema(this.pool);
    await this.schemaReady;
    return this.pool;
  }

  async load() {
    const pool = await this.connect();
    const result = await pool.request()
      .input('stateId', sql.NVarChar(64), SQLSERVER_STATE_ID)
      .query('SELECT [state_json], [row_version] FROM [gcon].[runtime_state] WHERE [state_id] = @stateId');
    if (!result.recordset.length) {
      const normalized = normalizeState(createInitialStore({ includeDemoData: seedDemoData() }), { includeDemoData: seedDemoData() });
      this.state = normalized.state;
      await this.insertState();
      return this.state;
    }
    const row = result.recordset[0];
    const normalized = normalizeState(JSON.parse(row.state_json));
    this.state = normalized.state;
    this.rowVersion = Number(row.row_version);
    if (normalized.needsSave) await this.save();
    return this.state;
  }

  async insertState(transaction = null) {
    const request = transaction ? new sql.Request(transaction) : this.pool.request();
    await request
      .input('stateId', sql.NVarChar(64), SQLSERVER_STATE_ID)
      .input('schemaVersion', sql.Int, Number(this.state.schemaVersion || 2))
      .input('stateJson', sql.NVarChar(sql.MAX), JSON.stringify(this.state))
      .query(`INSERT INTO [gcon].[runtime_state] ([state_id], [schema_version], [state_json], [row_version]) VALUES (@stateId, @schemaVersion, @stateJson, 1)`);
    this.rowVersion = 1;
  }

  async save(transaction = null) {
    if (!this.state) throw new Error('SQL Server store must be loaded before save');
    const request = transaction ? new sql.Request(transaction) : this.pool.request();
    const expectedVersion = Number(this.rowVersion || 1);
    const result = await request
      .input('stateId', sql.NVarChar(64), SQLSERVER_STATE_ID)
      .input('schemaVersion', sql.Int, Number(this.state.schemaVersion || 2))
      .input('stateJson', sql.NVarChar(sql.MAX), JSON.stringify(this.state))
      .input('expectedVersion', sql.BigInt, expectedVersion)
      .query(`UPDATE [gcon].[runtime_state]
        SET [schema_version] = @schemaVersion, [state_json] = @stateJson,
            [row_version] = [row_version] + 1, [updated_at] = SYSUTCDATETIME()
        WHERE [state_id] = @stateId AND [row_version] = @expectedVersion`);
    if (result.rowsAffected[0] !== 1) {
      const error = new Error('SQL Server state changed by another API instance; retry the request');
      error.status = 409;
      throw error;
    }
    this.rowVersion = expectedVersion + 1;
  }

  async transaction(callback) {
    const pool = await this.connect();
    const transaction = new sql.Transaction(pool);
    const previousState = this.state ? JSON.parse(JSON.stringify(this.state)) : null;
    const previousVersion = this.rowVersion;
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const request = new sql.Request(transaction).input('stateId', sql.NVarChar(64), SQLSERVER_STATE_ID);
      const result = await request.query('SELECT [state_json], [row_version] FROM [gcon].[runtime_state] WITH (UPDLOCK, HOLDLOCK) WHERE [state_id] = @stateId');
      if (!result.recordset.length) this.state = createInitialStore({ includeDemoData: seedDemoData() });
      else {
        this.state = normalizeState(JSON.parse(result.recordset[0].state_json)).state;
        this.rowVersion = Number(result.recordset[0].row_version);
      }
      const value = await callback(this.state);
      if (!result.recordset.length) await this.insertState(transaction);
      else await this.save(transaction);
      await transaction.commit();
      return value;
    } catch (error) {
      await transaction.rollback().catch(() => {});
      this.state = previousState;
      this.rowVersion = previousVersion;
      throw error;
    }
  }

  async saveDocument(id, buffer, contentType = 'application/octet-stream') {
    const pool = await this.connect();
    await pool.request()
      .input('documentId', sql.NVarChar(160), String(id))
      .input('content', sql.VarBinary(sql.MAX), buffer)
      .input('contentType', sql.NVarChar(200), String(contentType || 'application/octet-stream'))
      .query(`MERGE [gcon].[document_blobs] WITH (HOLDLOCK) AS target
        USING (SELECT @documentId AS [document_id]) AS source ON target.[document_id] = source.[document_id]
        WHEN MATCHED THEN UPDATE SET [content] = @content, [content_type] = @contentType, [updated_at] = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT ([document_id], [content], [content_type]) VALUES (@documentId, @content, @contentType);`);
    return { objectKey: `sqlserver/document_blobs/${String(id)}`, target: null };
  }

  async close() {
    if (this.pool.connected) await this.pool.close();
  }
}

export class LocalEncryptedStore {
  constructor() {
    this.state = null;
  }

  async load() {
    let needsSave = false;
    let loaded;
    try {
      loaded = decrypt(await readFile(dataFile, 'utf8'));
    } catch {
      loaded = createInitialStore();
      needsSave = true;
    }
    const normalized = normalizeState(loaded);
    this.state = normalized.state;
    needsSave ||= normalized.needsSave;
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
    ...(DEMO_CANDIDATE_CONTACTS[application.ref] || {}),
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

export function createConfiguredStore() {
  if (sqlServerRequested()) {
    const connectionString = sqlServerConnectionString();
    if (!connectionString) throw new Error('GCON_DATABASE_PROVIDER=sqlserver requires MSSQL_CONNECTION_STRING');
    return new SqlServerStore(connectionString);
  }
  return new LocalEncryptedStore();
}

export function providerStatus() {
  const sqlConfigured = sqlServerRequested() && Boolean(sqlServerConnectionString());
  const sqlRequestedWithoutConnection = sqlServerRequested() && !sqlServerConnectionString();
  return {
    mode: sqlConfigured ? 'sqlserver-adapter' : sqlRequestedWithoutConnection ? 'sqlserver-misconfigured' : 'local-development-adapter',
    database: sqlConfigured ? 'Microsoft SQL Server runtime_state adapter configured' : process.env.DATABASE_URL ? 'DATABASE_URL present; configure MSSQL_CONNECTION_STRING for SQL Server or activate another adapter' : 'encrypted local state; configure MSSQL_CONNECTION_STRING for production',
    objectStorage: sqlConfigured ? 'SQL Server document_blobs adapter (transitional; move bytes to private object storage before production)' : process.env.AZURE_STORAGE_CONNECTION_STRING ? 'Azure Blob connection present; Blob adapter still requires activation' : 'local document adapter; configure private object storage for production',
    secrets: process.env.AZURE_KEY_VAULT_URI ? 'Key Vault binding configured' : 'environment key fallback; configure AZURE_KEY_VAULT_URI for production',
  };
}

export function publicStoragePath() {
  return sqlServerRequested() ? null : dataFile;
}
