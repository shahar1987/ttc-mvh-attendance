#!/usr/bin/env bash
# Asks graphify's hook to point Claude at the graph; silent no-op until graphify is installed.
export PATH="$HOME/.local/bin:$PATH"
command -v graphify >/dev/null 2>&1 || exit 0
exec graphify hook-guard "$@"
