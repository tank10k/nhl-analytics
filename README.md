# NHL Analytics

A local web app for exploring NHL team and player stats with charts. It runs on your own computer, pulls data from the NHL's public (unofficial) JSON APIs, and shows it in a dark, broadcast-style interface. Personal, non-commercial use.

**Status:** Version 2 is being rebuilt in steps (React + TypeScript + ECharts). Step 1, the foundation, is done: app shell, design system, search, disk cache, and the League overview page. The original app is still available at `/legacy` until each part is replaced.

## Contents

- [Quick start](#quick-start)
- [What's in the app](#whats-in-the-app)
- [Revamp plan](#revamp-plan)
- [Project structure](#project-structure)
- [Architecture](#architecture)
- [Design system](#design-system)
- [API reference](#api-reference)
- [Testing without the NHL API](#testing-without-the-nhl-api)
- [Known limitations](#known-limitations)
- [Updating GitHub](#updating-github)

## Quick start

Requires **Node 22.13 or newer** (Node 24 recommended).

```
npm install
npm run dev
```

Then open **http://localhost:5173**. `npm run dev` starts two things together: the data server (`server.js`, port 3000, restarts itself when you edit it) and the Vite dev server (port 5173, reloads the page instantly when you edit anything in `src/`). Ctrl+C stops both.

To run it the "finished" way instead, without the dev tools:

```
npm run build      # compiles the React app into dist/
npm start          # serves everything from http://localhost:3000
```

Other commands: `npm run typecheck` checks the TypeScript without building.

The server only listens on `127.0.0.1`, so it is not reachable from other machines. To use another port: `set PORT=4000 && npm start` (Windows cmd) or `$env:PORT=4000; npm start` (PowerShell).

## What's in the app

| Address | Page | Status |
|---|---|---|
| `/` | **League overview.** A one-line summary of who leads the league and the scoring race; a team-strength chart (goals scored vs. allowed per game, team logos as markers, league averages splitting it into four quadrants, click a team to open it); a top-10 scoring leaders list (points, goals, assists, points per game) with team-colored bars; standings by division with a goal-differential bar and the playoff cut line. | Done (step 1) |
| `/teams`, `/teams/TOR` | Teams hub and team pages themed in team colors | Step 4 |
| `/players`, `/players/ID` | Leaderboards and player cards | Step 3 |
| `/compare` | Side-by-side players or teams | Step 6 |
| `/games` | Scoreboard, game flow, shot maps | Step 7 |
| `/goalies` | Goalie leaderboards and cards | Step 8 |
| `/legacy` | The original app (Teams, Players, Player detail) | Kept until replaced |

Throughout the app:

- **Search:** press **Ctrl+K** (or **/**) anywhere to jump to any player or team. Arrow keys to move, Enter to open.
- **Season picker** (top right) covers 2005-06 to the current season. The season is kept in the address as `?season=20252026`, so any view can be bookmarked, and links between pages carry it along.
- Sections not yet rebuilt show what's coming and link to the same view in the original app.

## Revamp plan

Each step is delivered, tested and pushed before the next one starts.

1. **Foundation** *(done)*: Vite + React + TypeScript, design system, 32-team color map, app shell with sidebar and Ctrl+K search, SQLite disk cache, League overview page.
2. **Data expansion:** player bio, league percentiles by position, team schedules and results, goalies, play-by-play shot data with a simple expected-goals (xG) model.
3. **Player card + player page:** team-colored cards with bio, percentile ranks, last-10 sparkline, career arc, PNG export.
4. **Teams hub + team pages:** points-pace race, home/road splits, rolling form, roster as cards.
5. **Advanced charts:** shot maps and heat maps on a drawn rink, PDO and shot-share quadrants, standings bump chart.
6. **Compare tool:** 2 to 3 players or teams with overlaid radar and trend lines.
7. **Games:** scoreboard, game-flow chart, per-game shot map.
8. **Goalies, then polish:** goalie cards, animations, performance, final README.

## Project structure

```
nhl-analytics/
├── server.js              Data server: proxies + caches the NHL APIs, serves the app
├── package.json           Scripts and dependencies
├── vite.config.mts        Vite: React plugin, dev proxy to server.js
├── tsconfig.json          TypeScript settings
├── index.html             Entry page for the React app
├── scripts/
│   └── dev.js             Runs server.js and Vite together for npm run dev
├── static/                Files copied as-is into the build (favicon)
├── src/                   The React app
│   ├── main.tsx           Boots React and the router
│   ├── App.tsx            Routes (which page shows at which address)
│   ├── styles/global.css  Design tokens and all component styles
│   ├── lib/
│   │   ├── api.ts         Fetch helper + useApi() hook with a short client cache
│   │   ├── season.tsx     Selected season (from the address) shared by every page
│   │   ├── teams.ts       Team colors, readable accent color, dark logo helper
│   │   ├── types.ts       Shapes of the /api responses
│   │   └── format.ts      Number, record, percentage and time formatting
│   ├── charts/
│   │   ├── EChart.tsx     React wrapper around ECharts (resize, cleanup)
│   │   └── theme.ts       The "broadcast" chart theme + tooltip helpers
│   ├── components/        Shell (sidebar/top bar), CommandPalette (Ctrl+K), Panel,
│   │                      TeamChip/TeamLogo/TeamStripe, Icons
│   └── pages/
│       ├── Home.tsx       League overview
│       ├── home/          Its parts: StrengthQuadrant, Leaders, DivisionTables
│       └── ComingSoon.tsx Placeholder for sections built in later steps
├── public/                The original app (served at /legacy), unchanged
├── dist/                  Built app (created by npm run build; not in git)
└── data/                  cache.db, the disk cache (created on first run; not in git)
```

## Architecture

```
Browser ──> Vite :5173 (dev only) ──> server.js :3000 ──> api-web.nhle.com / api.nhle.com
                                       ├─ /api/*   cached JSON, trimmed to what the pages use
                                       ├─ /legacy  original app (public/)
                                       └─ /*       built React app (dist/)
```

**Server (`server.js`)**
- Still zero-dependency: Node's built-in `fetch` and, new in v2, Node's built-in SQLite (`node:sqlite`).
- `getJson()` checks memory, then the disk cache (`data/cache.db`), then the NHL. It shares one in-flight request between callers, times out after 15 seconds, and serves the last cached copy if the NHL is unreachable.
- Because the cache is on disk, past seasons are fetched once and then load instantly, even after a restart. Delete the `data` folder to clear it. If SQLite isn't available, the server prints a note and uses memory only.
- Cache lifetimes: 5 minutes for the current season, 24 hours for past seasons, 10 minutes for player profiles, 6 hours for the season list.
- Static files: the built app first, then the original app's files, then the React app's `index.html` for its own page addresses (such as `/teams/TOR`). Paths that escape those folders are refused.

**Frontend (`src/`)**
- React 19 with React Router. Each page asks for data through `useApi('/api/...')`, which shares requests between components and keeps responses for 2 minutes, so moving between pages doesn't refetch.
- Charts use Apache ECharts through one wrapper (`charts/EChart.tsx`) and one theme (`charts/theme.ts`), so every chart has the same fonts, grid, axes and tooltip style.
- In development, Vite forwards `/api` (and the original app's paths) to `server.js`.

## Design system

The look is a dark broadcast style drawn from the rink at night. All values live as CSS variables at the top of `src/styles/global.css`.

- **Surfaces:** arena navy `#0a1424` for the page, `#101d33` for panels, `#162741` / `#1e3353` for raised and selected states.
- **Ink:** `#eaf1fa` primary text, `#a8b8cf` secondary, `#7d91ae` muted.
- **Signals:** blue-line blue `#4da3ff` for focus and the active section; goal-light red `#e5484d` only for alerts.
- **Type:** Barlow Condensed for headings, numbers and team abbreviations (scoreboard feel); Barlow for body text. Numbers use tabular figures so columns line up. Fonts are bundled through npm, so they work offline.
- **Team colors:** `src/lib/teams.ts` holds primary and secondary colors for every franchise since 2005-06 (including Arizona, Phoenix, Atlanta and Utah). `teamAccent()` picks whichever team color is readable on the dark panels (navy-primary teams such as Toronto get a lightened version), so team stripes and bars never disappear into the background.
- **Charts:** generic series use the first three colors of a palette validated for color-blind separation on the dark surface (`#3987e5`, `#d95926`, `#199e70`); diverging values (goal differential) use blue for positive and red for negative around a gray zero line. Values in tooltips and labels are always text, never color alone, and every chart has its numbers in a table or tooltip.
- **Accessibility:** visible focus rings, keyboard-operable search, reduced motion respected, layout works down to phone width.

## API reference

All routes are GET. `season` looks like `20252026` (default: current season). `gameType` is `2` for regular season (default) or `3` for playoffs. Errors return JSON `{ "error": "..." }` with an HTTP error status (400 bad input, 404 not found, 502 NHL unreachable).

| Route | Returns |
|---|---|
| `/api/health` | Server status, current season, cache size |
| `/api/seasons` | `{ current, seasons[] }` with each season's start and end dates |
| `/api/standings?season=` | Per team: name, logo, conference, division, GP, W, L, OTL, points, point %, regulation wins, GF, GA, goal differential, home/road/last-10 records, streak, rank |
| `/api/skaters?season=&gameType=&team=&pos=&q=&sort=&dir=&limit=` | Skaters with goals, assists, points, shots, shooting %, plus/minus, PIM, TOI per game, points per game, power-play points, game-winning goals. `team` is an abbreviation, `pos` is `C`, `L`, `R` or `D`, `q` is a name search, `dir` is `asc` or `desc`, `limit` is 1 to 2000 (default 50). Sort fields: `goals`, `assists`, `points`, `shots`, `gp`, `shootingPct`, `plusMinus`, `pim`, `toiPerGame`, `pointsPerGame`, `ppPoints`, `gwg` |
| `/api/player/:id` | Name, team, position, number, headshot, career and featured stats, NHL regular-season totals per season, last 5 games |
| `/api/player/:id/gamelog?season=&gameType=` | Game-by-game: date, opponent, home/road, goals, assists, points, shots, plus/minus, PIM, TOI |

**Upstream endpoints used**

| NHL endpoint | Used for |
|---|---|
| `api-web.nhle.com/v1/standings/{now \| YYYY-MM-DD}` | Standings |
| `api-web.nhle.com/v1/standings-season` | Season list and end dates |
| `api.nhle.com/stats/rest/en/skater/summary` (filtered with `cayenneExp`) | Full skater tables |
| `api-web.nhle.com/v1/player/{id}/landing` | Player profile and season totals |
| `api-web.nhle.com/v1/player/{id}/game-log/{season}/{gameType}` | Game logs |

**Data notes:** shooting percentage comes back as a fraction (0.16) and is shown as a percentage; time on ice comes back in seconds and is shown as mm:ss; multi-team players come back as a comma-separated team string and are split into a list.

## Testing without the NHL API

The server reads its upstream addresses from two environment variables, so it can be pointed at a local stand-in that returns the same JSON shapes:

```
NHL_WEB_BASE=http://127.0.0.1:4010 NHL_STATS_BASE=http://127.0.0.1:4010 npm start
```

Step 1 of v2 was built and checked this way against a mock of 32 teams and about 700 invented players: desktop and phone widths, the Ctrl+K search, season switching, the disk cache, legacy routes and the SPA fallback. The mock server is not part of the repo.

## Known limitations

- **Unofficial API.** The NHL can change or remove these endpoints without notice, and its [terms of service](https://www.nhl.com/info/terms-of-service) limit reuse to personal, non-commercial use. If a page shows a "Couldn't load" banner, check the terminal where the server is running.
- **Real-data check pending for v2 step 1.** The League overview uses the same endpoints as the original Teams and Players pages (already confirmed live), but its layout was checked on mock data. Worth eyeballing on first run: team logos in the strength chart, and early-season leaders where many players are tied.
- **Early-season data is sparse.** In the first weeks many players are tied (tied players share a rank in the leaders list) and the strength chart's teams sit close together. Points per game only counts players with at least 40% of the league-high games played.
- **Skaters only.** Goalies arrive in step 8.
- **Past seasons** are limited to 2005-06 onward (the shootout era), because older seasons include ties and a different points system.
- **Logos and headshots** load from NHL servers, so they only appear while online; they are hidden if they fail to load.
- **Playoffs** data only exists once the playoffs begin, so that option shows an empty state before then.

## Updating GitHub

First-time setup (once per project):

```
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/nhl-analytics.git
git push -u origin main
```

If git doesn't know who you are, set it once:

```
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

After every change:

```
git status                      # see what changed
git add .                       # stage everything
git commit -m "Describe the change"
git push
```
