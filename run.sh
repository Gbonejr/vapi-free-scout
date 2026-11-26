#!/bin/bash
# vAPI Free Scout — run the demo.
# Reads the vault password from the local password file into the environment
# (never prints it) and runs scout.js. No payment, no signing.
set -e
cd "$(dirname "$0")"
export VAPI_VAULT_PASSWORD=$(cat ~/workspace/wallets/vapi-vault-password.txt)
node scout.js "${1:-weather}"
