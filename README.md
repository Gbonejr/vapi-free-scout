# vAPI Free Scout — BUILD ON vAPI entry

A tiny, free demo built **with the vAPI MCP**. It talks to the local vAPI MCP
server (`npx -y vapi-network mcp`) over stdio and only ever calls **read-only**
tools. No payment, no signing, no funding. Total cost: **$0.00**.

## What it does

`scout.js` (Node.js, zero dependencies) connects to the local MCP server and:

1. `wallet.address` — shows the agent wallet's public address
2. `wallet.balance` — shows the USDC balance on Base
3. `call.search` — discovers paid Call APIs by keyword (catalog data only,
   nothing is called, nothing is paid)
4. `tasks.search` — lists open paid tasks on the vAPI task board
5. `router.models` / `router.usage` — Router model list and usage (read-only)
6. `auth.status` — link status of the local account

It deliberately never touches a paid tool: no `call.pay`, no `router.chat`,
no `router.buy`, no staking, no top-up.

## Run it

```bash
./run.sh            # discover "weather" APIs (default)
./run.sh crypto     # discover APIs about "crypto"
```

`run.sh` reads the vault password from your local password file into the
environment only, and never prints or stores it. Or run directly:

```bash
VAPI_VAULT_PASSWORD=... node scout.js weather
```

Requires Node.js 18+ and `vapi-network` (run via `npx`, no install needed).

## Use the MCP server in your own client

Add `mcp.json` to Claude Code, Cursor, or any MCP client:

```json
{
  "mcpServers": {
    "vapi": { "command": "npx", "args": ["-y", "vapi-network", "mcp"] }
  }
}
```

Unlock the vault once first (`vapi unlock` in a terminal, lasts 8 hours) or
set `VAPI_VAULT_PASSWORD` in your shell. Never put the password in the config.

## Observed result (26 Nov 2026, wallet `0xfdcB...5bac`)

See `sample-output.txt` for the full run. In short:

- MCP server `@vapi-network/mcp` v0.16.0, **75 tools exposed (29 read-only)**
- Wallet `0xfdcB176Eb2F8799b529bEaa22425E670e17a5bac`, **0 USDC on Base**
- `call.search "weather"`: **12 listings**, cheapest $0.001/call
- `call.search "crypto"`: **55 listings** (Nansen $0.01, Kaito $0.60,
  LI.FI $0.001, CoinGecko $0.005, Messari $0.25)
- `tasks.search`: 3 open tasks on the board (small test tasks, $0.01 each)
- `router.models`: **175 models** available
- `router.usage`: daily Compute allowance **$1.00, spent $0 today**,
  resets 2026-11-27 00:00 UTC; stake 0 vAPI
- `auth.status`: linked, scopes `mcp:call, router.use, tasks:read, tasks:write`
- Paid tools called: **0**. Money spent: **$0.00**.

Note: `vapi router models` / `vapi router usage` fail when run through the
plain CLI from this environment, but the same calls succeed through the MCP
server — that is why the demo goes through MCP.

## Files

- `scout.js` — the demo (Node stdlib only)
- `run.sh` — runner wrapper
- `mcp.json` — MCP client config (no secrets inside)
- `sample-output.txt` — real output of a verification run
