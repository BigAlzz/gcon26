/*
  GCON 2027 Student Nurse Intake
  Microsoft SQL Server baseline schema

  This is a first relational migration derived from the current local object
  model in server/domain.mjs and server/storage.mjs. It does not create a
  connection, provision a database, or migrate local encrypted demo data.
  Run it only after sGov approves the SQL Server version, database, schema
  owner, collation, encryption, backup, retention, and identity design.

  SQL Server 2019+ is recommended. All application writes must be executed
  through parameterised commands in explicit transactions. Document bytes
  belong in private object storage; only metadata is stored here.
*/

IF SCHEMA_ID(N'gcon') IS NULL EXEC(N'CREATE SCHEMA [gcon] AUTHORIZATION [dbo]');
GO

CREATE TABLE [gcon].[schema_migrations] (
    [migration_id] NVARCHAR(120) NOT NULL CONSTRAINT [PK_schema_migrations] PRIMARY KEY,
    [applied_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_schema_migrations_applied_at] DEFAULT SYSUTCDATETIME(),
    [checksum_sha256] CHAR(64) NULL,
    [applied_by] NVARCHAR(160) NULL
);
GO

CREATE TABLE [gcon].[organisations] (
    [organisation_id] NVARCHAR(80) NOT NULL CONSTRAINT [PK_organisations] PRIMARY KEY,
    [name] NVARCHAR(200) NOT NULL,
    [code] NVARCHAR(40) NOT NULL,
    [active] BIT NOT NULL CONSTRAINT [DF_organisations_active] DEFAULT (1),
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_organisations_created_at] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_organisations_updated_at] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [UQ_organisations_code] UNIQUE ([code])
);
GO

CREATE TABLE [gcon].[users] (
    [user_id] NVARCHAR(80) NOT NULL CONSTRAINT [PK_users] PRIMARY KEY,
    [external_subject] NVARCHAR(255) NULL,
    [username] NVARCHAR(80) NULL,
    [display_name] NVARCHAR(160) NOT NULL,
    [email] NVARCHAR(255) NULL,
    [active] BIT NOT NULL CONSTRAINT [DF_users_active] DEFAULT (1),
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_users_created_at] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_users_updated_at] DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX [UX_users_external_subject] ON [gcon].[users] ([external_subject]) WHERE [external_subject] IS NOT NULL;
CREATE UNIQUE INDEX [UX_users_username] ON [gcon].[users] ([username]) WHERE [username] IS NOT NULL;
GO

CREATE TABLE [gcon].[organisation_memberships] (
    [user_id] NVARCHAR(80) NOT NULL,
    [organisation_id] NVARCHAR(80) NOT NULL,
    [role] NVARCHAR(60) NOT NULL,
    [membership_status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_memberships_status] DEFAULT N'active',
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_memberships_created_at] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_memberships_updated_at] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_organisation_memberships] PRIMARY KEY ([user_id], [organisation_id], [role]),
    CONSTRAINT [FK_memberships_user] FOREIGN KEY ([user_id]) REFERENCES [gcon].[users] ([user_id]),
    CONSTRAINT [FK_memberships_organisation] FOREIGN KEY ([organisation_id]) REFERENCES [gcon].[organisations] ([organisation_id]),
    CONSTRAINT [CK_memberships_status] CHECK ([membership_status] IN (N'active', N'inactive', N'pending'))
);
GO

CREATE TABLE [gcon].[intake_cycles] (
    [cycle_id] NVARCHAR(80) NOT NULL CONSTRAINT [PK_intake_cycles] PRIMARY KEY,
    [name] NVARCHAR(120) NOT NULL,
    [open_date] DATE NOT NULL,
    [close_date] DATE NOT NULL,
    [reference_date] DATE NOT NULL,
    [advert_status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_intake_cycles_advert_status] DEFAULT N'Paused',
    [policy_status] NVARCHAR(40) NOT NULL CONSTRAINT [DF_intake_cycles_policy_status] DEFAULT N'pending-approval',
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_intake_cycles_created_at] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_intake_cycles_updated_at] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [CK_intake_cycles_dates] CHECK ([close_date] >= [open_date]),
    CONSTRAINT [CK_intake_cycles_advert_status] CHECK ([advert_status] IN (N'Published', N'Paused'))
);
GO

CREATE TABLE [gcon].[intake_cycle_requirements] (
    [cycle_id] NVARCHAR(80) NOT NULL,
    [pathway] NVARCHAR(80) NOT NULL,
    [requirement_key] NVARCHAR(120) NOT NULL,
    [requirement_text] NVARCHAR(600) NOT NULL,
    [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_cycle_requirements_updated_at] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_intake_cycle_requirements] PRIMARY KEY ([cycle_id], [pathway], [requirement_key]),
    CONSTRAINT [FK_cycle_requirements_cycle] FOREIGN KEY ([cycle_id]) REFERENCES [gcon].[intake_cycles] ([cycle_id])
);
GO

CREATE TABLE [gcon].[intake_cycle_document_types] (
    [document_type_id] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_intake_cycle_document_types] PRIMARY KEY,
    [cycle_id] NVARCHAR(80) NOT NULL,
    [label] NVARCHAR(160) NOT NULL,
    [sort_order] INT NOT NULL CONSTRAINT [DF_cycle_document_types_sort_order] DEFAULT (0),
    [active] BIT NOT NULL CONSTRAINT [DF_cycle_document_types_active] DEFAULT (1),
    CONSTRAINT [FK_cycle_document_types_cycle] FOREIGN KEY ([cycle_id]) REFERENCES [gcon].[intake_cycles] ([cycle_id]),
    CONSTRAINT [UQ_cycle_document_types_label] UNIQUE ([cycle_id], [label])
);
GO

CREATE TABLE [gcon].[intake_cycle_campus_capacities] (
    [cycle_id] NVARCHAR(80) NOT NULL,
    [campus_name] NVARCHAR(160) NOT NULL,
    [capacity] INT NOT NULL,
    [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_cycle_capacities_updated_at] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_intake_cycle_campus_capacities] PRIMARY KEY ([cycle_id], [campus_name]),
    CONSTRAINT [FK_cycle_capacities_cycle] FOREIGN KEY ([cycle_id]) REFERENCES [gcon].[intake_cycles] ([cycle_id]),
    CONSTRAINT [CK_cycle_capacities_capacity] CHECK ([capacity] >= 0)
);
GO

CREATE TABLE [gcon].[applications] (
    [application_id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_applications_id] DEFAULT NEWSEQUENTIALID() CONSTRAINT [PK_applications] PRIMARY KEY,
    [reference_no] NVARCHAR(40) NOT NULL,
    [cycle_id] NVARCHAR(80) NOT NULL,
    [owner_user_id] NVARCHAR(80) NULL,
    [organisation_id] NVARCHAR(80) NOT NULL,
    [status] NVARCHAR(40) NOT NULL CONSTRAINT [DF_applications_status] DEFAULT N'Draft',
    [pathway] NVARCHAR(80) NULL,
    [identity_number_hash] VARBINARY(32) NULL,
    [identity_number_masked] NVARCHAR(32) NULL,
    [applicant_name] NVARCHAR(160) NULL,
    [contact_mobile] NVARCHAR(40) NULL,
    [contact_email] NVARCHAR(255) NULL,
    [address_verified] BIT NULL,
    [academic_score_text] NVARCHAR(40) NULL,
    [academic_score_decimal] DECIMAL(10,3) NULL,
    [academic_score_unit] NVARCHAR(30) NULL,
    [academic_rank] INT NULL,
    [pathway_values_json] NVARCHAR(MAX) NULL,
    [profile_json] NVARCHAR(MAX) NULL,
    [correction_reason] NVARCHAR(500) NULL,
    [correction_requested_at] DATETIME2(3) NULL,
    [withdrawal_reason] NVARCHAR(500) NULL,
    [withdrawn_at] DATETIME2(3) NULL,
    [placement_campus] NVARCHAR(160) NULL,
    [placement_released_at] DATETIME2(3) NULL,
    [placement_response] NVARCHAR(30) NULL,
    [placed_at] DATETIME2(3) NULL,
    [submitted_at] DATETIME2(3) NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_applications_created_at] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_applications_updated_at] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [UQ_applications_reference_no] UNIQUE ([reference_no]),
    CONSTRAINT [FK_applications_cycle] FOREIGN KEY ([cycle_id]) REFERENCES [gcon].[intake_cycles] ([cycle_id]),
    CONSTRAINT [FK_applications_owner] FOREIGN KEY ([owner_user_id]) REFERENCES [gcon].[users] ([user_id]),
    CONSTRAINT [FK_applications_organisation] FOREIGN KEY ([organisation_id]) REFERENCES [gcon].[organisations] ([organisation_id]),
    CONSTRAINT [CK_applications_pathway_values_json] CHECK ([pathway_values_json] IS NULL OR ISJSON([pathway_values_json]) = 1),
    CONSTRAINT [CK_applications_profile_json] CHECK ([profile_json] IS NULL OR ISJSON([profile_json]) = 1),
    CONSTRAINT [CK_applications_academic_rank] CHECK ([academic_rank] IS NULL OR [academic_rank] > 0)
);
GO

CREATE UNIQUE INDEX [UX_applications_cycle_identity] ON [gcon].[applications] ([cycle_id], [identity_number_hash]) WHERE [identity_number_hash] IS NOT NULL;
CREATE INDEX [IX_applications_cycle_status] ON [gcon].[applications] ([cycle_id], [status], [pathway]);
CREATE INDEX [IX_applications_organisation_status] ON [gcon].[applications] ([organisation_id], [status]);
GO

CREATE TABLE [gcon].[application_submissions] (
    [submission_id] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_application_submissions] PRIMARY KEY,
    [application_id] UNIQUEIDENTIFIER NOT NULL,
    [submission_version] INT NOT NULL,
    [snapshot_json] NVARCHAR(MAX) NOT NULL,
    [submitted_by_user_id] NVARCHAR(80) NULL,
    [submitted_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_application_submissions_submitted_at] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_application_submissions_application] FOREIGN KEY ([application_id]) REFERENCES [gcon].[applications] ([application_id]),
    CONSTRAINT [FK_application_submissions_user] FOREIGN KEY ([submitted_by_user_id]) REFERENCES [gcon].[users] ([user_id]),
    CONSTRAINT [CK_application_submissions_snapshot_json] CHECK (ISJSON([snapshot_json]) = 1),
    CONSTRAINT [UQ_application_submissions_version] UNIQUE ([application_id], [submission_version])
);
GO

CREATE TABLE [gcon].[application_preferences] (
    [application_id] UNIQUEIDENTIFIER NOT NULL,
    [preference_order] TINYINT NOT NULL,
    [campus_name] NVARCHAR(160) NOT NULL,
    CONSTRAINT [PK_application_preferences] PRIMARY KEY ([application_id], [preference_order]),
    CONSTRAINT [FK_application_preferences_application] FOREIGN KEY ([application_id]) REFERENCES [gcon].[applications] ([application_id]),
    CONSTRAINT [CK_application_preferences_order] CHECK ([preference_order] BETWEEN 1 AND 4)
);
GO

CREATE TABLE [gcon].[application_subject_results] (
    [subject_result_id] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_application_subject_results] PRIMARY KEY,
    [application_id] UNIQUEIDENTIFIER NOT NULL,
    [subject_group] NVARCHAR(80) NULL,
    [subject_code] NVARCHAR(80) NULL,
    [subject_name] NVARCHAR(160) NOT NULL,
    [result_text] NVARCHAR(40) NULL,
    [result_decimal] DECIMAL(6,2) NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_application_subject_results_created_at] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_application_subject_results_updated_at] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_application_subject_results_application] FOREIGN KEY ([application_id]) REFERENCES [gcon].[applications] ([application_id])
);
GO

CREATE TABLE [gcon].[application_training_records] (
    [training_record_id] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_application_training_records] PRIMARY KEY,
    [application_id] UNIQUEIDENTIFIER NOT NULL,
    [training_type] NVARCHAR(160) NOT NULL,
    [details_json] NVARCHAR(MAX) NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_application_training_created_at] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_application_training_application] FOREIGN KEY ([application_id]) REFERENCES [gcon].[applications] ([application_id]),
    CONSTRAINT [CK_application_training_details_json] CHECK ([details_json] IS NULL OR ISJSON([details_json]) = 1)
);
GO

CREATE TABLE [gcon].[application_work_experience] (
    [work_experience_id] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_application_work_experience] PRIMARY KEY,
    [application_id] UNIQUEIDENTIFIER NOT NULL,
    [employer_name] NVARCHAR(200) NOT NULL,
    [job_title] NVARCHAR(160) NOT NULL,
    [start_date] DATE NULL,
    [end_date] DATE NULL,
    [currently_employed] BIT NOT NULL CONSTRAINT [DF_work_experience_currently_employed] DEFAULT (0),
    [responsibilities] NVARCHAR(2000) NULL,
    [reason_for_leaving] NVARCHAR(500) NULL,
    [reference_json] NVARCHAR(MAX) NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_work_experience_created_at] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_work_experience_updated_at] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_work_experience_application] FOREIGN KEY ([application_id]) REFERENCES [gcon].[applications] ([application_id]),
    CONSTRAINT [CK_work_experience_dates] CHECK ([end_date] IS NULL OR [start_date] IS NULL OR [end_date] >= [start_date]),
    CONSTRAINT [CK_work_experience_reference_json] CHECK ([reference_json] IS NULL OR ISJSON([reference_json]) = 1)
);
GO

CREATE TABLE [gcon].[application_documents] (
    [document_id] NVARCHAR(100) NOT NULL CONSTRAINT [PK_application_documents] PRIMARY KEY,
    [application_id] UNIQUEIDENTIFIER NOT NULL,
    [organisation_id] NVARCHAR(80) NOT NULL,
    [document_type] NVARCHAR(80) NOT NULL,
    [label] NVARCHAR(160) NOT NULL,
    [state] NVARCHAR(40) NOT NULL CONSTRAINT [DF_application_documents_state] DEFAULT N'pending',
    [content_type] NVARCHAR(120) NULL,
    [size_bytes] BIGINT NULL,
    [checksum_sha256] CHAR(64) NULL,
    [object_key] NVARCHAR(500) NULL,
    [uploaded_at] DATETIME2(3) NULL,
    [completed_at] DATETIME2(3) NULL,
    [reviewed_at] DATETIME2(3) NULL,
    [reviewed_by_user_id] NVARCHAR(80) NULL,
    [review_reason] NVARCHAR(500) NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_application_documents_created_at] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_application_documents_updated_at] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_application_documents_application] FOREIGN KEY ([application_id]) REFERENCES [gcon].[applications] ([application_id]),
    CONSTRAINT [FK_application_documents_organisation] FOREIGN KEY ([organisation_id]) REFERENCES [gcon].[organisations] ([organisation_id]),
    CONSTRAINT [FK_application_documents_reviewer] FOREIGN KEY ([reviewed_by_user_id]) REFERENCES [gcon].[users] ([user_id]),
    CONSTRAINT [CK_application_documents_state] CHECK ([state] IN (N'pending', N'uploading', N'complete', N'verified', N'rejected', N'correction_required', N'quarantined'))
);
GO

CREATE TABLE [gcon].[review_tasks] (
    [review_task_id] NVARCHAR(100) NOT NULL CONSTRAINT [PK_review_tasks] PRIMARY KEY,
    [application_id] UNIQUEIDENTIFIER NOT NULL,
    [assigned_to_user_id] NVARCHAR(80) NULL,
    [task_status] NVARCHAR(40) NOT NULL CONSTRAINT [DF_review_tasks_status] DEFAULT N'open',
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_review_tasks_created_at] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_review_tasks_updated_at] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_review_tasks_application] FOREIGN KEY ([application_id]) REFERENCES [gcon].[applications] ([application_id]),
    CONSTRAINT [FK_review_tasks_assignee] FOREIGN KEY ([assigned_to_user_id]) REFERENCES [gcon].[users] ([user_id])
);
GO

CREATE TABLE [gcon].[shortlist_entries] (
    [application_id] UNIQUEIDENTIFIER NOT NULL,
    [shortlisted_by_user_id] NVARCHAR(80) NOT NULL,
    [shortlisted_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_shortlist_entries_shortlisted_at] DEFAULT SYSUTCDATETIME(),
    [active] BIT NOT NULL CONSTRAINT [DF_shortlist_entries_active] DEFAULT (1),
    [reason] NVARCHAR(500) NULL,
    CONSTRAINT [PK_shortlist_entries] PRIMARY KEY ([application_id]),
    CONSTRAINT [FK_shortlist_entries_application] FOREIGN KEY ([application_id]) REFERENCES [gcon].[applications] ([application_id]),
    CONSTRAINT [FK_shortlist_entries_user] FOREIGN KEY ([shortlisted_by_user_id]) REFERENCES [gcon].[users] ([user_id])
);
GO

CREATE TABLE [gcon].[interviews] (
    [interview_id] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_interviews] PRIMARY KEY,
    [application_id] UNIQUEIDENTIFIER NOT NULL,
    [invited_by_user_id] NVARCHAR(80) NOT NULL,
    [scheduled_at] DATETIME2(3) NULL,
    [outcome] NVARCHAR(30) NULL,
    [score_text] NVARCHAR(40) NULL,
    [notes] NVARCHAR(500) NULL,
    [invited_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_interviews_invited_at] DEFAULT SYSUTCDATETIME(),
    [outcome_at] DATETIME2(3) NULL,
    CONSTRAINT [FK_interviews_application] FOREIGN KEY ([application_id]) REFERENCES [gcon].[applications] ([application_id]),
    CONSTRAINT [FK_interviews_invited_by] FOREIGN KEY ([invited_by_user_id]) REFERENCES [gcon].[users] ([user_id]),
    CONSTRAINT [CK_interviews_outcome] CHECK ([outcome] IS NULL OR [outcome] IN (N'passed', N'failed', N'no_show', N'pending'))
);
GO

CREATE TABLE [gcon].[placements] (
    [placement_id] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_placements] PRIMARY KEY,
    [application_id] UNIQUEIDENTIFIER NOT NULL,
    [cycle_id] NVARCHAR(80) NOT NULL,
    [campus_name] NVARCHAR(160) NOT NULL,
    [released_to_organisation_id] NVARCHAR(80) NULL,
    [prepared_by_user_id] NVARCHAR(80) NOT NULL,
    [placement_status] NVARCHAR(40) NOT NULL CONSTRAINT [DF_placements_status] DEFAULT N'Placement ready',
    [employer_response] NVARCHAR(30) NULL,
    [prepared_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_placements_prepared_at] DEFAULT SYSUTCDATETIME(),
    [responded_at] DATETIME2(3) NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_placements_created_at] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_placements_updated_at] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_placements_application] FOREIGN KEY ([application_id]) REFERENCES [gcon].[applications] ([application_id]),
    CONSTRAINT [FK_placements_cycle] FOREIGN KEY ([cycle_id]) REFERENCES [gcon].[intake_cycles] ([cycle_id]),
    CONSTRAINT [FK_placements_organisation] FOREIGN KEY ([released_to_organisation_id]) REFERENCES [gcon].[organisations] ([organisation_id]),
    CONSTRAINT [FK_placements_prepared_by] FOREIGN KEY ([prepared_by_user_id]) REFERENCES [gcon].[users] ([user_id]),
    CONSTRAINT [CK_placements_response] CHECK ([employer_response] IS NULL OR [employer_response] IN (N'accept', N'decline'))
);
GO

CREATE TABLE [gcon].[communications] (
    [communication_id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_communications_id] DEFAULT NEWSEQUENTIALID() CONSTRAINT [PK_communications] PRIMARY KEY,
    [cycle_id] NVARCHAR(80) NOT NULL,
    [issued_by_user_id] NVARCHAR(80) NOT NULL,
    [audience] NVARCHAR(120) NOT NULL,
    [template_name] NVARCHAR(160) NULL,
    [message_text] NVARCHAR(4000) NOT NULL,
    [provider] NVARCHAR(60) NOT NULL CONSTRAINT [DF_communications_provider] DEFAULT N'in_app',
    [status] NVARCHAR(40) NOT NULL CONSTRAINT [DF_communications_status] DEFAULT N'issued',
    [issued_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_communications_issued_at] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_communications_cycle] FOREIGN KEY ([cycle_id]) REFERENCES [gcon].[intake_cycles] ([cycle_id]),
    CONSTRAINT [FK_communications_issued_by] FOREIGN KEY ([issued_by_user_id]) REFERENCES [gcon].[users] ([user_id])
);
GO

CREATE TABLE [gcon].[communication_recipients] (
    [communication_id] UNIQUEIDENTIFIER NOT NULL,
    [user_id] NVARCHAR(80) NOT NULL,
    [application_id] UNIQUEIDENTIFIER NULL,
    [delivery_status] NVARCHAR(40) NOT NULL CONSTRAINT [DF_communication_recipients_status] DEFAULT N'queued',
    [delivered_at] DATETIME2(3) NULL,
    CONSTRAINT [PK_communication_recipients] PRIMARY KEY ([communication_id], [user_id]),
    CONSTRAINT [FK_communication_recipients_communication] FOREIGN KEY ([communication_id]) REFERENCES [gcon].[communications] ([communication_id]),
    CONSTRAINT [FK_communication_recipients_user] FOREIGN KEY ([user_id]) REFERENCES [gcon].[users] ([user_id]),
    CONSTRAINT [FK_communication_recipients_application] FOREIGN KEY ([application_id]) REFERENCES [gcon].[applications] ([application_id])
);
GO

CREATE TABLE [gcon].[notifications] (
    [notification_id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_notifications_id] DEFAULT NEWSEQUENTIALID() CONSTRAINT [PK_notifications] PRIMARY KEY,
    [user_id] NVARCHAR(80) NOT NULL,
    [application_id] UNIQUEIDENTIFIER NULL,
    [communication_id] UNIQUEIDENTIFIER NULL,
    [notification_type] NVARCHAR(60) NOT NULL,
    [title] NVARCHAR(200) NOT NULL,
    [body] NVARCHAR(2000) NOT NULL,
    [read_at] DATETIME2(3) NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_notifications_created_at] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_notifications_user] FOREIGN KEY ([user_id]) REFERENCES [gcon].[users] ([user_id]),
    CONSTRAINT [FK_notifications_application] FOREIGN KEY ([application_id]) REFERENCES [gcon].[applications] ([application_id]),
    CONSTRAINT [FK_notifications_communication] FOREIGN KEY ([communication_id]) REFERENCES [gcon].[communications] ([communication_id])
);
GO

CREATE TABLE [gcon].[applicant_chat_threads] (
    [thread_id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_chat_threads_id] DEFAULT NEWSEQUENTIALID() CONSTRAINT [PK_applicant_chat_threads] PRIMARY KEY,
    [user_id] NVARCHAR(80) NOT NULL,
    [application_id] UNIQUEIDENTIFIER NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_chat_threads_created_at] DEFAULT SYSUTCDATETIME(),
    [closed_at] DATETIME2(3) NULL,
    CONSTRAINT [FK_chat_threads_user] FOREIGN KEY ([user_id]) REFERENCES [gcon].[users] ([user_id]),
    CONSTRAINT [FK_chat_threads_application] FOREIGN KEY ([application_id]) REFERENCES [gcon].[applications] ([application_id])
);
GO

CREATE TABLE [gcon].[applicant_chat_messages] (
    [message_id] BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_applicant_chat_messages] PRIMARY KEY,
    [thread_id] UNIQUEIDENTIFIER NOT NULL,
    [sender_user_id] NVARCHAR(80) NULL,
    [sender_type] NVARCHAR(30) NOT NULL,
    [message_text] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_chat_messages_created_at] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_chat_messages_thread] FOREIGN KEY ([thread_id]) REFERENCES [gcon].[applicant_chat_threads] ([thread_id]),
    CONSTRAINT [FK_chat_messages_sender] FOREIGN KEY ([sender_user_id]) REFERENCES [gcon].[users] ([user_id])
);
GO

CREATE TABLE [gcon].[organisation_invitations] (
    [invitation_id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_invitations_id] DEFAULT NEWSEQUENTIALID() CONSTRAINT [PK_organisation_invitations] PRIMARY KEY,
    [organisation_id] NVARCHAR(80) NOT NULL,
    [email] NVARCHAR(255) NOT NULL,
    [display_name] NVARCHAR(160) NULL,
    [role] NVARCHAR(60) NOT NULL,
    [token_hash] VARBINARY(32) NOT NULL,
    [status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_invitations_status] DEFAULT N'pending',
    [invited_by_user_id] NVARCHAR(80) NOT NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_invitations_created_at] DEFAULT SYSUTCDATETIME(),
    [expires_at] DATETIME2(3) NOT NULL,
    [accepted_at] DATETIME2(3) NULL,
    [accepted_user_id] NVARCHAR(80) NULL,
    CONSTRAINT [FK_invitations_organisation] FOREIGN KEY ([organisation_id]) REFERENCES [gcon].[organisations] ([organisation_id]),
    CONSTRAINT [FK_invitations_invited_by] FOREIGN KEY ([invited_by_user_id]) REFERENCES [gcon].[users] ([user_id]),
    CONSTRAINT [FK_invitations_accepted_user] FOREIGN KEY ([accepted_user_id]) REFERENCES [gcon].[users] ([user_id]),
    CONSTRAINT [UQ_invitations_token_hash] UNIQUE ([token_hash])
);
GO

CREATE TABLE [gcon].[sessions] (
    [session_id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_sessions_id] DEFAULT NEWSEQUENTIALID() CONSTRAINT [PK_sessions] PRIMARY KEY,
    [user_id] NVARCHAR(80) NOT NULL,
    [token_hash] VARBINARY(32) NOT NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_sessions_created_at] DEFAULT SYSUTCDATETIME(),
    [expires_at] DATETIME2(3) NOT NULL,
    [revoked_at] DATETIME2(3) NULL,
    CONSTRAINT [FK_sessions_user] FOREIGN KEY ([user_id]) REFERENCES [gcon].[users] ([user_id]),
    CONSTRAINT [UQ_sessions_token_hash] UNIQUE ([token_hash])
);
GO

CREATE TABLE [gcon].[non_qualifier_contacts] (
    [contact_id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_non_qualifier_contacts_id] DEFAULT NEWSEQUENTIALID() CONSTRAINT [PK_non_qualifier_contacts] PRIMARY KEY,
    [cycle_id] NVARCHAR(80) NOT NULL,
    [pathway] NVARCHAR(80) NOT NULL,
    [identity_number_hash] VARBINARY(32) NULL,
    [identity_number_masked] NVARCHAR(32) NULL,
    [contact_mobile] NVARCHAR(40) NULL,
    [contact_email] NVARCHAR(255) NULL,
    [entered_values_json] NVARCHAR(MAX) NOT NULL,
    [result_status] NVARCHAR(40) NOT NULL,
    [failed_criteria_json] NVARCHAR(MAX) NULL,
    [score_text] NVARCHAR(40) NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_non_qualifier_contacts_created_at] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [FK_non_qualifier_contacts_cycle] FOREIGN KEY ([cycle_id]) REFERENCES [gcon].[intake_cycles] ([cycle_id]),
    CONSTRAINT [CK_non_qualifier_values_json] CHECK (ISJSON([entered_values_json]) = 1),
    CONSTRAINT [CK_non_qualifier_failed_json] CHECK ([failed_criteria_json] IS NULL OR ISJSON([failed_criteria_json]) = 1)
);
GO

CREATE TABLE [gcon].[idempotency_keys] (
    [idempotency_key] NVARCHAR(128) NOT NULL,
    [actor_user_id] NVARCHAR(80) NOT NULL,
    [route_name] NVARCHAR(160) NOT NULL,
    [request_hash] CHAR(64) NOT NULL,
    [response_status] INT NULL,
    [response_json] NVARCHAR(MAX) NULL,
    [created_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_idempotency_keys_created_at] DEFAULT SYSUTCDATETIME(),
    [expires_at] DATETIME2(3) NULL,
    CONSTRAINT [PK_idempotency_keys] PRIMARY KEY ([actor_user_id], [route_name], [idempotency_key]),
    CONSTRAINT [FK_idempotency_keys_user] FOREIGN KEY ([actor_user_id]) REFERENCES [gcon].[users] ([user_id]),
    CONSTRAINT [CK_idempotency_response_json] CHECK ([response_json] IS NULL OR ISJSON([response_json]) = 1)
);
GO

CREATE TABLE [gcon].[intake_reference_counters] (
    [cycle_id] NVARCHAR(80) NOT NULL,
    [reference_date] DATE NOT NULL,
    [next_number] INT NOT NULL CONSTRAINT [DF_reference_counters_next_number] DEFAULT (0),
    [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_reference_counters_updated_at] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_intake_reference_counters] PRIMARY KEY ([cycle_id], [reference_date]),
    CONSTRAINT [FK_reference_counters_cycle] FOREIGN KEY ([cycle_id]) REFERENCES [gcon].[intake_cycles] ([cycle_id]),
    CONSTRAINT [CK_reference_counters_next_number] CHECK ([next_number] >= 0)
);
GO

CREATE TABLE [gcon].[audit_events] (
    [audit_event_id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_audit_events_id] DEFAULT NEWSEQUENTIALID() CONSTRAINT [PK_audit_events] PRIMARY KEY,
    [occurred_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_audit_events_occurred_at] DEFAULT SYSUTCDATETIME(),
    [event_type] NVARCHAR(120) NOT NULL,
    [application_id] UNIQUEIDENTIFIER NULL,
    [reference_no] NVARCHAR(40) NULL,
    [actor_user_id] NVARCHAR(80) NULL,
    [organisation_id] NVARCHAR(80) NULL,
    [reason] NVARCHAR(500) NULL,
    [metadata_json] NVARCHAR(MAX) NULL,
    CONSTRAINT [FK_audit_events_application] FOREIGN KEY ([application_id]) REFERENCES [gcon].[applications] ([application_id]),
    CONSTRAINT [FK_audit_events_actor] FOREIGN KEY ([actor_user_id]) REFERENCES [gcon].[users] ([user_id]),
    CONSTRAINT [FK_audit_events_organisation] FOREIGN KEY ([organisation_id]) REFERENCES [gcon].[organisations] ([organisation_id]),
    CONSTRAINT [CK_audit_events_metadata_json] CHECK ([metadata_json] IS NULL OR ISJSON([metadata_json]) = 1)
);
GO

CREATE INDEX [IX_audit_events_application_time] ON [gcon].[audit_events] ([application_id], [occurred_at]);
CREATE INDEX [IX_audit_events_organisation_time] ON [gcon].[audit_events] ([organisation_id], [occurred_at]);
GO

/*
  Transaction-safe daily reference allocation.
  Call inside the same transaction that inserts the application. The caller
  supplies the cycle id, reference date, and the approved GCON prefix.
*/
CREATE OR ALTER PROCEDURE [gcon].[allocate_application_reference]
    @cycle_id NVARCHAR(80),
    @reference_date DATE,
    @prefix NVARCHAR(20),
    @reference_no NVARCHAR(40) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @@TRANCOUNT = 0 THROW 51000, 'Reference allocation must run inside a transaction', 1;

    DECLARE @next INT;
    UPDATE [gcon].[intake_reference_counters] WITH (UPDLOCK, SERIALIZABLE)
      SET [next_number] = [next_number] + 1,
          [updated_at] = SYSUTCDATETIME()
      WHERE [cycle_id] = @cycle_id AND [reference_date] = @reference_date;
    IF @@ROWCOUNT = 0
    BEGIN
        INSERT INTO [gcon].[intake_reference_counters] ([cycle_id], [reference_date], [next_number]) VALUES (@cycle_id, @reference_date, 1);
        SET @next = 1;
    END;
    ELSE
    BEGIN
        SELECT @next = [next_number] FROM [gcon].[intake_reference_counters] WHERE [cycle_id] = @cycle_id AND [reference_date] = @reference_date;
    END;
    SET @reference_no = @prefix + CONVERT(NVARCHAR(8), @reference_date, 112) + N'-' + RIGHT(N'00' + CONVERT(NVARCHAR(10), @next), 2);
END;
GO

/* Record this migration after review and execution. */
IF NOT EXISTS (SELECT 1 FROM [gcon].[schema_migrations] WHERE [migration_id] = N'001_initial_gcon_sqlserver_schema')
    INSERT INTO [gcon].[schema_migrations] ([migration_id], [checksum_sha256], [applied_by])
    VALUES (N'001_initial_gcon_sqlserver_schema', NULL, SUSER_SNAME());
GO
