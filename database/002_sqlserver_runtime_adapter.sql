/*
  GCON 2027 SQL Server runtime adapter

  This migration supports the current domain implementation without changing
  its route-level state contract. The API serialises the complete state object
  into one JSON row and uses row_version for optimistic concurrency. It is a
  transitional adapter: the reviewed relational tables in
  gcon_sqlserver_schema.sql remain the target for a future fully normalised
  persistence implementation.

  Apply after gcon_sqlserver_schema.sql with an approved SQL Server migration
  tool. Do not run this against production until the data-protection, backup,
  retention, access-control and performance decisions are approved.
*/

IF SCHEMA_ID(N'gcon') IS NULL EXEC(N'CREATE SCHEMA [gcon] AUTHORIZATION [dbo]');
GO

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
GO

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
GO

IF OBJECT_ID(N'gcon.schema_migrations', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM [gcon].[schema_migrations] WHERE [migration_id] = N'002_sqlserver_runtime_adapter')
BEGIN
    INSERT INTO [gcon].[schema_migrations] ([migration_id], [applied_by])
    VALUES (N'002_sqlserver_runtime_adapter', SUSER_SNAME());
END;
GO
