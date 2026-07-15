# RapidRAW Web App - Quick Start Guide

## Overview

RapidRAW has been converted from a Tauri desktop app to a full-stack web application:

- **Backend**: Axum (Rust) server on `http://localhost:3000`
- **Frontend**: React + Vite dev server on `http://localhost:1420` (proxies `/api/*` to backend)

## Starting the Application

### Development Mode (Recommended)

**Terminal 1 - Start the Rust backend:**
```bash
cd src-tauri
cargo run
```
The server starts at `http://localhost:3000`

**Terminal 2 - Start the Vite frontend:**
```bash
npm run dev
```
The frontend is served at `http://localhost:1420`. All `/api/invoke` calls are automatically proxied to the Axum backend.

### Or using npm scripts:
```bash
# Terminal 1
npm run backend

# Terminal 2  
npm run dev
```

### Production Build

```bash
# Build the frontend to dist/
npm run build

# Run the backend (it will serve dist/ at http://localhost:3000)
npm run backend
```

In production, the Axum server serves the static `dist/` folder and handles all `/api/invoke` calls on a **single port (3000)**.

## Architecture

```
Browser → http://localhost:1420 (Dev) or :3000 (Prod)
            ↓
        Vite Dev Server (Dev only)
            ↓ /api/* proxy
        Axum Server (:3000)
            ├── POST /api/invoke  → Routes to Rust handler
            └── GET  /*           → Serves dist/ (static files)
```

## API Protocol

All commands go through a single endpoint:

```
POST /api/invoke
Content-Type: application/json

{
  "command": "list_images_in_dir",
  "args": { "path": "/path/to/folder" }
}
```

The frontend's `invoke()` helper in `src/utils/invoke.ts` handles this automatically.

## Image Preview Commands

Commands like `apply_adjustments`, `generate_preview_for_path`, and `generate_preset_preview` return raw image data directly (as JPEG bytes or base64 data URLs). The `invoke()` helper automatically handles both JSON and image responses.
