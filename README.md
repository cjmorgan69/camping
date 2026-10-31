# Eyre Coast Camp Windows

One-page web app that finds good coastal camping weather on the Eyre Peninsula, South Australia:
light winds blowing off the land, mild to warm temperatures and no rain.

Live: https://cjmorgan69.github.io/camping/

- Campgrounds and coastline come from OpenStreetMap (Overpass API), plus a short hand list in `index.html`.
- Coast direction is worked out from the OpenStreetMap coastline near each site (sea is on the right of a coastline way).
- Forecasts come from Open-Meteo, in Adelaide time.
- Settings and the campground list are cached in the browser. Double-tap Refresh to reload the campground list.
- Shared logic is in `core.js`, used by both the page and the daily report.

## Daily email

`.github/workflows/daily-report.yml` runs `report/daily.js` every morning (about 6 am Adelaide time). It finds the best
windows within 60 km of Port Lincoln for the next 7 days, saves them to `report/latest.md` and opens a new issue with the
same text (closing yesterday's). GitHub emails new issues to the repo owner.

Set the area and limits once in `report/config.json`: `maxWind` and `maxGust` (km/h), `calm` (km/h below which wind
direction is ignored), `dirMode` (`off`, `cross` or `any`), `tMin`/`tMax` (daytime °C), `nMin` (overnight °C), `rain`
(% chance), `minHrs` (shortest window), `coastKm` (how close to the sea). Saving the file sends a fresh report.
