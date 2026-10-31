# Eyre Coast Camp Windows

One-page web app that finds good coastal camping weather on the Eyre Peninsula, South Australia:
light winds blowing off the land, mild to warm temperatures and no rain.

Live: https://cjmorgan69.github.io/camping/

- Campgrounds and coastline come from OpenStreetMap (Overpass API), plus a short hand list in `index.html`.
- Coast direction is worked out from the OpenStreetMap coastline near each site (sea is on the right of a coastline way).
- Forecasts come from Open-Meteo, in Adelaide time.
- Settings and the campground list are cached in the browser. Double-tap Refresh to reload the campground list.
