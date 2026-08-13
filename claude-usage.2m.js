#!/opt/homebrew/bin/node
// <xbar.title>Claude Code Usage Tracker</xbar.title>
// <xbar.version>v2.0</xbar.version>
// <xbar.desc>Shows real Claude plan limit usage (5h + weekly) plus local cost stats</xbar.desc>
// <xbar.dependencies>node, ccusage</xbar.dependencies>
// <swiftbar.hideAbout>true</swiftbar.hideAbout>
// <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>

const { execFileSync } = require("child_process");

const CCUSAGE = "/opt/homebrew/bin/ccusage";

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
  const since = weekAgo < monthStart ? weekAgo : monthStart;
  const sinceArg = ymd(since).replace(/-/g, "");

  const token = getAccessToken();
  const [plan, dailyData] = await Promise.all([
    token ? getPlanUsage(token) : Promise.resolve({ error: "no token" }),
    Promise.resolve(runCcusage(["daily", "--json", "--since", sinceArg])),
  ]);

  const rows = ((dailyData && dailyData.daily) || []).filter((r) => !r.agent || r.agent === "all");
  const sum = (list, f) => list.reduce((a, r) => a + (r[f] || 0), 0);
  const todayRows = rows.filter((r) => r.period === todayStr);
  const weekRows = rows.filter((r) => r.period >= ymd(weekAgo) && r.period <= todayStr);
  const monthRows = rows.filter((r) => r.period && r.period.startsWith(monthPrefix));

  const lines = [];
  let title;

  if (plan && !plan.error) {
    const fh = plan.five_hour || {};
    const sd = plan.seven_day || {};
    const fhPct = Math.round(fh.utilization || 0);
    const sdPct = Math.round(sd.utilization || 0);

    title = `✳ ${fhPct}% · wk ${sdPct}%`;

    lines.push("Plan Limits | size=13");
    lines.push(`Session (5h): ${bar(fhPct)} ${fhPct}% | font=Menlo color=${pctColor(fhPct)}`);
    lines.push(`${resetLabel(fh.resets_at)} | color=gray size=11`);
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
}

main();
