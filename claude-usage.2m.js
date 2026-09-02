#!/opt/homebrew/bin/node
// <xbar.title>Claude Code Usage Tracker</xbar.title>
// <xbar.version>v3.0</xbar.version>
// <xbar.desc>Shows real Claude plan limit usage (5h + weekly), other-device heuristic, and local cost stats</xbar.desc>
// <xbar.dependencies>node, ccusage</xbar.dependencies>
// <swiftbar.hideAbout>true</swiftbar.hideAbout>
// <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const CCUSAGE = "/opt/homebrew/bin/ccusage";
const STATE_FILE = path.join(__dirname, ".claude-usage-state.json");
const DASHBOARD_CONFIG_FILE = path.join(__dirname, ".claude-usage-dashboard.json");
const UTIL_JUMP_THRESHOLD = 5;
const LOCAL_QUIET_TOKENS = 1000;
const STATUS_TIMEOUT_MS = 6000;

const STATUS_RANK = {
  operational: 0,
  under_maintenance: 1,
  unknown: 1,
  degraded_performance: 2,
  partial_outage: 3,
  major_outage: 4,
};

const STATUS_LABEL = {
  operational: "Operational",
  under_maintenance: "Under maintenance",
  degraded_performance: "Degraded performance",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
  unknown: "Unknown",
};

const INDICATOR_STATUS = {
  none: "operational",
  maintenance: "under_maintenance",
  minor: "degraded_performance",
  major: "partial_outage",
  critical: "major_outage",
};

const STATUS_SOURCES = [
  {
    label: "Claude",
    url: "https://status.claude.com/api/v2/summary.json",
    tracks: (name) => name === "Claude Code" || name.startsWith("Claude API"),
  },
  {
    label: "Codex",
    url: "https://status.openai.com/api/v2/summary.json",
    tracks: (name) => name.includes("Codex"),
  },
];

function runCcusage(args) {
  try {
    const out = execFileSync(CCUSAGE, args, {
      encoding: "utf8",
      timeout: 60000,
      env: { ...process.env, PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin" },
    });
    return JSON.parse(out);
  } catch (e) {
    return null;
  }
}

function getAccessToken() {
  try {
    const raw = execFileSync("security", ["find-generic-password", "-s", "Claude Code-credentials", "-w"], {
      encoding: "utf8",
      timeout: 10000,
    });
    return JSON.parse(raw).claudeAiOauth.accessToken;
  } catch (e) {
    return null;
  }
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch (e) {
    return null;
  }
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch (e) {}
}

function loadDashboardConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(DASHBOARD_CONFIG_FILE, "utf8"));
    return cfg && cfg.url && cfg.secret ? cfg : null;
  } catch (e) {
    return null;
  }
}

async function pushSnapshot(snapshot) {
  const cfg = loadDashboardConfig();
  if (!cfg) return;
  try {
    await fetch(`${cfg.url.replace(/\/$/, "")}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ingest-secret": cfg.secret },
      body: JSON.stringify(snapshot),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {}
}

function getAccount() {
  try {
    const cfg = JSON.parse(require("fs").readFileSync(process.env.HOME + "/.claude.json", "utf8"));
    const a = cfg.oauthAccount;
    if (!a) return null;
    let plan = null;
    const tier = a.organizationRateLimitTier || "";
    const m = tier.match(/claude_(max|pro)(?:_(\d+x))?/);
    if (m) plan = "Claude " + m[1][0].toUpperCase() + m[1].slice(1) + (m[2] ? " " + m[2] : "");
    else if (a.organizationType) plan = a.organizationType.replace(/_/g, " ");
    return { name: a.displayName, email: a.emailAddress, plan };
  } catch (e) {
    return null;
  }
}

async function getPlanUsage(token) {
  try {
    const res = await fetch("https://api.anthropic.com/api/oauth/usage", {
      headers: {
        Authorization: `Bearer ${token}`,
        "anthropic-beta": "oauth-2025-04-20",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json();
  } catch (e) {
    return { error: e.message };
  }
}

function normalizeStatus(value) {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(STATUS_RANK, value)
    ? value
    : "unknown";
}

function statusRank(status) {
  const rank = STATUS_RANK[status];
  return typeof rank === "number" ? rank : 1;
}

function statusColor(status) {
  const rank = statusRank(status);
  if (rank >= 4) return "red";
  if (rank >= 2) return "orange";
  if (rank >= 1) return "gray";
  return "#34C759";
}

async function getServiceStatus(source) {
  try {
    const res = await fetch(source.url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
    });
    if (!res.ok) return { label: source.label, ok: false, reason: `status page returned ${res.status}` };

    const body = await res.json();
    const components = (body && Array.isArray(body.components) ? body.components : [])
      .filter((c) => c && typeof c.name === "string" && source.tracks(c.name))
      .map((c) => ({ name: c.name, status: normalizeStatus(c.status) }))
      .sort((a, b) => statusRank(b.status) - statusRank(a.status));

    const page = (body && body.status) || {};
    const description = typeof page.description === "string" ? page.description : "";
    const status = components.length
      ? components.reduce((worst, c) => (statusRank(c.status) > statusRank(worst) ? c.status : worst), "operational")
      : INDICATOR_STATUS[page.indicator] || "unknown";

    return { label: source.label, ok: true, status, description, components };
  } catch (e) {
    return {
      label: source.label,
      ok: false,
      reason: e && e.name === "TimeoutError" ? "status page timed out" : "status page unreachable",
    };
  }
}

function serviceStatusLines(service) {
  if (!service.ok) {
    return [`${service.label}: unavailable | color=gray`, `${service.reason} | color=gray size=11`];
  }

  const out = [`${service.label}: ${STATUS_LABEL[service.status]} | color=${statusColor(service.status)}`];
  const flagged = service.components.filter((c) => statusRank(c.status) > 0);

  if (flagged.length) {
    for (const c of flagged) out.push(`${c.name} — ${STATUS_LABEL[c.status]} | color=gray size=11`);
  } else if (service.description) {
    out.push(`${service.description} | color=gray size=11`);
  }

  return out;
}

function money(n) {
  if (n == null || isNaN(n)) return "$0.00";
  return "$" + n.toFixed(2);
}

function tokens(n) {
  if (n == null || isNaN(n)) return "0";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}

function ymd(d) {
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function bar(pct) {
  const filled = Math.min(10, Math.round(pct / 10));
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

function pctColor(pct) {
  if (pct >= 80) return "red";
  if (pct >= 50) return "orange";
  return "#34C759";
}

function resetLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (ymd(d) === ymd(now)) return `resets ${time}`;
  const day = d.toLocaleDateString([], { weekday: "short" });
  return `resets ${day} ${time}`;
}

async function main() {
  const now = new Date();
  const todayStr = ymd(now);
  const monthPrefix = todayStr.slice(0, 7);
  const weekAgo = new Date(now.getTime() - 6 * 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const since = new Date(now.getTime() - 29 * 86400000);
  const sinceArg = ymd(since).replace(/-/g, "");

  const token = getAccessToken();
  const [plan, dailyData, blocksData, services] = await Promise.all([
    token ? getPlanUsage(token) : Promise.resolve({ error: "no token" }),
    Promise.resolve(runCcusage(["daily", "--json", "--since", sinceArg])),
    Promise.resolve(runCcusage(["blocks", "--active", "--json"])),
    Promise.all(STATUS_SOURCES.map(getServiceStatus)),
  ]);

  const activeBlock = ((blocksData && blocksData.blocks) || []).find((b) => b.isActive && !b.isGap);

  const rows = ((dailyData && dailyData.daily) || []).filter((r) => !r.agent || r.agent === "all");
  const sum = (list, f) => list.reduce((a, r) => a + (r[f] || 0), 0);
  const todayRows = rows.filter((r) => r.period === todayStr);
  const weekRows = rows.filter((r) => r.period >= ymd(weekAgo) && r.period <= todayStr);
  const monthRows = rows.filter((r) => r.period && r.period.startsWith(monthPrefix));

  const lines = [];
  let title;
  let anomaly = { status: "unknown", message: "plan usage unavailable" };

  if (plan && !plan.error) {
    const fh = plan.five_hour || {};
    const sd = plan.seven_day || {};
    const fhPct = Math.round(fh.utilization || 0);
    const sdPct = Math.round(sd.utilization || 0);

    title = `✳ ${fhPct}% · wk ${sdPct}%`;

    anomaly = { status: "unknown", message: "no active session" };
    if (activeBlock) {
      const blockId = activeBlock.id || activeBlock.startTime;
      const curLocalTokens = activeBlock.totalTokens || 0;
      const prev = loadState();

      if (prev && prev.blockId === blockId) {
        const dUtil = fhPct - prev.util5h;
        const dLocalTokens = curLocalTokens - prev.localTokens5h;
        anomaly =
          dUtil >= UTIL_JUMP_THRESHOLD && dLocalTokens <= LOCAL_QUIET_TOKENS
            ? { status: "flag", message: `+${dUtil}% quota, only +${tokens(Math.max(0, dLocalTokens))} tok here — check other devices` }
            : { status: "clean", message: "quota use matches local activity" };
      } else {
        anomaly = { status: "baseline", message: "building other-device baseline" };
      }

      saveState({ blockId, util5h: fhPct, localTokens5h: curLocalTokens, ts: Date.now() });
    }

    const anomalyLine =
      anomaly.status === "flag"
        ? `⚠ ${anomaly.message} | color=orange size=11`
        : anomaly.status === "clean"
          ? `✓ ${anomaly.message} | color=gray size=11`
          : anomaly.status === "baseline"
            ? `Building other-device baseline… | color=gray size=11`
            : null;

    lines.push("Plan Limits | size=13");
    lines.push(`Session (5h): ${bar(fhPct)} ${fhPct}% | font=Menlo color=${pctColor(fhPct)}`);
    lines.push(`${resetLabel(fh.resets_at)} | color=gray size=11`);
    if (anomalyLine) lines.push(anomalyLine);
    lines.push(`Week (all):   ${bar(sdPct)} ${sdPct}% | font=Menlo color=${pctColor(sdPct)}`);
    lines.push(`${resetLabel(sd.resets_at)} | color=gray size=11`);

    for (const l of plan.limits || []) {
      if (l.kind === "weekly_scoped" && l.scope && l.scope.model) {
        const name = l.scope.model.display_name || "model";
        const p = Math.round(l.percent || 0);
        lines.push(`Week (${name}): ${bar(p)} ${p}% | font=Menlo color=${pctColor(p)}`);
      }
    }
  } else {
    title = "✳ ⚠︎";
    lines.push("Plan Limits | size=13");
    lines.push(`Could not fetch plan usage (${(plan && plan.error) || "unknown"}) | color=red size=11`);
    lines.push("Open Claude Code once to refresh login, then refresh. | color=gray size=11");
  }

  lines.push("---");
  lines.push("Service Status | size=13");
  for (const service of services) lines.push(...serviceStatusLines(service));

  const worstServiceRank = services.reduce(
    (worst, s) => Math.max(worst, s.ok ? statusRank(s.status) : 0),
    0
  );
  if (worstServiceRank >= 3) title = `⛔ ${title}`;
  else if (worstServiceRank >= 1) title = `⚠ ${title}`;

  console.log(title);
  console.log("---");

  const account = getAccount();
  if (account) {
    console.log(`${account.name || "Account"}${account.plan ? " — " + account.plan : ""} | size=13`);
    console.log(`${account.email} | color=gray size=11`);
    console.log("---");
  }

  lines.forEach((l) => console.log(l));

  if (dailyData) {
    console.log("---");
    console.log(`Local Cost Estimates | size=13`);
    console.log(`Today: ${money(sum(todayRows, "totalCost"))}  ·  ${tokens(sum(todayRows, "totalTokens"))} tok`);
    console.log(`Last 7 days: ${money(sum(weekRows, "totalCost"))}  ·  ${tokens(sum(weekRows, "totalTokens"))} tok`);
    console.log(`Month (${monthPrefix}): ${money(sum(monthRows, "totalCost"))}  ·  ${tokens(sum(monthRows, "totalTokens"))} tok`);
  }

  console.log("---");
  console.log("Refresh now | refresh=true");

  const fh = (plan && !plan.error && plan.five_hour) || {};
  const sd = (plan && !plan.error && plan.seven_day) || {};
  const byModel = ((plan && !plan.error && plan.limits) || [])
    .filter((l) => l.kind === "weekly_scoped" && l.scope && l.scope.model)
    .map((l) => ({ name: l.scope.model.display_name || "model", pct: Math.round(l.percent || 0) }));

  await pushSnapshot({
    machine: os.hostname(),
    account,
    fiveHour: { pct: Math.round(fh.utilization || 0), resetsAt: fh.resets_at || null },
    week: { pct: Math.round(sd.utilization || 0), resetsAt: sd.resets_at || null, byModel },
    anomaly,
    costs: {
      today: sum(todayRows, "totalCost"),
      todayTokens: sum(todayRows, "totalTokens"),
      week: sum(weekRows, "totalCost"),
      weekTokens: sum(weekRows, "totalTokens"),
      month: sum(monthRows, "totalCost"),
      monthTokens: sum(monthRows, "totalTokens"),
    },
    dailyHistory: rows
      .slice()
      .sort((a, b) => (a.period < b.period ? -1 : 1))
      .map((r) => ({ date: r.period, cost: r.totalCost, tokens: r.totalTokens })),
  });
}

main();
