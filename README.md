# NHL Analytics

A local web app for exploring NHL team and player stats with charts. It runs on your own computer, pulls data from the NHL's public (unofficial) JSON APIs, and shows it in the browser as standings, leaderboards, scatter plots and season-trend lines. Personal, non-commercial use.

**Status:** Steps 1 to 4 of the build plan are done (data server, Teams page, Players page, Player detail page). Steps 1 and 2 have been checked against live NHL data; steps 3 and 4 were built and tested against mock data and still need a pass on live data (see [Known limitations](#known-limitations)).

## Contents

- [Quick start](#quick-start)
- [What's in the app](#whats-in-the-app)
- [Project structure](#project-structure)
- [How it was built](#how-it-was-built)
- [Architecture](#architecture)
- [API reference](#api-reference)
- [Charts module](#charts-module)
- [Design and accessibility](#design-and-accessibility)
- [Testing without the NHL API](#testing-without-the-nhl-api)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Updating GitHub](#updating-github)

## Quick start

Requires Node 18 or newer. There are no dependencies, so no `npm install` is needed.

```
npm start
```

Then open http://localhost:3000. To use another port: `PORT=4000 npm start` (macOS/Linux) or `set PORT=4000 && npm start` (Windows cmd).

The server only listens on `127.0.0.1`, so it is not reachable from other machines.

## What's in the app

All pages share a **season picker** (2005-06 to the current season) and a **theme button** (Auto follows your OS, or force Light/Dark). The chosen season is kept in the URL as `?season=20252026` and carried between pages.

| URL | Page | What it shows |
|---|---|---|
| `/` | **Teams** | Four leader tiles (most points, best goal differential, top offense, top defense); a stacked wins/losses/OT-losses chart and a goal-differential chart for every team; a sortable standings table (GP, W, L, OTL, PTS, P%, RW, GF, GA, DIFF, home/road/last-10 records, streak). Filter by conference or division; reorder the charts by points, wins, point %, goal differential or goals for. |
| `/players.html` | **Players** | Leader tiles (points, goals, assists, shots, with a "+N tied" note); top-15 charts for points (split into goals and assists) and shots on goal; a shots-vs-goals scatter plot with hover details; a sortable, paginated table (G, A, PTS, P/GP, SOG, SH%, +/-, PIM, TOI/G). Filter by regular season/playoffs, team, position, minimum games played, or search by name. |
| `/player.html?id=ID` | **Player detail** | Reached by clicking a player's name. Season totals; a running-total trend line (points, goals, assists or shots) that can overlay a past season for comparison, with an option to match games played so a season in progress is compared at the same pace; goals and assists for every NHL season; a game-by-game log. |

Hover any chart row, dot or line for a tooltip with the full numbers behind it.

## Project structure

```
nhl-analytics/
├── server.js              Node server: proxies and caches the NHL APIs, serves /public
├── package.json           npm start -> node server.js (no dependencies)
├── .gitignore             node_modules, .env, logs, OS files
├── README.md
└── public/
    ├── index.html         Teams page
    ├── players.html       Players page
    ├── player.html        Player detail page
    ├── css/
    │   └── app.css        All styles, light and dark theme tokens
    └── js/
        ├── common.js      Shared helpers: fetch wrapper, formatting, theme toggle, season picker
        ├── charts.js      Reusable SVG charts: bars, scatter, lines, plus the shared tooltip
        ├── teams.js       Teams page logic
        ├── players.js     Players page logic
        └── player.js      Player detail page logic
```

## How it was built

The app was built in small, testable steps, with each step delivered and pushed to GitHub before the next began. The aim was to keep every step small so changes only touch what is needed.

### Planning decisions

- **Data source.** Instead of scraping NHL.com, the app uses the same JSON APIs the NHL's own site uses: `api-web.nhle.com/v1` (standings, players, game logs) and `api.nhle.com/stats/rest` (full skater tables). They need no key. The NHL does not publish official documentation for them; the community reference is [Zmalski/NHL-API-Reference](https://github.com/Zmalski/NHL-API-Reference).
- **A local server, not a pure browser app.** A small Node server sits between the browser and the NHL. It avoids browser cross-origin (CORS) problems, caches responses so the NHL isn't hit on every page load, and gives the frontend one consistent, trimmed-down API.
- **No dependencies.** Node 18+ already has `fetch`, so the server uses only built-in modules. Nothing to install or keep updated.
- **Past seasons from day one.** Every route takes a `season` parameter from the start, so comparing seasons never needed a rewrite.

### Build steps

1. **Data server.** `server.js` with cached, validated endpoints for standings, skaters, player profile and game log, plus a seasons list. The real response shapes were checked first, including confirming that the stats report exposes `shots` for shots on goal. Includes stale-on-error caching, request de-duplication, input validation, and path-traversal protection for static files.
2. **Teams page.** Standings table, leader tiles, and two charts sharing one team order. Added the shared helpers (`common.js`) and the first version of the chart module.
3. **Players page.** Reused the bar chart, added a scatter chart, and added client-side filtering, sorting and pagination. The server's skater limit cap was raised to 2000 so a whole season loads in one request.
4. **Player detail page.** Added a multi-series line chart with a crosshair tooltip and a dashed comparison line, plus season-comparison and "match games played" controls. Player names in the Players table now link here.

### Decisions worth knowing about

- **Charts are plain SVG, not Chart.js.** The environment this was built in could not download npm packages, and drawing the charts directly meant they could be rendered and visually checked during development. It also keeps the app dependency-free. Chart.js can still be added later for more complex charts (see [Roadmap](#roadmap)).
- **Charts follow a written method.** Chart form, color assignment, mark styling, hover behavior and accessibility were chosen against a data-visualization checklist, and the color palette was run through a validator rather than judged by eye (details in [Design and accessibility](#design-and-accessibility)).
- **The Players page loads every skater once** and filters, searches and sorts in the browser. That makes filtering instant and keeps server logic simple, at the cost of a larger first load (about 900 players).
- **Traded players** appear once, with all their teams listed (for example `TOR/MTL`); the team filter matches any of them. On the detail page, a season split across teams is combined into one row.
- **Bugs caught during testing** that are now fixed: a misaligned team column in the standings table, and the "None" option in the season-comparison picker being reset back to the default.

## Architecture

```
Browser  ->  localhost:3000 (server.js)  ->  api-web.nhle.com / api.nhle.com
              |- /api/*  cached JSON, trimmed to the fields the pages use
              '- /*      static files from public/
```

**Server (`server.js`)**
- GET only, bound to `127.0.0.1`.
- `getJson()` caches by URL, shares one in-flight request between callers, times out after 15 seconds, and serves the last cached copy if the NHL is unreachable.
- Cache lifetimes: 5 minutes for the current season, 24 hours for past seasons, 10 minutes for player profiles, 6 hours for the season list.
- The current season is derived from the date: the new season starts on 1 September (for example, October 2026 is `20262027`).
- For past seasons, standings are fetched as of that season's final standings date, taken from the NHL's season list.

**Frontend**
- Plain HTML, CSS and ES modules; no build step. Each page has one script that fetches from `/api/*`, keeps filter state in module variables, and re-renders on change.
- Theme choice is the only thing stored in the browser (`localStorage`, wrapped in try/catch so the app works if storage is blocked).

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

## Charts module

`public/js/charts.js` exports a small set of reusable charts, all drawn as SVG, redrawn on resize, and sharing one tooltip.

| Function | Use | Main options |
|---|---|---|
| `renderBars(el, opts)` | Horizontal bars, stacked or diverging | `mode: 'stacked' \| 'diverging'`, `series`, `rows[{label, values \| value, valueLabel, tip}]`, `labelWidth` |
| `renderScatter(el, opts)` | Scatter with hover and selective labels | `points[{x, y, label, tip}]`, `xLabel`, `yLabel`, `labelTop` |
| `renderLines(el, opts)` | Multi-series lines with a crosshair | `series[{name, color, dash, points[{x, y, tip}]}]`, `xLabel`, `yLabel` |
| `tip` | Shared tooltip | `tip.show(html, event)`, `tip.hide()` |

To add a chart to a page, give it a container `<div>` and call one of these with your data. `tip` strings are HTML, so escape any text that comes from the API (`esc()` in `common.js`).

## Design and accessibility

- **Colors** come from one validated palette: blue, orange and aqua as the first three categorical colors, and blue to red for positive/negative. The palette was checked with a validator for lightness, color-blind separation (adjacent colors stay distinguishable under simulated color-vision deficiency) and contrast, in both light and dark mode. Aqua is below 3:1 contrast on the light background, so any chart that uses it also shows values as text, and every chart has a table or tooltip carrying the same numbers.
- **Not by color alone.** Series are named in a legend, bars have a 2px gap between segments, the comparison line on the trend chart is dashed, and values are shown as text next to bars.
- **Dark mode** uses its own selected color steps (not an inverted copy), and follows your OS unless you choose a theme with the button.
- **Charts have one axis only** (no dual-axis charts), thin marks, and quiet gridlines.
- Keyboard: all controls and sortable column headers are focusable with visible focus rings. Chart hover details are mouse and touch only; the same numbers are in the tables.

## Testing without the NHL API

The server reads its upstream addresses from two environment variables, so it can be pointed at a local stand-in server that returns the same JSON shapes:

```
NHL_WEB_BASE=http://127.0.0.1:4010 NHL_STATS_BASE=http://127.0.0.1:4010 npm start
```

The pages in steps 2 to 4 were developed and checked this way against a mock of 32 teams and about 700 players, in light, dark and phone-width layouts. The mock server itself is not part of the repo.

## Known limitations

- **Unofficial API.** The NHL can change or remove these endpoints without notice, and its [terms of service](https://www.nhl.com/info/terms-of-service) limit reuse to personal, non-commercial use. If a page shows a "Couldn't load" banner, check the terminal where the server is running.
- **Real-data check still pending for steps 3 and 4.** Field names for the skater report were confirmed against live data, but the Players and Player detail pages have so far only been tested on mock data. Things worth eyeballing on first real run: shooting %, time on ice, traded players, and the player detail trend.
- **Early-season data is sparse.** In the first weeks, many players and teams are tied on every stat, so charts look flat and the leader tiles show one name plus "+N tied" (Teams tiles show only one of the tied teams).
- **Skaters only.** Goalies are not included yet.
- **Past seasons** are limited to 2005-06 onward (the shootout era), because older seasons include ties and a different points system.
- **Logos and headshots** load from NHL servers, so they only appear while online; they are hidden if they fail to load.
- **In-memory cache.** It is cleared whenever the server restarts.
- **Playoffs** data only exists once the playoffs begin, so that option shows an empty state before then.

## Roadmap

Ideas for the next steps, roughly in order of value:

- **Comparisons.** Put two or more players, or two teams, on the same trend chart (the line chart already supports multiple series).
- **Live scores** strip using the NHL's scoreboard endpoint.
- **Goalie stats** (wins, save %, GAA) with their own leaderboard.
- **Season snapshots** saved to a small local database (such as SQLite) so you can chart how standings changed over a season, since the API mostly provides "now".
- **Chart.js for complex charts** (radar charts, zooming, brushing). To add it without npm, save `https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.js` as `public/vendor/chart.umd.js`, load it with a `<script>` tag on the page that needs it, and build on top of it.
- Polish: favicon, loading skeletons, remembering filters between visits.

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
