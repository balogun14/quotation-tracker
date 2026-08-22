#!/bin/sh
set -e

case "${1:-api}" in
  api)
    exec node dist/index.js
    ;;
  worker)
    exec node dist/worker.js
    ;;
  *)
    echo "Unknown command '$1'. Use 'api' or 'worker'." >&2
    exit 1
    ;;
esac
