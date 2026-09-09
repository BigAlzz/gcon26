# Microsoft SQL Server adapter

## Configuration

Set these values at runtime; do not commit a real password or connection string:

```text
GCON_DATABASE_PROVIDER=sqlserver
MSSQL_CONNECTION_STRING=Server=...;Database=GCON;User Id=...;Password=...;Encrypt=True;TrustServerCertificate=False;
MSSQL_ENCRYPT=true
MSSQL_TRUST_SERVER_CERTIFICATE=false
MSSQL_AUTO_MIGRATE=false
```

`MSSQL_CONNECTION_STRING` or `SQLSERVER_CONNECTION_STRING` selects the adapter automatically. If `GCON_DATABASE_PROVIDER=sqlserver` is set without either connection string, the API fails fast instead of silently using the local file store.

## What is implemented

- `SqlServerStore` in `server/storage.mjs` uses the official `mssql` driver and a pooled SQL Server connection.
- Startup creates `gcon.runtime_state` and `gcon.document_blobs` idempotently. Approved deployments should apply the checked-in migrations first.
- The complete current domain state is stored as JSON in `gcon.runtime_state`. `row_version` is incremented on every save and prevents a stale API instance from overwriting a newer write.
- `transaction(callback)` uses a serializable transaction and `UPDLOCK/HOLDLOCK` for callers that need read-modify-write atomicity.
- Uploaded document bytes are written to `gcon.document_blobs` and the existing application state retains the object key and metadata.
- `providerStatus()` reports `sqlserver-adapter` only when the SQL Server connection is configured.
- SQL Server starts without presentation/demo seed records by default. Set `GCON_SEED_DEMO_DATA=true` only in an isolated demonstration database.

## Apply the migrations

1. Review and apply `database/gcon_sqlserver_schema.sql`.
2. Apply `database/002_sqlserver_runtime_adapter.sql`.
3. Create a least-privilege application login with access only to the approved `gcon` objects.
4. Inject `MSSQL_CONNECTION_STRING` through the approved secret manager.
5. Start the API and verify `GET /v1/health` reports `mode: sqlserver-adapter`.
6. Exercise a draft save, document upload, review action, and audit query in a non-production environment.

Set `MSSQL_AUTO_MIGRATE=false` in controlled environments after the migrations have been applied. The default startup DDL is intended for development and first-run provisioning only.

## Important boundary

This adapter is an operational bridge for the existing JSON-shaped domain. It does not claim that the normalized schema is fully wired to every route. Before production acceptance, sGov should migrate the domain writes to the approved relational tables, add database-level organisation and audit constraints, move document bytes to private object storage, and test backup/restore, retention, concurrency, and failure recovery.
