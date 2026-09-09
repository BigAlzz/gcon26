# Microsoft SQL Server schema package

`gcon_sqlserver_schema.sql` is the reviewed baseline relational schema for the GCON 2027 application. The current application also includes `002_sqlserver_runtime_adapter.sql` and a working `mssql` adapter in `source/server/storage.mjs`. The adapter uses a JSON runtime row to preserve the existing domain contract while the normalized relational write model is completed.

The script creates the `gcon` schema and tables for intake cycles, organisations, users and memberships, applications and immutable submissions, pathway values, preferences, training and work experience, document metadata, review and shortlist operations, interviews, placements, communications, notifications, support chat, invitations, sessions, non-qualifier contacts, idempotency, reference allocation, and audit events.

Important implementation boundaries:

- The normalized schema is designed for applicant document bytes to remain in private object storage. The current runtime adapter temporarily stores bytes in `gcon.document_blobs`; move them to approved private object storage before production acceptance.
- Identity-provider subjects and managed authentication replace the local demo password/session model.
- Protect identity-number values with the sGov-approved encryption and hashing design. The schema provides a hash and masked-value pattern; it does not choose the key-management implementation.
- Every workflow write must enforce organisation scope, permitted state transition, cycle scope, and audit creation in one transaction.
- The supplied procedure allocates daily references only inside a caller-owned transaction. Review its prefix and numbering policy before use.
- The final SQL Server version, compatibility level, collation, schema owner, migration tool, backup/restore policy, row-level security strategy, retention, and production seed data remain sGov decisions.

Recommended next steps are to apply both migrations in a disposable SQL Server database, verify the adapter with draft, document, review and audit workflows, then complete the data-protection, normalized-relational, backup/restore and performance review before production binding.
