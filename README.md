# Claude Usage Tracker (macOS Menu Bar)

![Platform](https://img.shields.io/badge/platform-macOS-black?logo=apple)
![License](https://img.shields.io/badge/license-MIT-green)
![SwiftBar](https://img.shields.io/badge/built%20for-SwiftBar-orange)

A SwiftBar plugin that shows your **real Claude Code plan usage** in the macOS menu bar — the same numbers as the `/usage` command inside Claude Code.

<p align="center">
  <img src="docs/screenshot.png" width="380" alt="Claude Usage Tracker dropdown">
</p>

## What it shows

**Menu bar:** `✳ 6% · wk 15%` — current 5-hour session usage and weekly usage.

**Dropdown (click the icon):**

```
Abhijeet — Claude Max 20x
you@example.com
─────────────────────────
Plan Limits
Session (5h): █░░░░░░░░░ 6%    resets 4:00 PM
✓ quota use matches local activity
Week (all):   ██░░░░░░░░ 15%   resets Tue 8:30 AM
Week (Opus):  █░░░░░░░░░ 5%
─────────────────────────
Local Cost Estimates
Today:        $4.88  ·  1.9M tok
Last 7 days:  $54.67 ·  29.5M tok
Month:        $97.80 ·  88.3M tok
─────────────────────────
Refresh now
```

### Other-device heuristic

Since Anthropic doesn't expose a per-device or per-session usage breakdown for individual Max/Pro accounts (only Team/Enterprise admins get that), the tracker uses an honest proxy signal instead: on every refresh it compares how much your account's 5-hour quota moved against how many tokens *this machine* logged in that same window.

- **Quota jumps while this machine stayed quiet** → `⚠ +N% quota, only +X tok here — check other devices` (orange) — a real signal something else consumed quota without local activity here
- **Quota movement matches local activity** → `✓ quota use matches local activity` (gray) — normal, expected
- **Right after install / a new 5h block starts** → `Building other-device baseline…` — needs one more refresh cycle to have something to compare against

This is a heuristic, not proof — treat a warning as "go check `claude.ai/settings/claude-code` and your active sessions page," not a certainty.

Progress bars turn **orange at 50%** and **red at 80%**. Refreshes every 2 minutes.

## Requirements

- macOS with [Homebrew](https://brew.sh)
- [Claude Code](https://claude.com/claude-code) installed and **logged in at least once** (the tracker reuses its login)

## Install

```bash
git clone https://github.com/AnkitPorwal04/claude-usage-tracker.git
cd claude-usage-tracker
./install.sh
```

The script installs anything missing (Node, [ccusage](https://ccusage.com), [SwiftBar](https://swiftbar.app)), copies the plugin to `~/.swiftbar-plugins/`, points SwiftBar at that folder, and launches it.

> **First run:** macOS will ask permission to read the `Claude Code-credentials` Keychain item. Click **Always Allow**.

### Manual install

If you'd rather not run the script:

```bash
brew install node
brew install --cask swiftbar
npm install -g ccusage

mkdir -p ~/.swiftbar-plugins
cp claude-usage.2m.js ~/.swiftbar-plugins/
chmod +x ~/.swiftbar-plugins/claude-usage.2m.js
defaults write com.ameba.SwiftBar PluginDirectory "$HOME/.swiftbar-plugins"
open -a SwiftBar
```

On Intel Macs, edit the first line of the plugin and the `CCUSAGE` constant to match your paths (`which node` / `which ccusage`) — the install script does this automatically.

## How it works

| Data | Source |
|---|---|
| Plan limit percentages & reset times | Anthropic OAuth usage API (`api.anthropic.com/api/oauth/usage`), authenticated with the Claude Code token stored in your macOS Keychain |
| Account name / email / plan | `~/.claude.json` |
| Cost & token estimates | [ccusage](https://ccusage.com) reading local Claude Code logs in `~/.claude/projects` |

By default, nothing is sent anywhere except the single authenticated request to Anthropic's own API. Cost figures are *estimates* at API pricing — on Max/Pro plans treat them as "value used", not a bill. (If you set up the optional [web dashboard](#web-dashboard) below, the plugin additionally pushes a usage snapshot to your own private deployment — see that section for exactly what's sent.)

## Customizing

- **Refresh interval:** rename the file — `claude-usage.30s.js` (30 sec), `claude-usage.5m.js` (5 min), etc.
- **Start at login:** SwiftBar menu bar icon → Preferences → *Launch at Login*.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `✳ ⚠︎` in the menu bar | Your Claude Code token expired — open Claude Code once, then click *Refresh now*. |
| No icon appears | Check SwiftBar is running and its plugin folder is `~/.swiftbar-plugins` (SwiftBar → Preferences → Plugin Folder). |
| Keychain prompt loops | Open Keychain Access, find `Claude Code-credentials`, and grant SwiftBar/node access, or click *Always Allow* on the prompt. |
| Costs show $0.00 | You haven't used Claude Code on this machine yet, or logs live elsewhere (`ccusage daily` should show data). |

## Web Dashboard

Want the same data as a real webpage (e.g. to check from your phone), instead of just the menu bar? The `dashboard/` folder is a self-contained Next.js app you deploy to your own **free** Vercel + Upstash account. It's password-protected — your usage data and account email are never public.

### Why a separate deployment is needed

A public webpage can't reach into your Mac's Keychain or read local files — those only exist on your machine. So the architecture is:

1. **This Mac** computes the same snapshot as the menu bar (account info, 5h/weekly %, costs, 30-day history) every 2 minutes and **pushes** it to your deployment.
2. **Your Vercel deployment** stores the latest snapshot in Upstash Redis and serves it only to whoever knows your dashboard password.
3. **Multi-laptop ready**: each machine pushes under its own hostname, so if you later run the plugin on a second Mac, the dashboard automatically shows both as separate cards — no extra setup needed.

### One-time setup (~10 minutes, $0)

1. **Create a free Upstash Redis database** — sign up at [console.upstash.com](https://console.upstash.com) (no card required), create a Redis database on the Free plan, and copy its `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from the REST API tab.
   > Skip the Vercel Marketplace "Upstash" integration button for this — it routes through a paid-plan picker. Signing up directly at upstash.com and pasting the two values into Vercel's env vars (next step) is the free path and works identically.
2. **Deploy to Vercel**:
   ```bash
   cd dashboard
   npm install -g vercel   # if you don't have it
   vercel login
   vercel link             # creates/links a Vercel project for this folder
   ```
3. **Set environment variables** (replace the placeholder values — generate the two secrets with `openssl rand -hex 32`):
   ```bash
   vercel env add UPSTASH_REDIS_REST_URL production --value "<from Upstash>"
   vercel env add UPSTASH_REDIS_REST_TOKEN production --value "<from Upstash>"
   vercel env add DASHBOARD_PASSWORD production --value "<a password you'll type to view the site>"
   vercel env add SESSION_SECRET production --value "$(openssl rand -hex 32)"
   vercel env add INGEST_SECRET production --value "$(openssl rand -hex 32)"
   ```
   Repeat with `preview` and `development` in place of `production` if you want those environments to work too (add `--yes` to auto-accept the Preview "Git branch?" prompt).
4. **Deploy**:
   ```bash
   vercel deploy --prod --yes
   ```
   Note the production URL it prints (e.g. `https://your-project.vercel.app`).
5. **Point the local plugin at your deployment** — create `~/.swiftbar-plugins/.claude-usage-dashboard.json`:
   ```json
   { "url": "https://your-project.vercel.app", "secret": "<the INGEST_SECRET you set above>" }
   ```
   The plugin picks this up automatically on its next 2-minute refresh — no restart needed. Without this file, the plugin behaves exactly as before (menu bar only, nothing pushed anywhere).
6. Visit your URL, log in with your `DASHBOARD_PASSWORD`, and you're done.

### What data is sent to your deployment

Exactly what's described in the [How it works](#how-it-works) table above, plus: machine hostname, and a 30-day daily cost/token history (for the chart). Nothing else — no prompts, no code, no conversation content. It's sent only to the Vercel project *you* deployed and control, authenticated with a secret only your machine knows.

## Credits

- [SwiftBar](https://swiftbar.app) — menu bar plugin host
- [ccusage](https://ccusage.com) — local Claude Code usage analysis

## License

[MIT](LICENSE)
