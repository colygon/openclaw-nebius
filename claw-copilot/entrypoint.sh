#!/bin/bash
set -e

echo "=== Claw Copilot ==="

# ── 1. Validate required env vars ──
if [ -z "${TOKEN_FACTORY_API_KEY:-}" ]; then
  echo "ERROR: TOKEN_FACTORY_API_KEY is required."
  echo "Get one at https://studio.nebius.ai/"
  exit 1
fi

echo "Token Factory API key: set"
echo "Model: ${NEBIUS_MODEL:-deepseek-ai/DeepSeek-V3.2}"

# ── 2. Configure nebius CLI auth (if service account key provided) ──
if [ -n "${NEBIUS_SERVICE_ACCOUNT_KEY:-}" ]; then
  echo "Configuring nebius CLI with service account..."

  # Write the private key
  echo "$NEBIUS_SERVICE_ACCOUNT_KEY" > /tmp/sa-key.pem
  chmod 600 /tmp/sa-key.pem

  # Write nebius config
  mkdir -p /root/.nebius
  cat > /root/.nebius/config.yaml <<EOF
current-profile: default
profiles:
  default:
    endpoint: api.nebius.cloud
    auth-type: service account
    service-account-id: ${NEBIUS_SERVICE_ACCOUNT_ID:-}
    public-key-id: ${NEBIUS_PUBLIC_KEY_ID:-}
    private-key-file-path: /tmp/sa-key.pem
    parent-id: ${NEBIUS_PROJECT_ID:-}
EOF

  echo "Nebius CLI configured with service account"
elif [ -n "${NEBIUS_IAM_TOKEN:-}" ]; then
  echo "Nebius IAM token provided (federation auth)"
else
  echo "WARNING: No nebius auth configured. CLI actions will fail."
  echo "Set NEBIUS_SERVICE_ACCOUNT_KEY + NEBIUS_SERVICE_ACCOUNT_ID + NEBIUS_PUBLIC_KEY_ID"
  echo "  or NEBIUS_IAM_TOKEN for federation auth."
fi

# ── 3. Start Next.js ──
echo "Starting claw-copilot on port ${PORT:-3001}..."
exec node server.js
