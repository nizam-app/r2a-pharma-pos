# r2a-pharma-pos

Multi-tenant Pharmacy POS & Inventory SaaS (offline-first). Turborepo + npm workspaces.

## Quick start

```sh
npm install
```

## Commands

| Task | Command |
|------|---------|
| Run the server | `npm run dev -w @r2a/server` |
| Run the POS (desktop, browser) | `npm run dev -w @r2a/desktop` |
| Run the POS (Tauri window) | `npm run dev:tauri -w @r2a/desktop` |
| Run the admin (web) | `npm run dev -w @r2a/web` |
| Build the Tauri app | `npm run build:tauri -w @r2a/desktop` |
| Run the built Tauri app | `npm run desktop -w @r2a/desktop` |
