# ============================================================================
# JUSTFILE - BUILD AND DEVELOPMENT AUTOMATION
# ============================================================================
# This Justfile provides convenient commands for running the Research Knowledge
# Management System in development mode. It coordinates both the FastAPI backend
# and React frontend services for full-stack development.
#
# PREREQUISITES:
# - Python virtual environment activated at ./amb/bin/activate
# - Node.js and npm installed for frontend dependencies
# - All dependencies installed (see requirements.txt and package.json)
#
# USAGE:
#   just        # Start both backend and frontend (default)
#   just start  # Explicitly start both services
#
# DEVELOPMENT WORKFLOW:
# 1. Backend starts on http://localhost:8000 with auto-reload
# 2. Frontend starts on http://localhost:5173 with hot module replacement
# 3. Both services run concurrently for full-stack development
# ============================================================================

# Default recipe - runs when 'just' is called without arguments
default: start

# Start both backend and frontend services for development
start:
    #!/bin/bash
    echo "🚀 Starting backend on http://127.0.0.1:8000 ..."
    # --host 127.0.0.1 keeps the API on the loopback interface: it is a
    # single-user tool and the security model relies on staying local.
    # --reload restarts the server when Python files change.
    source amb/bin/activate && cd board/backend && uvicorn main:app --host 127.0.0.1 --port 8000 --reload &

    echo "🎨 Starting frontend on http://127.0.0.1:5173 ..."
    # Vite dev server with hot module replacement
    cd board/frontend && npm run dev &

    # Wait for both background processes to complete
    # This keeps the terminal session active while both services run
    wait
