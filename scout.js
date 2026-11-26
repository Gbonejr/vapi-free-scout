// vAPI Free Scout — BUILD ON vAPI entry (free demo, $0 spent)
//
// What it does, using ONLY read-only tools of the local vAPI MCP server
// (`npx -y vapi-network mcp` over stdio):
//   1. wallet.address  -> the agent wallet's public address
//   2. wallet.balance  -> USDC balance on Base (read-only)
//   3. call.search     -> discover paid Call APIs by keyword (catalog data only,
//                         no API is called, no payment is made)
//   4. tasks.search    -> list open paid tasks on the vAPI task board
//   5. router.models / router.usage -> Router model list + usage (read-only)
//   6. auth.status     -> link status of the local account
//
// It never calls a paid tool (no call.pay, no router.chat, no router.buy),
// never signs anything, and never moves money. The vault password is only
// passed through the environment (VAPI_VAULT_PASSWORD) and never printed
// or stored by this script.
//
// Run:  ./run.sh            (reads the vault password file into the env)
//       or: VAPI_VAULT_PASSWORD=... node scout.js [keyword]
//
// Node.js >= 18, no dependencies.

const { spawn } = require("child_process");

const QUERY = process.argv[2] || "weather";
const TIMEOUT_MS = 30000;

const server = spawn("npx", ["-y", "vapi-network", "mcp"], {
  env: { ...process.env },
  stdio: ["pipe", "pipe", "pipe"],
});

let buf = "";
let nextId = 1;
const pending = new Map();

server.stdout.on("data", (d) => {
  buf += d.toString();
  const lines = buf.split("\n");
  buf = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve } = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg);
    }
  }
});
server.stderr.on("data", () => {}); // server chatter goes nowhere

function request(method, params) {
  const id = nextId++;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve({ error: { message: "timeout after " + TIMEOUT_MS + "ms" } });
      }
    }, TIMEOUT_MS);
    pending.set(id, {
      resolve: (msg) => {
        clearTimeout(timer);
        resolve(msg);
      },
    });
    server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

function notify(method) {
  server.stdin.write(JSON.stringify({ jsonrpc: "2.0", method }) + "\n");
}

async function callTool(name, args) {
  const msg = await request("tools/call", { name, arguments: args || {} });
  if (msg.error) return { ok: false, error: msg.error.message || JSON.stringify(msg.error) };
  const result = msg.result || {};
  if (result.isError) {
    const text = (result.content || []).map((c) => c.text || "").join("\n");
    return { ok: false, error: text.slice(0, 300) || "tool returned isError" };
  }
  const text = (result.content || []).map((c) => c.text || "").join("\n");
  return { ok: true, text };
}

function tryJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function section(title) {
  console.log("\n== " + title + " ==");
}

(async () => {
  // 1. Handshake
  const init = await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "vapi-free-scout", version: "1.0.0" },
  });
  notify("notifications/initialized");
  const serverInfo = (init.result && init.result.serverInfo) || {};
  console.log("vAPI Free Scout — BUILD ON vAPI demo (all calls free, $0 spent)");
  console.log("MCP server: " + (serverInfo.name || "?") + " v" + (serverInfo.version || "?"));

  const list = await request("tools/list", {});
  const tools = ((list.result || {}).tools || []).map((t) => t.name);
  const readOnly = ((list.result || {}).tools || [])
    .filter((t) => t.annotations && t.annotations.readOnlyHint)
    .map((t) => t.name);
  console.log("Tools exposed: " + tools.length + " (" + readOnly.length + " read-only)");

  // 2. Wallet (public address + balance, read-only)
  section("Wallet");
  const addr = await callTool("wallet.address", {});
  if (addr.ok) {
    const data = tryJson(addr.text);
    console.log("Address: " + ((data && (data.address || data.wallet)) || addr.text.slice(0, 120)));
  } else {
    console.log("wallet.address failed: " + addr.error);
  }
  const bal = await callTool("wallet.balance", {});
  if (bal.ok) {
    const data = tryJson(bal.text);
    if (data && data.balances) {
      for (const b of data.balances) {
        console.log("Balance: " + b.usdc + " USDC on " + (b.name || b.network));
      }
    } else {
      console.log("Balance: " + bal.text.slice(0, 200));
    }
  } else {
    console.log("wallet.balance failed: " + bal.error);
  }

  // 3. Discover paid Call APIs (catalog data only — nothing is called)
  section('Discover Call APIs (query: "' + QUERY + '")');
  const search = await callTool("call.search", { query: QUERY, limit: 5 });
  if (search.ok) {
    const data = tryJson(search.text);
    const items = (data && (data.items || data.results)) || null;
    if (items) {
      const total = data.totals && data.totals.items !== undefined ? data.totals.items : items.length;
      console.log("Listings found: " + total + " (showing " + Math.min(items.length, 5) + ")");
      for (const it of items.slice(0, 5)) {
        const card = it.card || it;
        const facts = ((card.facts || it.facts) || []).map((f) => f.label + " " + f.value).join(", ");
        console.log(" - " + (card.title || it.ref || "?") + " | " + facts);
      }
    } else {
      console.log(search.text.slice(0, 800));
    }
  } else {
    console.log("call.search failed: " + search.error);
  }

  // 4. Open tasks on the vAPI board (read-only)
  section("Open tasks (vAPI board)");
  const tasks = await callTool("tasks.search", { open: true, limit: 5 });
  if (tasks.ok) {
    const data = tryJson(tasks.text);
    const items = (data && (data.cards || data.items || data.tasks || data.results)) || null;
    if (items) {
      console.log("Open tasks found: " + items.length);
      for (const it of items.slice(0, 5)) {
        const gross = it.amount && it.amount.gross ? (Number(it.amount.gross) / 1e6).toFixed(2) : "?";
        console.log(" - " + (it.title || it.id || "?") + " | reward $" + gross + " " + ((it.amount && it.amount.asset) || "USDC") + " | deadline " + (it.deadlineAt || "?"));
      }
    } else {
      console.log(tasks.text.slice(0, 600));
    }
  } else {
    console.log("tasks.search failed: " + tasks.error);
  }

  // 5. Router (read-only; may be unreachable from some networks — reported as observed)
  section("Router");
  const models = await callTool("router.models", {});
  if (models.ok) {
    const data = tryJson(models.text);
    const list2 = (data && (data.models || data)) || null;
    console.log("router.models: " + (Array.isArray(list2) ? list2.length + " models" : models.text.slice(0, 300)));
  } else {
    console.log("router.models failed (observed): " + models.error);
  }
  const usage = await callTool("router.usage", {});
  if (usage.ok) {
    const data = tryJson(usage.text);
    if (data && data.compute) {
      const c = data.compute;
      console.log("router.usage: daily allowance $" + c.allowanceUsd + ", spent today $" + c.spentTodayUsd + ", resets " + c.resetsAt);
      if (data.stake) console.log("Stake: " + data.stake.stake + " vAPI");
    } else {
      console.log("router.usage: " + usage.text.slice(0, 300));
    }
  } else {
    console.log("router.usage failed (observed): " + usage.error);
  }

  // 6. Link status (read-only)
  section("Account link");
  const auth = await callTool("auth.status", {});
  if (auth.ok) {
    const data = tryJson(auth.text);
    if (data) {
      console.log("auth.status: linked=" + data.linked + ", scopes=[" + (data.scopes || []).join(", ") + "], router=" + data.router);
    } else {
      console.log("auth.status: " + auth.text.slice(0, 300));
    }
  } else {
    console.log("auth.status failed: " + auth.error);
  }

  console.log("\n== Summary ==");
  console.log("Paid tools called: 0");
  console.log("Money spent: $0.00");
  console.log("Done. No wallet was funded, nothing was signed, nothing was bought.");

  server.kill();
  process.exit(0);
})().catch((e) => {
  console.error("Scout error: " + (e && e.message));
  try {
    server.kill();
  } catch {}
  process.exit(1);
});
