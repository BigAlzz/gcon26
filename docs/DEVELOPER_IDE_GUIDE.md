# Developer IDE guide

## Visual Studio or Visual Studio Code

This is a JavaScript/Node.js project. It has no `.sln`, `.slnx`, or `.csproj` file. The developer can open the extracted `source/` folder in Microsoft Visual Studio using **Open a local folder**, but the normal development experience is usually lighter in Visual Studio Code with the JavaScript and TypeScript extensions.

Do not create a .NET solution around the application unless sGov deliberately chooses to add a separate .NET service. The current API is `server.mjs`, the UI is React/Vite under `src/`, and the package manager is npm.

## First setup in the IDE

1. Extract the handover ZIP. Open the `source/` folder, the folder containing `package.json`, rather than opening the ZIP itself.
2. Install an sGov-approved Node.js LTS runtime. Restart the IDE after installing Node so its integrated terminal sees `node` and `npm`.
3. In the IDE terminal, run `npm ci`. This uses the checked-in `package-lock.json`; do not use a global dependency install.
4. Start the API in one terminal: `npm run dev:api`.
5. Start the Vite frontend in a second terminal: `npm run dev -- --host 127.0.0.1 --port 4173`.
6. Open `http://127.0.0.1:4173/`. The API is on port 4000 and Vite proxies both `/api` and `/v1` to it.

## Useful IDE tasks

Run these from the source root:

```powershell
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 4174
```

The current test suite contains 49 Node tests. The build creates `dist/` and a hosted-demo worker. The SQL Server adapter is loaded by the API at runtime when `GCON_DATABASE_PROVIDER=sqlserver` and `MSSQL_CONNECTION_STRING` are configured.

## Important handover cautions

- Do not double-click `index.html`; use Vite so the `/v1` proxy and React module loading work.
- Do not commit `.env`, `data/gcon-local-store.enc`, `data/documents/`, `node_modules/`, `dist/`, browser logs, or real applicant records.
- `.env.example` contains placeholder connection settings. They are not live credentials. Microsoft SQL Server support uses the adapter and migrations described in `database/gcon_sqlserver_schema.sql`, `database/002_sqlserver_runtime_adapter.sql`, and `docs/SQLSERVER_ADAPTER.md`.
- `GCON_AUTH_MODE=demo` and the demo role shortcuts are for local presentation only. Production must use the approved external identity provider.
- The public ChatGPT Sites URL is a stakeholder demo with in-memory state. It is not a production database, document store, or identity boundary.
- If ports 4000 or 4173 are already in use, identify the process before changing ports; keep the API and Vite proxy aligned.
- The handover is a source snapshot rather than a Git clone. Use the approved repository remote when the developer needs branch history, pull requests, or release tags.

## Visual Studio debugging note

Use the integrated terminal for the two long-running npm processes and the IDE debugger only after the app is running. If a Windows `spawn EPERM` appears while Vite or the Node test runner starts child processes, it is an execution-policy or sandbox restriction rather than an application assertion; retry from an approved developer terminal and verify the actual listeners on ports 4000 and 4173.
