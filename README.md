# NHL Analytics

A local web app for exploring NHL team and player stats with charts. It runs on your own computer, pulls data from the NHL's public (unofficial) JSON APIs, and shows it in a dark, broadcast-style interface. Personal, non-commercial use.

**Status:** Version 2 is being rebuilt in steps (React + TypeScript + ECharts). Steps 1 to 4 are done: the app shell, design system, search and League overview page; the expanded data layer (player bios, percentiles, schedules, goalies, team stats, shot data and expected goals); the Players hub, player pages and player cards; and the Teams hub and team-themed team pages. The original app is still available at `/legacy` until each part is replaced.

## Contents

- [Quick start](#quick-start)
- [What's in the app](#whats-in-the-app)
- [Revamp plan](#revamp-plan)
- [Project structure](#project-structure)
- [Architecture](#architecture)
- [Design system](#design-system)
- [API reference](#api-reference)
- [Shot data and expected goals](#shot-data-and-expected-goals)
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

Other commands:

- `npm run check` (with the server running) calls every API route against live NHL data and prints a table of what came back. Run it after NHL changes or when a chart looks empty.
- `npm run typecheck` checks the TypeScript without building.
- `http://localhost:3000/api` lists every data route, so you can click through them in a browser.

The server only listens on `127.0.0.1`, so it is not reachable from other machines. To use another port: `set PORT=4000 && npm start` (Windows cmd) or `$env:PORT=4000; npm start` (PowerShell).

## What's in the app

| Address | Page | Status |
|---|---|---|
| `/` | **League overview.** A one-line summary of who leads the league and the scoring race; a team-strength chart (goals scored vs. allowed per game, team logos as markers, league averages splitting it into four quadrants, click a team to open it); a top-10 scoring leaders list (points, goals, assists, points per game) with team-colored bars; standings by division with a goal-differential bar and the playoff cut line. | Done (step 1) |
| `/teams` | **Teams hub.** All 32 teams as tiles grouped by division (record, last 10, streak, points); a points race by division (running points by game number, each line labelled, with the conference playoff line); a sortable table of underlying numbers (goals and shots per game, shot share, shooting and save %, PDO, power play, penalty kill, faceoffs). | Done (step 4) |
| `/teams/TOR` | **Team page**, themed in the team's colors. Banner with record, streak and division/conference/league rank; six key numbers each with a league rank (PDO gets a luck reading instead); points pace against division rivals and the playoff line; every game as a goal-differential bar; rolling goals for and against; splits (home, road, one-goal games, overtime/shootout, blowouts); recent results and next games; the top four scorers as cards and the full roster with goalies. | Done (step 4) |
| `/players` | **Players hub.** Filters (regular season or playoffs, position, team, minimum games, name search); cards for the four leading scorers in whatever the filters select; a production-vs-ice-time scatter (points per 60 minutes against time on ice per game, forwards and defense, click a dot to open the player); a sortable, paged leaderboard with points per 60, power-play points, shooting %, hits and blocks. | Done (step 3) |
| `/players/ID` | **Player page.** The full player card; a one-line summary; percentile profile (11 measures against the same position); season pace (running points, goals, assists or shots by game number against any earlier season); game-by-game form with a 5-game average; career arc by season; game log. Goalies get save-% versions of form and career. | Done (step 3) |
| `/compare` | Side-by-side players or teams | Step 6 |
| `/games` | Scoreboard, game flow, shot maps | Step 7 |
| `/goalies` | Goalie leaderboards and cards | Step 8 |
| `/legacy` | The original app (Teams, Players, Player detail) | Kept until replaced |

Throughout the app:

- **Search:** press **Ctrl+K** (or **/**) anywhere to jump to any player or team. Arrow keys to move, Enter to open.
- **Season picker** (top right) covers 2005-06 to the current season. The season is kept in the address as `?season=20252026`, so any view can be bookmarked, and links between pages carry it along.
- Sections not yet rebuilt show what's coming and link to the same view in the original app.

### Player cards

Each card is built from the player's profile, percentile ranks and game log (`src/lib/cards.ts` turns the data into what the card shows; `src/components/PlayerCard.tsx` draws it), so every page builds cards the same way.

- **Front:** a hero in the team's primary color with the logo, sweater number and headshot, finished with hem stripes in the team's colors (the stripes across the bottom of a hockey sweater). Below it, on the dark panel so it reads the same for every team: name, position, bio (age, height, weight, shoots, birthplace, draft), the season line (GP, G, A, P, +/− for skaters; GP, W, SV%, GAA, SO for goalies), six percentile bars and a last-10-games sparkline.
- **Back** ("Show career"): every NHL regular season with career totals, plus awards.
- **Save as image** downloads whichever side is showing as a PNG at double resolution. Headshots and logos are served through the local server (`/api/image`) so the browser is allowed to draw them into the image. If a photo still can't be drawn, the card is saved without it.
- A compact version (stat line, three percentile bars, sparkline) is used on the Players hub and team rosters, and will be reused for Compare.

### Playoff line

The dashed "playoff line" on the points charts is the 8th-best running points total in the conference after each game number. Eight teams per conference make the playoffs, so it shows roughly where the last spot sits at every stage of the season, without needing the exact wild-card rules. It uses game number rather than date, so teams with games in hand are compared fairly.

## Revamp plan

Each step is delivered, tested and pushed before the next one starts.

1. **Foundation** *(done)*: Vite + React + TypeScript, design system, 32-team color map, app shell with sidebar and Ctrl+K search, SQLite disk cache, League overview page.
2. **Data expansion** *(done)*: player bio, percentile ranks by position, team schedules and results, league points race, goalies, team shot and special-teams stats, play-by-play shot data with an expected-goals (xG) model, and an API check script.
3. **Player card + player page** *(done)*: team-colored cards with bio, percentile ranks, last-10 sparkline, career flip side and PNG export; Players hub; player pages with percentile, pace, form and career charts.
4. **Teams hub + team pages** *(done)*: division tiles, points race with playoff line, team stats table; team pages with pace, results, rolling form, splits, schedule and roster cards.
5. **Advanced charts:** shot maps and heat maps on a drawn rink, PDO and shot-share quadrants, standings bump chart.
6. **Compare tool:** 2 to 3 players or teams with overlaid radar and trend lines.
7. **Games:** scoreboard, game-flow chart, per-game shot map.
8. **Goalies, then polish:** goalie cards, animations, performance, final README.

## Project structure

```
nhl-analytics/
├── server.js              Data server: API routes + serves the app
├── lib/                   Server modules (plain Node, no dependencies)
│   ├── util.js            Errors, season ids, input checks, concurrency helper
│   ├── cache.js           Memory + SQLite disk cache (raw responses and computed results)
│   ├── loaders.js         Standings, skaters, goalies, team stats, players, schedules,
│   │                      points race, percentiles
│   ├── shots.js           Play-by-play shots, rink normalization, expected-goals model
│   └── images.js          Same-origin proxy for NHL headshots and logos
├── package.json           Scripts and dependencies
├── vite.config.mts        Vite: React plugin, dev proxy to server.js
├── tsconfig.json          TypeScript settings
├── index.html             Entry page for the React app
├── scripts/
│   ├── dev.js             Runs server.js and Vite together for npm run dev
│   └── check-api.js       npm run check: tests every route against live data
├── static/                Files copied as-is into the build (favicon)
├── src/                   The React app
│   ├── main.tsx           Boots React and the router
│   ├── App.tsx            Routes (which page shows at which address)
│   ├── styles/global.css  Design tokens and all component styles
│   ├── lib/
│   │   ├── api.ts         Fetch helper + useApi() hook with a short client cache
│   │   ├── season.tsx     Selected season (from the address) shared by every page
│   │   ├── teams.ts       Team colors, readable accent, ink on team color, hem stripes, dark logos
│   │   ├── cards.ts       Builds player card data (season totals, percentiles, sparkline)
│   │   ├── img.ts         Routes NHL images through /api/image
│   │   ├── stats.ts       Rolling averages, ranks
│   │   ├── types.ts       Shapes of the /api responses
│   │   └── format.ts      Number, record, percentage and time formatting
│   ├── charts/
│   │   ├── EChart.tsx     React wrapper around ECharts (resize, cleanup)
│   │   ├── PointsRace.tsx Running points by game number + playoff line (hub and team pages)
│   │   └── theme.ts       The "broadcast" chart theme + tooltip helpers
│   ├── components/        Shell (sidebar/top bar), CommandPalette (Ctrl+K), Panel,
│   │                      TeamChip/TeamLogo/TeamStripe, PlayerCard, PlayerCardLoader,
│   │                      Sparkline, Icons
│   └── pages/
│       ├── Home.tsx       League overview
│       ├── home/          Its parts: StrengthQuadrant, Leaders, DivisionTables
│       ├── players/       Players hub: PlayersPage, ProductionScatter
│       ├── player/        Player page: PlayerPage, PercentilePanel, SeasonPace,
│       │                  FormChart, CareerChart, GameLogTable
│       ├── teams/         Teams hub: TeamsPage (tiles, race, stats table)
│       ├── team/          Team page: TeamPage, TeamHero, TeamKpis, TeamCharts
│       │                  (results strip, rolling form), TeamTables (splits, roster, schedule)
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

**Server (`server.js` + `lib/`)**
- Still zero-dependency: Node's built-in `fetch` and Node's built-in SQLite (`node:sqlite`).
- `getJson()` checks memory, then the disk cache (`data/cache.db`), then the NHL. It shares one in-flight request between callers, times out after 20 seconds, and serves the last cached copy if the NHL is unreachable.
- `derived()` caches things the server computes (shots parsed from a play-by-play, percentile tables, the points race). Shots from finished games are kept for good, so the large play-by-play files themselves are never stored, only the small parsed result.
- Because the cache is on disk, past seasons and finished games are fetched once and then load instantly, even after a restart or with the internet down. Delete the `data` folder to clear it. If SQLite isn't available, the server prints a note and uses memory only.
- Cache lifetimes: 5 minutes for the current season, 24 hours for past seasons, 10 minutes for player profiles, 6 hours for the season list, 1 minute for games in progress.
- At most 4 to 6 NHL requests run at once when a route needs many (a team's season of play-by-plays, all 32 schedules), to stay polite to the NHL's servers.
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

All routes are GET; `http://localhost:3000/api` lists them. `season` looks like `20252026` (default: current season). `gameType` is `2` for regular season (default) or `3` for playoffs. Errors return JSON `{ "error": "..." }` with an HTTP status (400 bad input, 404 not found, 502 NHL unreachable). Missing NHL fields come back as `null` rather than breaking the response.

**League and teams**

| Route | Returns |
|---|---|
| `/api/health` | Server status, current season, cache info, xG model version |
| `/api/seasons` | `{ current, seasons[] }` with each season's start and end dates |
| `/api/standings?season=` | Per team: name, logo, conference, division, GP, W, L, OTL, points, point %, regulation wins, GF, GA, goal differential, home/road/last-10 records, streak, ranks |
| `/api/teams/stats?season=&gameType=` | Per team: goals and shots for/against per game, shot share, shooting %, save %, PDO, power-play %, penalty-kill %, faceoff %. Matched to standings by team name to add the abbreviation and logo. |
| `/api/team/:abbrev/schedule?season=` | Every game: date, opponent, home/road, score, result (W, L, OTL), decided in REG/OT/SO, regular-season game number and running points total |
| `/api/league/race?season=` | For every team, cumulative points after each game (for pace, race and bump charts). Loads all 32 schedules, so the first call takes a few seconds. |
| `/api/team/:abbrev/shots?season=&gameType=` | Every shot attempt for and against the team in finished games, with xG, plus season totals (all situations and 5-on-5) and a per-game table. See below. |

**Players**

| Route | Returns |
|---|---|
| `/api/skaters?season=&gameType=&team=&pos=&q=&sort=&dir=&limit=` | Skaters with goals, assists, points, shots, shooting %, plus/minus, PIM, TOI per game, points per game, even-strength / power-play / shorthanded goals and points, game-winning and OT goals, faceoff %, and (from the NHL's "realtime" report) hits, blocked shots, giveaways, takeaways. `pos` is `C`, `L`, `R`, `D` or `F` (all forwards). Sort fields: `goals`, `assists`, `points`, `shots`, `gp`, `shootingPct`, `plusMinus`, `pim`, `toiPerGame`, `pointsPerGame`, `ppPoints`, `gwg`, `hits`, `blocks`. `limit` 1 to 2000 (default 50). |
| `/api/goalies?season=&gameType=&team=&minGp=&sort=&dir=&limit=` | Goalies with GP, starts, W-L-OTL, save %, GAA, shutouts, saves, shots against. Sort: `gp`, `wins`, `savePct`, `gaa` (lowest first), `shutouts`, `saves`. |
| `/api/percentiles?season=&gameType=&pos=F\|D` | Percentile ranks (1 to 99) for every eligible skater on 11 measures, ranked within forwards or defense. Eligible means at least a quarter of the league-high games played (capped at 20 GP). |
| `/api/player/:id` | Name, team, number, position, headshot, **bio** (birth date, age, birthplace, height, weight, shoots, draft year/team/round/pick), NHL regular-season and playoff totals per season, awards |
| `/api/player/:id/gamelog?season=&gameType=` | Game by game: game id, date, opponent, home/road, goals, assists, points, shots, plus/minus, PIM, TOI (goalies: decision, save %, shots and goals against) |
| `/api/player/:id/percentiles?season=&gameType=` | One skater's values and percentiles, the measure list, and the size of the group they're ranked in |
| `/api/player/:id/shots?season=&gameType=` | Every shot attempt by the skater, with xG, plus goals vs. expected goals |

**Games**

| Route | Returns |
|---|---|
| `/api/game/:id/shots` | Every shot attempt in one game (id like `2025020001`): shooter, team, type, period, time, location, distance, angle, strength, rebound, empty net, xG |

**Images**

| Route | Returns |
|---|---|
| `/api/image?src=` | An NHL headshot or logo, fetched and served from this server so cards can be saved as images. Only NHL image hosts are allowed; images are kept in memory and cached by the browser for a day. |

The 11 percentile measures: points, goals, assists, shots, hits, blocked shots and takeaways per 60 minutes of ice time; shooting % (20+ shots); time on ice per game; power-play points per game; plus/minus per game.

**Upstream endpoints used**

| NHL endpoint | Used for |
|---|---|
| `api-web.nhle.com/v1/standings/{now \| YYYY-MM-DD}` | Standings |
| `api-web.nhle.com/v1/standings-season` | Season list and end dates |
| `api-web.nhle.com/v1/club-schedule-season/{team}/{season}` | Schedules, results, points race |
| `api-web.nhle.com/v1/player/{id}/landing` | Player profile, bio, season totals, awards |
| `api-web.nhle.com/v1/player/{id}/game-log/{season}/{gameType}` | Game logs (and which games to read shots from) |
| `api-web.nhle.com/v1/gamecenter/{id}/play-by-play` | Shot locations and details |
| `api.nhle.com/stats/rest/en/skater/summary` | Skater scoring |
| `api.nhle.com/stats/rest/en/skater/realtime` | Hits, blocks, giveaways, takeaways |
| `api.nhle.com/stats/rest/en/goalie/summary` | Goalie stats |
| `api.nhle.com/stats/rest/en/team/summary` | Team shots and special teams |

**Data notes:** shooting and save percentages come back as fractions (0.16) and are shown as percentages; time on ice comes back in seconds; multi-team players come back as a comma-separated team string and are split into a list.

## Shot data and expected goals

**Where shots come from.** Each game's play-by-play lists every goal, shot on goal, missed shot and blocked shot with rink coordinates (feet from center ice, nets at x = ±89). The server flips every shot so the team shooting always attacks the net on the right (x = +89), so one half-rink can show a whole season. Which way a team is attacking comes from the feed's own flag each period, with a fallback to where most of that team's shots were taken. Each shot's team is taken from the game roster, which keeps blocked shots on the right side.

**Strength** comes from the feed's situation code (skaters and goalies on the ice): `5v5`, `PP` (power play), `SH` (shorthanded) or `EV` (other even strength, such as 4-on-4). Empty-net shots are flagged.

**Expected goals (xG)** is the chance an unblocked shot becomes a goal. The model is a logistic curve:

- starts from shot distance (the biggest factor) and angle from the middle of the net
- adjusts for shot type: tips and deflections up, backhands, slap shots and wraparounds down
- adds a large bonus for rebounds (same team shot again within 3 seconds) and a small one on the power play
- empty-net shots get a high fixed value; blocked shots get none

Typical values: a 10-foot wrist shot from the slot is about 0.22, a rebound from there about 0.39, a 30-foot slap shot about 0.05, and a 60-foot shot about 0.01. The weights are set by hand to match the general shape of public hockey models, not fitted to NHL data, so read xG as approximate: good for comparing players and teams and for spotting luck (goals well above or below xG), not as an exact probability. The model has a version tag (`xg1`); if it changes, xG is recalculated from the cached shots automatically.

**Shot-share stats** in the team summary: attempts share (Corsi), unblocked attempts share (Fenwick) and xG share, each for all situations and 5-on-5. 50% is even, and above 50% means a team controls play.

**Speed.** A team's or player's season of shots needs one play-by-play per game. The first request for a season reads them (four at a time, roughly 10 to 30 seconds for a full season); after that every finished game comes from the disk cache instantly.

## Testing without the NHL API

The server reads its upstream addresses from two environment variables, so it can be pointed at a local stand-in that returns the same JSON shapes:

```
NHL_WEB_BASE=http://127.0.0.1:4010 NHL_STATS_BASE=http://127.0.0.1:4010 npm start
```

Steps 1 to 4 of v2 were built and checked this way against a mock of 32 teams, about 700 invented players, 64 goalies and a 40-day schedule with generated play-by-plays. Checked: desktop and phone widths, the Ctrl+K search, season switching, every API route (via `npm run check`), shot direction normalization, blocked-shot team assignment, xG values, that cached games still load with the NHL unreachable, the Players hub filters and sorting, player pages for skaters, card flip and PNG export, the Teams hub and team pages (including light-colored teams such as Boston, where the banner switches to dark text), unknown team codes, and phone-width layouts. The mock server is not part of the repo.

## Known limitations

- **Unofficial API.** The NHL can change or remove these endpoints without notice, and its [terms of service](https://www.nhl.com/info/terms-of-service) limit reuse to personal, non-commercial use. If a page shows a "Couldn't load" banner, check the terminal where the server is running.
- **Real-data check for step 2.** The new routes follow the community API reference but were tested on mock data. Run `npm run check` once against live data: it shows which fields came back filled. Most likely to need a tweak: the realtime report fields (hits, blocks), team-stats name matching, and play-by-play shot fields.
- **Early-season data is sparse.** In the first weeks many players are tied (tied players share a rank in the leaders list) and the strength chart's teams sit close together. Points per game only counts players with at least 40% of the league-high games played.
- **Goalies** have data routes and player pages (card, form, career, game log); their leaderboard arrives in step 8. Percentile ranks cover skaters only.
- **Team pages for the current season** load the league race (all 32 schedules) once, which takes a few seconds the first time; it's cached after that.
- **Roster** lists players whose most recent team this season is that club; a player traded away shows up on his new team.
- **Card colors follow the player's current team**, also when you look at a past season with another club.
- **Percentile ranks for the current season** move a lot in the first weeks, and players appear once they reach the minimum games played.
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
