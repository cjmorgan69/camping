// Shared logic for Eyre Coast Camp Windows: campground data, coastline maths, forecasts and window finding.
// Loaded as a plain script by index.html and with require() by report/daily.js, so keep it free of page code.
"use strict";
const TZ = "Australia/Adelaide";
const PL = {lat:-34.7263, lon:135.8597};
const BBOX = "-35.2,132.2,-31.4,137.9";

// Council campgrounds from the Lower Eyre Council and Tumby Bay District Council camping pages (read 31 Oct 2026).
// Always shown; OpenStreetMap sites within 1 km are dropped in their favour. approx = placed at the end of the access road
// or a nearby campsite, not an exact campground location. f = estimated coast direction, used only if no coastline is found.
const LE = "Lower Eyre Council · book at eyrepeninsula.com/camping · dogs on a lead";
const COUNCIL = [
  {name:"Farm Beach Campground", lat:-34.49667, lon:135.39778, f:270, note:`${LE} · 40 sites · $20/night · toilets · fires in a 30 cm steel drum only`},
  {name:"Louth Bay Campground", lat:-34.54191, lon:135.92977, f:90, note:`${LE} · 8 numbered sites only · $20/night · toilets · no fires`},
  {name:"Seal Corner Campground", lat:-34.60300, lon:135.43250, f:270, approx:true, note:`${LE} · 4WD only, very rocky track · $10/night · no toilets · fires in a 30 cm steel drum only`},
  {name:"Frenchman's North & South", lat:-34.41522, lon:135.36498, f:270, approx:true, note:`${LE} · North 4 sites, South 10 sites (limited caravan access) · $10/night · no toilets · fires except in bushfire season`},
  {name:"Greenly Beach South, Sheoak & Wattle", lat:-34.36685, lon:135.36750, f:270, approx:true, note:`${LE} · Greenly South 10 sites $15/night, Sheoak 6 and Wattle 1 site $10/night · no toilets · no camping at Greenly Beach North`},
  {name:"Tom Bott & Eucalypt (Coles Point)", lat:-34.36944, lon:135.35389, f:270, approx:true, note:`${LE} · Tom Bott 28 sites, Eucalypt 3 sites · $10/night · no toilets`},
  {name:"Point Drummond Campground", lat:-34.14972, lon:135.24444, f:250, note:`${LE} · 3 sites · $10/night · no toilets · fires in a 30 cm steel drum only`},
  {name:"Fishery Bay Campground", lat:-34.91095, lon:135.68902, f:180, note:`${LE} · 8 sites · $20/night · toilets · fires in a 30 cm steel drum only`},
  {name:"Lipson Cove Campground", lat:-34.26292, lon:136.26052, f:100, note:"Tumby Bay District Council · 12 sites · $10/night · pets, caravans and motorhomes OK · book online"},
  // Second Creek: location, north-facing beach and offshore arc (any wind south of east) from the owner's local knowledge.
  {name:"Second Creek Beach", lat:-34.4253691, lon:136.1100817, f:0, fixed:true, off:[90,270], note:"Tumby Bay District Council · $10/night via on-site honesty box"},
  {name:"Tumby Bay South Beach Camp", lat:-34.46469, lon:136.11649, f:90, approx:true, note:"Tumby Bay District Council · about 14 km south of Tumby Bay · $10/night · no toilets · gravel road fine for cars and vans · placed at Redcliff campsite: check the location"}
];

// Hand list of well-known coastal sites. facing = estimated direction the shore faces (degrees), used only if the coastline cannot be loaded.
const KNOWN = [
  ["Tumby Bay foreshore",-34.377,136.103,90],["Lipson Cove",-34.268,136.268,100],["Port Neill foreshore",-34.118,136.349,110],
  ["Arno Bay",-33.917,136.575,110],["Port Gibbon",-33.794,136.809,150],["Cowell foreshore",-33.684,136.921,90],
  ["Lucky Bay",-33.703,137.036,60],["Fitzgerald Bay",-32.928,137.722,100],["Point Lowly",-33.000,137.785,160],
  ["Port Lincoln (Kirton Point)",-34.716,135.879,60],["Louth Bay",-34.558,135.940,90],
  ["Fisherman Point, Lincoln NP",-34.797,135.958,315],["Surfleet Cove, Lincoln NP",-34.836,135.974,0],
  ["Taylors Landing, Lincoln NP",-34.870,136.040,20],["Memory Cove, Lincoln NP",-34.968,136.044,150],
  ["Fishery Bay",-34.910,135.690,170],["Coffin Bay",-34.620,135.471,160],["Yangie Bay, Coffin Bay NP",-34.623,135.332,90],
  ["Big Yangie, Coffin Bay NP",-34.590,135.300,270],["Black Springs, Coffin Bay NP",-34.540,135.271,90],
  ["Morgans Landing, Coffin Bay NP",-34.510,135.250,100],["Point Sir Isaac, Coffin Bay NP",-34.435,135.190,80],
  ["Farm Beach",-34.470,135.330,260],["Sheringa Beach",-33.840,134.830,230],
  ["Walkers Rocks",-33.565,134.858,260],["Elliston (Waterloo Bay)",-33.646,134.887,270],["Venus Bay",-33.236,134.672,150],
  ["Port Kenny",-33.170,134.690,220],["Baird Bay",-33.140,134.370,260],["Streaky Bay foreshore",-32.796,134.212,300],
  ["Perlubie Beach",-32.725,134.345,260],["Smoky Bay",-32.377,133.935,260],
  ["Ceduna foreshore",-32.128,133.677,120],["Cactus Beach (Point Sinclair)",-32.075,132.995,190],["Fowlers Bay",-31.987,132.437,100]
];

/* ---------- geometry ---------- */
const rad = d => d*Math.PI/180, deg = r => r*180/Math.PI;
function xy(lat, lon, lat0){ return [lon*111.32*Math.cos(rad(lat0)), lat*110.574]; }
const norm = a => ((a%360)+360)%360;
const angDiff = (a,b) => { const d = Math.abs(norm(a)-norm(b)); return d>180 ? 360-d : d; };
const PTS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
const compass = d => PTS[Math.round(norm(d)/22.5)%16];
const kmBetween = (a, b) => Math.hypot((a.lon-b.lon)*111.32*Math.cos(rad(a.lat)), (a.lat-b.lat)*110.574);

// OSM coastline ways run with land on the left and sea on the right, so the seaward normal of a segment is its heading + 90°.
function coastFacing(lat, lon, ways){
  const [sx, sy] = xy(lat, lon, lat);
  const segs = []; let best = Infinity;
  for (const w of ways){
    const g = w.geometry; if (!g) continue;
    for (let i=0; i<g.length-1; i++){
      const [ax, ay] = xy(g[i].lat, g[i].lon, lat), [bx, by] = xy(g[i+1].lat, g[i+1].lon, lat);
      if (Math.min(Math.abs(ax-sx), Math.abs(bx-sx)) > 6 || Math.min(Math.abs(ay-sy), Math.abs(by-sy)) > 6) continue;
      const dx = bx-ax, dy = by-ay, L2 = dx*dx+dy*dy || 1e-9;
      const t = Math.max(0, Math.min(1, ((sx-ax)*dx + (sy-ay)*dy)/L2));
      const d = Math.hypot(ax+t*dx-sx, ay+t*dy-sy);
      segs.push({dx, dy, d}); if (d < best) best = d;
    }
  }
  if (!segs.length) return null;
  let vx = 0, vy = 0;
  for (const s of segs){
    if (s.d > best + 1.2) continue;
    const w = 1/(0.3 + (s.d-best));          // nearest shoreline counts most
    vx += s.dy*w; vy += -s.dx*w;             // (dy,-dx) = segment turned 90° clockwise, length-weighted
  }
  if (Math.hypot(vx, vy) < 1e-6) return null;
  return {facing: norm(deg(Math.atan2(vx, vy))), km: best};
}

function region(lat, lon){
  if (lon < 133.95) return "far";
  if (lat < -34.38) return "south";
  if (lon > 135.95 || (lat > -34.0 && lon > 136.3)) return "east";
  return "west";
}
// Keep out Yorke Peninsula's west coast, which shares the bounding box.
function onEyre(lat, lon){
  if (lat > -33.4) return lon < 137.85;
  if (lat > -33.85) return lon < 137.3;
  return lon < 136.7;
}

/* ---------- campgrounds + coastline ---------- */
// headers: extra request headers (the daily report sends a User-Agent, which Overpass asks scripts to set)
async function overpass(q, headers){
  const hosts = ["https://overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter"];
  let last;
  for (const h of hosts){
    try{
      const r = await fetch(h, {method:"POST", body:"data="+encodeURIComponent(q), headers:Object.assign({"Content-Type":"application/x-www-form-urlencoded"}, headers)});
      if (r.ok) return await r.json();
      last = new Error("Overpass "+r.status);
    }catch(e){ last = e; }
  }
  throw last;
}

function sitesQuery(){
  const around = KNOWN.map(k => `way["natural"="coastline"](around:2500,${k[1]},${k[2]});`).join("")
    + COUNCIL.map(c => `way["natural"="coastline"](around:3000,${c.lat},${c.lon});`).join("");
  return `[out:json][timeout:120];
nwr["tourism"~"^(camp_site|caravan_site)$"](${BBOX})->.c;
.c out center tags;
(way["natural"="coastline"](around.c:3000);${around});
out geom;`;
}

// Turn the Overpass answer for sitesQuery() into the campground list.
function buildSites(j){
  const ways = j.elements.filter(e => e.type === "way" && e.tags && e.tags.natural === "coastline");
  const camps = j.elements.filter(e => e.tags && /camp_site|caravan_site/.test(e.tags.tourism||""));
  const out = [];
  for (const c of camps){
    const lat = c.lat ?? c.center?.lat, lon = c.lon ?? c.center?.lon;
    const name = c.tags.name;
    if (lat == null || !name || !onEyre(lat, lon)) continue;
    const f = coastFacing(lat, lon, ways);
    if (!f || f.km > 3) continue;
    out.push({id:c.type[0]+c.id, name, lat, lon, facing:f.facing, coastKm:f.km, src:"osm", kind:c.tags.tourism==="caravan_site"?"Caravan park":"Campground"});
  }
  for (let i = out.length-1; i >= 0; i--) if (COUNCIL.some(c => kmBetween(out[i], c) < 1)) out.splice(i, 1);
  for (const c of COUNCIL){
    const f = coastFacing(c.lat, c.lon, ways), ok = f && f.km <= 3;
    out.push(councilSite(c, ok && !c.fixed ? f.facing : c.f, ok ? f.km : null));
  }
  // Hand-list sites fill gaps only: skip any already in OpenStreetMap (same first word within 10 km, or anything within 1.5 km)
  // and any whose rough location is not within 1.5 km of the coastline.
  const word = n => n.toLowerCase().split(/[\s,(]+/)[0];
  for (const [name, lat, lon] of KNOWN){
    const p = {lat, lon};
    if (out.some(o => kmBetween(o, p) < 1.5 || (kmBetween(o, p) < 10 && word(o.name) === word(name)))) continue;
    const f = coastFacing(lat, lon, ways);
    if (!f || f.km > 1.5) continue;
    out.push({id:"k"+name, name, lat, lon, facing:f.facing, coastKm:f.km, src:"list", kind:"Known site"});
  }
  return dedupe(out);
}
function dedupe(list){
  const keep = [];
  for (const s of list){
    const dup = keep.find(k => k.name.toLowerCase() === s.name.toLowerCase() && Math.abs(k.lat-s.lat) < .02 && Math.abs(k.lon-s.lon) < .02);
    if (!dup) keep.push(s);
  }
  return keep;
}
function councilSite(c, facing, coastKm){
  return {id:"g"+c.name, name:c.name, lat:c.lat, lon:c.lon, facing, coastKm, est:coastKm == null, src:"council", kind:"Council campground", note:c.note, approx:!!c.approx, fixed:!!c.fixed, off:c.off};
}
function fallbackSites(){
  return COUNCIL.map(c => councilSite(c, c.f, null)).concat(
    KNOWN.map(([name, lat, lon, f]) => ({id:"k"+name, name, lat, lon, facing:f, coastKm:null, src:"list", est:true, kind:"Known site"})));
}

/* ---------- weather ---------- */
const HV = "temperature_2m,apparent_temperature,precipitation,precipitation_probability,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day";
// onBatch(done, total) reports progress between batches of 50 sites
async function fetchWeather(sites, days, onBatch){
  const out = {};
  for (let i=0; i<sites.length; i+=50){
    const b = sites.slice(i, i+50);
    if (onBatch) onBatch(Math.min(i+50, sites.length), sites.length);
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${b.map(s=>s.lat.toFixed(3)).join(",")}&longitude=${b.map(s=>s.lon.toFixed(3)).join(",")}&hourly=${HV}&wind_speed_unit=kmh&timezone=${encodeURIComponent(TZ)}&forecast_days=${days}`;
    const r = await fetch(u); if (!r.ok) throw new Error("Open-Meteo "+r.status);
    let j = await r.json(); if (!Array.isArray(j)) j = [j];
    j.forEach((d, k) => { const h = d.hourly; out[b[k].id] = {time:h.time, t:h.temperature_2m, app:h.apparent_temperature, p:h.precipitation, pp:h.precipitation_probability, ws:h.wind_speed_10m, wd:h.wind_direction_10m, wg:h.wind_gusts_10m, day:h.is_day}; });
  }
  return out;
}

/* ---------- scoring ---------- */
function nowKey(){
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:00`;
}
// Is wind-from direction d inside the clockwise arc a→b (degrees, ends excluded)?
const inArc = (d, a, b) => { const x = norm(d - a), span = norm(b - a); return x > 0 && x < span; };
function windRel(wd, site){
  if (site.off){
    // a local's offshore arc: inside = offshore, within 30° of either end = cross-shore
    const [a, b] = site.off;
    return inArc(wd, a, b) ? "offshore" : inArc(wd, a - 30, b + 30) || norm(wd - a) === 0 || norm(wd - b) === 0 ? "cross-shore" : "onshore";
  }
  const d = angDiff(wd, site.facing);
  return d >= 120 ? "offshore" : d >= 60 ? "cross-shore" : "onshore";
}
// level 3 = good and offshore or calm, 2 = good but cross-shore, 0 = fails. S = the limits.
function hourLevel(w, i, site, S){
  const ws = w.ws[i], wg = w.wg[i], t = w.t[i], day = w.day[i];
  const why = [];
  if (ws > S.maxWind) why.push("windy");
  if (wg > S.maxGust) why.push("gusty");
  if ((w.p[i] ?? 0) > 0.1 || (w.pp[i] ?? 0) > S.rain) why.push("rain");
  if (day ? t < S.tMin : t < S.nMin) why.push("cool");
  if (day && t > S.tMax) why.push("hot");
  let rel = "calm";
  if (ws >= S.calm) rel = windRel(w.wd[i], site);
  if (S.dirMode !== "any"){
    if (rel === "onshore") why.push("onshore");
    if (rel === "cross-shore" && S.dirMode === "off") why.push("cross-shore");
  }
  const lvl = why.length ? 0 : (rel === "cross-shore" ? 2 : 3);
  return {lvl, rel, why};
}

// Hours from now, runs of good hours (wins = at least S.minHrs long, near = 4 hours or more) and a per-day summary.
function analyseSite(site, w, S, nk){
  if (!w) return null;
  let start = w.time.findIndex(t => t >= nk); if (start < 0) start = 0;
  const hours = [];
  for (let i=start; i<w.time.length; i++) hours.push({i, ...hourLevel(w, i, site, S)});
  const wins = [], near = []; let run = null;
  const close = () => { if (run) (run.n >= S.minHrs ? wins : run.n >= 4 ? near : []).push(run); run = null; };
  for (const h of hours){
    if (h.lvl){
      if (!run) run = {site, a:h.i, b:h.i, n:0, q:0, wmax:0, gmax:0, tmin:99, tmax:-99, dirs:[]};
      run.b = h.i; run.n++; run.q += h.lvl === 3 ? 1 : .6;
      run.wmax = Math.max(run.wmax, w.ws[h.i]); run.gmax = Math.max(run.gmax, w.wg[h.i]);
      run.tmin = Math.min(run.tmin, w.t[h.i]); run.tmax = Math.max(run.tmax, w.t[h.i]); run.dirs.push(w.wd[h.i]);
    } else close();
  }
  close();
  [...wins, ...near].forEach(r => { r.quality = r.q/r.n; r.score = Math.min(r.n, 48) * r.quality; r.dir = meanDir(r.dirs); r.offPct = Math.round(100*hours.filter(h=>h.i>=r.a&&h.i<=r.b&&h.lvl===3).length/r.n); });
  const inWin = new Set(); wins.forEach(r => { for (let i=r.a; i<=r.b; i++) inWin.add(i); });
  const byDay = {};
  for (const h of hours){
    const d = w.time[h.i].slice(0,10);
    const o = byDay[d] ??= {good:0, ideal:0, win:false};
    if (h.lvl) o.good++;
    if (h.lvl === 3) o.ideal++;
    if (inWin.has(h.i)) o.win = true;
  }
  const best = wins.reduce((m, r) => Math.max(m, r.score), 0) + hours.filter(h=>h.lvl).length/100;
  return {hours, wins, near, byDay, best};
}
function meanDir(ds){ let x=0, y=0; ds.forEach(d=>{x+=Math.sin(rad(d)); y+=Math.cos(rad(d));}); return norm(deg(Math.atan2(x,y))); }

/* ---------- dates ---------- */
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function dayName(iso){ const [y,m,d] = iso.slice(0,10).split("-").map(Number); const dt = new Date(Date.UTC(y,m-1,d)); return `${DOW[dt.getUTCDay()]} ${d} ${MON[m-1]}`; }
function hr12(iso){ const h = +iso.slice(11,13); return h===0 ? "12am" : h<12 ? h+"am" : h===12 ? "12pm" : (h-12)+"pm"; }
function whenText(w, r){ const a = w.time[r.a], b = w.time[r.b]; return a.slice(0,10)===b.slice(0,10) ? `${dayName(a)}, ${hr12(a)} to ${hr12(b)}` : `${dayName(a)} ${hr12(a)} to ${dayName(b)} ${hr12(b)}`; }

if (typeof module !== "undefined") module.exports = {TZ, PL, COUNCIL, KNOWN, compass, kmBetween, overpass, sitesQuery, buildSites, fallbackSites, fetchWeather, nowKey, analyseSite, dayName, hr12, whenText};
