# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Start development server with hot reload (Vite + Electron + TypeScript compilation)
- `npm run build` - Build for production (TypeScript compilation + Vite build + Electron bundling)
- `npm run lint` - Run ESLint checks
- `npm run preview` - Preview production build
- `npm run start:prod` - Start production build

### Component Commands
- `npm run dev:main` - Compile Electron main/preload processes in watch mode
- `npm run dev:electron` - Start Electron after waiting for Vite server and compiled files

## Architecture Overview

This is an **Electron-based local AI agent application** with a React frontend that orchestrates AI tasks through a local LLM via Ollama.

### Core Components

**Frontend (React + TypeScript + Tailwind)**
- `src/App.tsx` - Main UI with task input, live event stream, and tabbed sidebar
- Uses modern React patterns with hooks for state management
- Dark-themed UI with rose accent colors and glassmorphism effects

**Electron Layer**
- `electron/main.ts` - Main Electron process, window management, global shortcuts
- `electron/preload.ts` - Secure IPC bridge between renderer and main process
- Global shortcut: `Cmd/Ctrl + /` to show/hide application

**Agent Runtime (`src/agent/`)**
- `runtime.ts` - IPC handlers for starting tasks and retrieving history
- `scheduler.ts` - Task orchestrator that executes planned tasks in dependency order
- `task_planner.ts` - Uses local Ollama to break user prompts into executable task DAGs
- `event_bus.ts` - Event system for real-time UI updates
- `ipc_bridge.ts` - Forwards agent events to the React frontend

**Agent Workers (`src/agent/workers/`)**
- `research.ts` - Handles web research tasks
- `fileops.ts` - Handles local file operations
- Modular system allows easy addition of new worker types

**Data Layer**
- `src/db.ts` - SQLite database with WAL mode for sessions, runs, events, and tasks
- Database location: `~/.local-agent/agent.db`
- Tracks complete execution history with timestamps

### Task Execution Flow

1. User enters prompt in React UI
2. Task planner breaks prompt into 2-5 tasks with dependencies
3. Scheduler executes tasks in waves based on dependency graph
4. Workers (research, fileops) execute individual tasks
5. All events stream live to the UI via IPC bridge
6. Results stored in SQLite for history/replay

### Key Dependencies

- **Ollama** - Local LLM integration for task planning and execution
- **better-sqlite3** - High-performance SQLite database
- **Playwright** - Web automation for research tasks
- **Zod** - Runtime type validation for task schemas
- **Pino** - Structured logging

### Development Notes

- Uses TypeScript with strict configuration across all components
- ESLint configured with React and TypeScript rules
- Vite handles frontend bundling with React plugin
- TSUP compiles Electron processes to CommonJS
- Uses ES modules throughout the codebase (`"type": "module"`)

### Environment Setup

- Requires Ollama running locally (default: `http://127.0.0.1:11434`)
- Set `OLLAMA_MODEL` environment variable to override model selection
- Set `OLLAMA_HOST` to use different Ollama instance
- Development server runs on port 5173 (configurable in vite.config.ts)