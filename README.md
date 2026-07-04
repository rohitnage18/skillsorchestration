# Skill Orchestration Workspace

This repository contains a skill library, an MCP server for VS Code and agent context, and a Next.js conductor app for managing skills and workflows.

## What is included

- A shared skill library under skills/
- An MCP server under skills-mcp-server/
- A Next.js app under conductor-app/
- A Python helper entrypoint at main.py

## Prerequisites

Install the following before you start:

- Git
- Node.js 18 or newer and npm
- Python 3.10+ (recommended for helper scripts and tests)
- A PostgreSQL database or another Prisma-compatible database

## 1. Clone and open in VS Code

```bash
git clone <your-repo-url>
cd skill-orchestration-repo
code .
```

When you open the folder in VS Code, the workspace already includes .vscode/mcp.json, which wires the local MCP server into the editor automatically.

## 2. Install dependencies

### Root workspace

```bash
npm install
```

### Conductor app

```bash
cd conductor-app
npm install
```

### Skills MCP server

```bash
cd ../skills-mcp-server
npm install
npm run build
```

### Python environment (optional but recommended)

On Windows PowerShell:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r ..\requirements.txt
```

On macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 3. Configure environment variables

Create a .env file inside conductor-app and set at least the database connection string:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/skill_orchestration
```

If you want email notifications to work, also add your SMTP settings (optional):

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASSWORD=your-password
FROM_EMAIL=noreply@example.com
```

## 4. Apply the Prisma schema

From conductor-app:

```bash
npx prisma generate
npx prisma migrate dev
```

If you are using a fresh database, this creates the tables used by the conductor app.

## 5. Start the app locally

Open a terminal for the conductor app:

```bash
cd conductor-app
npm run dev
```

Open another terminal for the main workspace app if needed:

```bash
cd ..
npm run dev
```

The main UI and the conductor app will be available on the local development ports used by Next.js.

## 6. Connect the VS Code MCP server

The repository already contains the MCP settings in .vscode/mcp.json. After opening the repo in VS Code:

1. Make sure the workspace opens at the repository root.
2. Run the command palette command: Developer: Reload Window.
3. Confirm that the skills MCP server is available to the editor.

If the server is not picked up, verify that:

- Node.js is installed and available in your PATH
- skills-mcp-server/ has been built with npm run build
- The path in .vscode/mcp.json points to the correct workspace folder

## 7. Useful commands

- Build the conductor app:

```bash
cd conductor-app
npm run build
```

- Run tests (Python):

```bash
pytest
```

- Open Prisma Studio:

```bash
cd conductor-app
npx prisma studio
```

## Troubleshooting

- If you see DATABASE_URL is required, create the .env file in conductor-app and set DATABASE_URL.
- If the MCP server does not appear in VS Code, reload the window and confirm that .vscode/mcp.json is present.
- If dependencies are missing, run npm install again in the relevant folder.
