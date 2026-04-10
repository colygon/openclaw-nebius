#!/bin/bash
curl -sf http://localhost:${PORT:-3001}/api/health > /dev/null 2>&1 || exit 1
