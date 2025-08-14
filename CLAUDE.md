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
- `npm run agent:serve` - Start the agent web server
- `npm run tunnel` - Start ngrok tunnel for remote access
- `npm run rebuild` - Rebuild native dependencies (better-sqlite3)
- `npm run postinstall` - Auto-rebuild after package installation

## Architecture Overview

This is an **Electron-based local AI agent application** with a React frontend that orchestrates AI tasks through a local LLM via LM Studio.

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
- `task_planner.ts` - Uses local LM Studio to break user prompts into executable task DAGs
- `event_bus.ts` - Event system for real-time UI updates
- `ipc_bridge.ts` - Forwards agent events to the React frontend

**Agent Workers (`src/agent/workers/`)**
- `research.ts` - Handles web research tasks via Playwright automation
- `fileops.ts` - Local file operations, search, OCR processing with Tesseract
- `shell.ts` - Terminal command execution for system automation
- `ocr.ts` - Optical character recognition for image text extraction
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

- **LM Studio** - Local LLM integration for task planning and execution
- **better-sqlite3** - High-performance SQLite database
- **Playwright** - Web automation for research tasks
- **Tesseract.js** - OCR text extraction from images
- **Zod** - Runtime type validation for task schemas
- **Pino** - Structured logging
- **LangChain/LangGraph** - LLM orchestration and graph-based workflows
- **ElevenLabs** - Text-to-speech voice synthesis integration

### Development Notes

- Uses TypeScript with strict configuration across all components
- ESLint configured with React and TypeScript rules
- Vite handles frontend bundling with React plugin
- TSUP compiles Electron processes to CommonJS
- Uses ES modules throughout the codebase (`"type": "module"`)

### Environment Setup

- Requires LM Studio running locally (default: `http://127.0.0.1:1234`)
- Set `LMSTUDIO_MODEL` environment variable to override model selection
- Set `LMSTUDIO_HOST` to use different LM Studio instance
- Set `ELEVENLABS_API_KEY` for voice features or add to `keys.md` file
- Development server runs on port 5173 (configurable in vite.config.ts)

### Testing and Quality

- **Vitest** - Unit testing framework
- **Testing Library** - React component testing utilities
- **ESLint** - Code linting with TypeScript and React rules
- Run tests with `npm test` (if test script exists)
- Use `npm run lint` to check code quality

### Agent Capabilities

The agent supports three main modes:

1. **Chat Mode** - Direct LLM conversation with optional web search integration
2. **Tasks Mode** - Automation capabilities including:
   - File operations (create, move, rename, search)
   - Shell command execution
   - OCR text extraction from images
   - macOS app control (open, quit, focus applications)
   - Image upload and analysis

3. **Research Mode** - Deep web research with:
   - Multi-source information gathering via Playwright
   - Content synthesis and analysis
   - Structured report generation
   - Source citation and verification

### Remote Deployment

The application supports remote deployment via:
- Vercel proxy at `api/lm/[...path].ts` for CORS-free LM Studio access
- ngrok tunneling for remote agent service access
- Optional web-only mode for basic chat functionality