#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
#  InvestorIQ — One-Click Launcher  (Mac / Linux)
#  Usage:  ./launch.sh
#  On first run it creates a virtual environment and installs deps.
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Banner ────────────────────────────────────────────────────────
echo ""
echo "  🎯  InvestorIQ — Angel Investor Research"
echo "  ─────────────────────────────────────────"
echo ""

# ── Python check ──────────────────────────────────────────────────
if command -v python3 &>/dev/null; then
    PYTHON=python3
elif command -v python &>/dev/null; then
    PYTHON=python
else
    echo "  ❌  Python not found."
    echo "      Install it from https://www.python.org/downloads/"
    echo ""
    exit 1
fi

PY_VER=$($PYTHON -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PY_MAJOR=$($PYTHON -c "import sys; print(sys.version_info.major)")
PY_MINOR=$($PYTHON -c "import sys; print(sys.version_info.minor)")

if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]; }; then
    echo "  ❌  Python $PY_VER found, but 3.10+ is required."
    echo "      Install a newer Python from https://www.python.org/downloads/"
    echo ""
    exit 1
fi
echo "  ✓  Python $PY_VER"

# ── Virtual environment ───────────────────────────────────────────
VENV_DIR="$SCRIPT_DIR/.venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "  →  Creating virtual environment…"
    $PYTHON -m venv "$VENV_DIR"
    echo "  ✓  Virtual environment created"
fi

# Activate
if [ -f "$VENV_DIR/bin/activate" ]; then
    source "$VENV_DIR/bin/activate"
else
    echo "  ❌  Could not find virtual environment activation script."
    exit 1
fi

# ── Dependencies ──────────────────────────────────────────────────
echo "  →  Checking dependencies…"
pip install -q --upgrade pip
pip install -q -r requirements.txt
echo "  ✓  Dependencies ready"

# ── .env setup ────────────────────────────────────────────────────
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    if [ -f "$SCRIPT_DIR/.env.example" ]; then
        cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    else
        touch "$SCRIPT_DIR/.env"
    fi
    echo ""
    echo "  ⚠   Created .env file — action required:"
    echo "      1. Open the file:  nano .env  (or any text editor)"
    echo "      2. Set your key:   ANTHROPIC_API_KEY=sk-ant-..."
    echo "      3. Get a key at:   https://console.anthropic.com"
    echo ""
fi

# Check if API key is set
if ! grep -q "ANTHROPIC_API_KEY=sk-" "$SCRIPT_DIR/.env" 2>/dev/null; then
    if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
        echo "  ⚠   ANTHROPIC_API_KEY not found in .env or environment."
        echo "      The app will launch but AI features require the key."
        echo "      Set it in .env:  ANTHROPIC_API_KEY=sk-ant-..."
        echo ""
    fi
fi

# ── Launch ────────────────────────────────────────────────────────
echo "  🚀  Launching InvestorIQ…"
echo "      → App will open at: http://localhost:8501"
echo "      → Press Ctrl+C to stop"
echo ""

exec streamlit run investor_app.py \
    --server.port 8501 \
    --server.headless false \
    --browser.gatherUsageStats false
