#!/opt/homebrew/bin/node
// <xbar.title>Claude Code Usage Tracker</xbar.title>
// <xbar.version>v3.1</xbar.version>
// <xbar.desc>Shows real Claude plan limit usage (5h + weekly), other-device heuristic, and local cost stats</xbar.desc>
// <xbar.dependencies>node, ccusage</xbar.dependencies>
// <swiftbar.hideAbout>true</swiftbar.hideAbout>
// <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>

const { execFile, execFileSync } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("fs");
const path = require("path");
const os = require("os");

const execFileAsync = promisify(execFile);

const CCUSAGE = "/opt/homebrew/bin/ccusage";
const STATE_FILE = path.join(__dirname, ".claude-usage-state.json");
const CACHE_FILE = path.join(__dirname, ".claude-usage-cache.json");
const DASHBOARD_CONFIG_FILE = path.join(__dirname, ".claude-usage-dashboard.json");
const CODEX_AUTH_FILE = path.join(os.homedir(), ".codex", "auth.json");
const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const UTIL_JUMP_THRESHOLD = 5;
const LOCAL_QUIET_TOKENS = 1000;
const STATUS_TIMEOUT_MS = 6000;
const USAGE_TIMEOUT_MS = 15000;
const CCUSAGE_TIMEOUT_MS = 45000;
const CCUSAGE_BUDGET_MS = 45000;
const FETCH_BUDGET_MS = 30000;
const CCUSAGE_MAX_BUFFER = 64 * 1024 * 1024;
const RETRY_DELAYS_MS = [500, 1500];

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function settleWithin(promise, ms, fallback) {
  let timer;
  const guard = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
    if (typeof timer.unref === "function") timer.unref();
  });
  const settled = Promise.resolve(promise).then(
    (value) => {
      clearTimeout(timer);
      return value;
    },
    () => {
      clearTimeout(timer);
      return fallback;
    }
  );
  return Promise.race([settled, guard]);
}

async function withRetry(attempt, deadline) {
  let last = await attempt();
  for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
    if (last.ok || !last.retry) return last;
    if (Date.now() + RETRY_DELAYS_MS[i] >= deadline) return last;
    await sleep(RETRY_DELAYS_MS[i]);
    last = await attempt();
  }
  return last;
}

function classifyResponse(status) {
  if (status === 401) return { retry: false, auth: true };
  return { retry: status >= 500 || status === 408 || status === 429, auth: false };
}

async function runCcusage(args) {
  try {
    const { stdout } = await execFileAsync(CCUSAGE, args, {
      encoding: "utf8",
      timeout: CCUSAGE_TIMEOUT_MS,
      maxBuffer: CCUSAGE_MAX_BUFFER,
      env: { ...process.env, PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin" },
    });
    return JSON.parse(stdout);
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

function loadCache() {
  try {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    return cache && typeof cache === "object" ? cache : {};
  } catch (e) {
    return {};
  }
}

function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch (e) {}
}

function resolveWithCache(result, entry) {
  if (result.ok) return { data: result.data, stale: false, ageMs: 0, error: null, auth: false };
  if (!result.auth && entry && entry.data) {
    return {
      data: entry.data,
      stale: true,
      ageMs: Math.max(0, Date.now() - (entry.ts || 0)),
      error: result.error,
      auth: false,
    };
  }
  return { data: null, stale: false, ageMs: 0, error: result.error, auth: !!result.auth };
}

function staleNote(ageMs) {
  const mins = Math.max(1, Math.round(ageMs / 60000));
  if (mins < 60) return `stale · updated ${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `stale · updated ${hours}h ago`;
  return `stale · updated ${Math.round(hours / 24)}d ago`;
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

async function fetchPlanUsageOnce(token) {
  try {
    const res = await fetch("https://api.anthropic.com/api/oauth/usage", {
      headers: {
        Authorization: `Bearer ${token}`,
        "anthropic-beta": "oauth-2025-04-20",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(USAGE_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, ...classifyResponse(res.status) };
    return { ok: true, data: await res.json() };
  } catch (e) {
    return { ok: false, error: e.message, retry: true, auth: false };
  }
}

function getPlanUsage(token, deadline) {
  return withRetry(() => fetchPlanUsageOnce(token), deadline);
}

function getCodexAuth() {
  try {
    const tokens = JSON.parse(fs.readFileSync(CODEX_AUTH_FILE, "utf8")).tokens;
    if (!tokens || !tokens.access_token) return null;
    return { token: tokens.access_token, accountId: tokens.account_id || "" };
  } catch (e) {
    return null;
  }
}

async function fetchCodexUsageOnce(auth) {
  try {
    const res = await fetch(CODEX_USAGE_URL, {
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "chatgpt-account-id": auth.accountId,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(USAGE_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, ...classifyResponse(res.status) };
    return { ok: true, data: await res.json() };
  } catch (e) {
    return { ok: false, error: e.message, retry: true, auth: false };
  }
}

function getCodexUsage(auth, deadline) {
  return withRetry(() => fetchCodexUsageOnce(auth), deadline);
}

function codexWindowName(seconds) {
  if (!seconds || !isFinite(seconds) || seconds <= 0) return "Window";
  if (seconds < 86400) return `Session (${Math.round(seconds / 3600)}h)`;
  if (seconds === 604800) return "Week";
  return `${Math.round(seconds / 86400)} days`;
}

function codexWindows(rateLimit) {
  return [rateLimit && rateLimit.primary_window, rateLimit && rateLimit.secondary_window].filter(
    (w) => w && typeof w.used_percent === "number" && w.limit_window_seconds > 0
  );
}

function normalizeCodexUsage(raw) {
  if (!raw || raw.error) return null;

  const windows = codexWindows(raw.rate_limit).map((w) => ({
    seconds: w.limit_window_seconds,
    pct: Math.round(w.used_percent),
    resetsAt: w.reset_at ? new Date(w.reset_at * 1000).toISOString() : null,
    byLimit: [],
  }));

  for (const extra of raw.additional_rate_limits || []) {
    const name = extra.limit_name || extra.metered_feature;
    if (!name) continue;
    for (const w of codexWindows(extra.rate_limit)) {
      const target = windows.find((entry) => entry.seconds === w.limit_window_seconds);
      if (target) target.byLimit.push({ name, pct: Math.round(w.used_percent) });
    }
  }

  windows.sort((a, b) => a.seconds - b.seconds);

  return {
    plan: typeof raw.plan_type === "string" ? raw.plan_type : null,
    email: typeof raw.email === "string" ? raw.email : null,
    windows,
  };
}

function codexLines(auth, resolved, normalized) {
  const lines = ["Codex Plan Limits | size=13"];

  if (!auth) {
    lines.push("Codex CLI is not signed in on this machine. | color=gray size=11");
    return lines;
  }

  if (!normalized) {
    lines.push(`Could not fetch Codex usage (${resolved.error || "unknown"}) | color=red size=11`);
    lines.push("Run codex once to refresh login, then refresh. | color=gray size=11");
    return lines;
  }

  if (resolved.stale) lines.push(`${staleNote(resolved.ageMs)} | color=gray size=11`);

  if (normalized.windows.length === 0) {
    lines.push("Codex reported no rate limit windows. | color=gray size=11");
    return lines;
  }

  const width = Math.max(...normalized.windows.map((w) => codexWindowName(w.seconds).length));

  for (const window of normalized.windows) {
    const name = `${codexWindowName(window.seconds)}:`.padEnd(width + 1);
    lines.push(`${name} ${bar(window.pct)} ${window.pct}% | font=Menlo color=${pctColor(window.pct, resolved.stale)}`);
    lines.push(`${resetLabel(window.resetsAt)} | color=gray size=11`);
    for (const limit of window.byLimit) {
      lines.push(`${limit.name}: ${bar(limit.pct)} ${limit.pct}% | font=Menlo color=${pctColor(limit.pct, resolved.stale)}`);
    }
  }

  return lines;
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

async function fetchServiceStatusOnce(source) {
  try {
    const res = await fetch(source.url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `status page returned ${res.status}`,
        ...classifyResponse(res.status),
      };
    }
    return { ok: true, data: await res.json() };
  } catch (e) {
    return {
      ok: false,
      error: e && e.name === "TimeoutError" ? "status page timed out" : "status page unreachable",
      retry: true,
      auth: false,
    };
  }
}

async function getServiceStatus(source, deadline) {
  const result = await withRetry(() => fetchServiceStatusOnce(source), deadline);
  if (!result.ok) return { label: source.label, ok: false, reason: result.error };

  const body = result.data;
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

function pctColor(pct, stale) {
  if (stale) return "gray";
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
  const deadline = Date.now() + FETCH_BUDGET_MS;

  const token = getAccessToken();
  const codexAuth = getCodexAuth();
  const cache = loadCache();

  const [planResult, codexResult, dailyData, blocksData, services] = await Promise.all([
    settleWithin(
      token ? getPlanUsage(token, deadline) : Promise.resolve({ ok: false, error: "no token", auth: true }),
      FETCH_BUDGET_MS,
      { ok: false, error: "The operation was aborted due to timeout", auth: false }
    ),
    settleWithin(
      codexAuth
        ? getCodexUsage(codexAuth, deadline)
        : Promise.resolve({ ok: false, error: "not signed in", auth: true }),
      FETCH_BUDGET_MS,
      { ok: false, error: "The operation was aborted due to timeout", auth: false }
    ),
    settleWithin(runCcusage(["daily", "--json", "--since", sinceArg]), CCUSAGE_BUDGET_MS, null),
    settleWithin(runCcusage(["blocks", "--active", "--json"]), CCUSAGE_BUDGET_MS, null),
    settleWithin(
      Promise.all(STATUS_SOURCES.map((s) => getServiceStatus(s, deadline))),
      FETCH_BUDGET_MS,
      STATUS_SOURCES.map((s) => ({ label: s.label, ok: false, reason: "status page timed out" }))
    ),
  ]);

  const claude = resolveWithCache(planResult, cache.claude);
  const codexResolved = resolveWithCache(codexResult, cache.codex);

  if (planResult.ok || codexResult.ok) {
    const next = { ...cache };
    if (planResult.ok) next.claude = { data: planResult.data, ts: Date.now() };
    if (codexResult.ok) next.codex = { data: codexResult.data, ts: Date.now() };
    saveCache(next);
  }

  const plan = claude.data;
  const codex = normalizeCodexUsage(codexResolved.data);

  const activeBlock = ((blocksData && blocksData.blocks) || []).find((b) => b.isActive && !b.isGap);

  const rows = ((dailyData && dailyData.daily) || []).filter((r) => !r.agent || r.agent === "all");
  const sum = (list, f) => list.reduce((a, r) => a + (r[f] || 0), 0);
  const todayRows = rows.filter((r) => r.period === todayStr);
  const weekRows = rows.filter((r) => r.period >= ymd(weekAgo) && r.period <= todayStr);
  const monthRows = rows.filter((r) => r.period && r.period.startsWith(monthPrefix));

  const lines = [];
  let title;
  let anomaly = { status: "unknown", message: "plan usage unavailable" };

  if (plan) {
    const fh = plan.five_hour || {};
    const sd = plan.seven_day || {};
    const fhPct = Math.round(fh.utilization || 0);
    const sdPct = Math.round(sd.utilization || 0);

    title = claude.stale ? `✳ ${fhPct}% · wk ${sdPct}% ⏳` : `✳ ${fhPct}% · wk ${sdPct}%`;

    if (!claude.stale) {
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
    if (claude.stale) lines.push(`${staleNote(claude.ageMs)} | color=gray size=11`);
    lines.push(`Session (5h): ${bar(fhPct)} ${fhPct}% | font=Menlo color=${pctColor(fhPct, claude.stale)}`);
    lines.push(`${resetLabel(fh.resets_at)} | color=gray size=11`);
    if (anomalyLine) lines.push(anomalyLine);
    lines.push(`Week (all):   ${bar(sdPct)} ${sdPct}% | font=Menlo color=${pctColor(sdPct, claude.stale)}`);
    lines.push(`${resetLabel(sd.resets_at)} | color=gray size=11`);

    for (const l of plan.limits || []) {
      if (l.kind === "weekly_scoped" && l.scope && l.scope.model) {
        const name = l.scope.model.display_name || "model";
        const p = Math.round(l.percent || 0);
        lines.push(`Week (${name}): ${bar(p)} ${p}% | font=Menlo color=${pctColor(p, claude.stale)}`);
      }
    }
  } else {
    title = "✳ ⚠︎";
    lines.push("Plan Limits | size=13");
    lines.push(`Could not fetch plan usage (${claude.error || "unknown"}) | color=red size=11`);
    lines.push("Open Claude Code once to refresh login, then refresh. | color=gray size=11");
  }

  lines.push("---");
  lines.push(...codexLines(codexAuth, codexResolved, codex));

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

  const fh = (plan && plan.five_hour) || {};
  const sd = (plan && plan.seven_day) || {};
  const byModel = ((plan && plan.limits) || [])
    .filter((l) => l.kind === "weekly_scoped" && l.scope && l.scope.model)
    .map((l) => ({ name: l.scope.model.display_name || "model", pct: Math.round(l.percent || 0) }));

  await pushSnapshot({
    machine: os.hostname(),
    account,
    fiveHour: { pct: Math.round(fh.utilization || 0), resetsAt: fh.resets_at || null },
    week: { pct: Math.round(sd.utilization || 0), resetsAt: sd.resets_at || null, byModel },
    codex,
    anomaly,
    stale: claude.stale || codexResolved.stale,
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
