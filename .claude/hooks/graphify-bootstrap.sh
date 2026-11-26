#!/usr/bin/env bash
# Installs graphify if missing and rebuilds this repo's code graph (no LLM, no API key).
# Runs in the background so the session starts right away.
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0
export PATH="$HOME/.local/bin:$PATH"
(
  if ! command -v graphify >/dev/null 2>&1; then
    if command -v uv >/dev/null 2>&1; then
      uv tool install --quiet "graphifyy>=0.9.115"
    else
      pip install --quiet --user --break-system-packages "graphifyy>=0.9.115"
    fi
  fi
  graphify extract . --code-only && graphify cluster-only . --no-label --no-viz
) >/tmp/graphify-bootstrap.log 2>&1 &
exit 0
