# NHL Analytics

Local web app for NHL team and player stats with charts. Data comes from the NHL's public (unofficial) JSON APIs; personal, non-commercial use.

## Run

```
npm start
```

Then open http://localhost:3000 (needs Node 18+; no `npm install` required yet).

## Pages

| URL | What it shows |
|---|---|
| `/` | Teams: standings table, record and goal-differential charts |
| `/players.html` | Players: leaders, shots-vs-goals scatter, sortable table |
| `/player.html?id=ID` | One player: season trend with season comparison, career by season, game log |

All pages share the season picker (kept in the URL as `?season=20252026`).

## API (served by `server.js`)

All endpoints take `season` (e.g. `20252026`, default = current) and `gameType` (`2` regular, `3` playoffs) where relevant.

| Route | Returns |
|---|---|
| `/api/health` | server status |
| `/api/seasons` | available seasons |
| `/api/standings?season=` | per-team W/L/OTL, points, GF/GA, home/road/L10, streak |
| `/api/skaters?season=&team=&pos=&q=&sort=&dir=&limit=` | goals, assists, points, shots, etc. Sort: goals, assists, points, shots, gp, shootingPct, plusMinus, pim, toiPerGame, pointsPerGame, ppPoints, gwg |
| `/api/player/:id` | bio, career/season totals, last 5 games |
| `/api/player/:id/gamelog?season=` | game-by-game stats |

Responses are cached in memory (5 min current season, 24 h past seasons).

## Updating GitHub

```
git add .
git commit -m "Describe the change"
git push
```
