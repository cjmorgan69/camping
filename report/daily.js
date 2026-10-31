// Daily camping report: finds the best camping windows near Port Lincoln for the next week, writes report/latest.md
// and opens a GitHub issue with the same text, which GitHub emails to the owner. Run by .github/workflows/daily-report.yml.
// Limits and area are set in report/config.json.
"use strict";
const fs = require("fs"), path = require("path");
const core = require("../core.js");

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
const L = cfg.limits;
const APP = "https://cjmorgan69.github.io/camping/";
const UA = {"User-Agent": "eyre-camp-windows daily report (github.com/cjmorgan69/camping)"};
const r0 = n => Math.round(n);
const DIR = {off: "offshore only", cross: "offshore or cross-shore", any: "any direction"};

async function buildReport(){
  let sites, note = "";
  try { sites = core.buildSites(await core.overpass(core.sitesQuery(), UA)); }
  catch (e) {
    sites = core.fallbackSites();
    note = `OpenStreetMap did not answer (${e.message}), so only the built-in campground list was checked, with estimated coast directions.`;
  }
  sites = sites.filter(s => core.kmBetween(s, cfg.centre) <= cfg.radiusKm
    && (s.src === "council" || s.coastKm == null || s.coastKm <= L.coastKm));
  const wx = await core.fetchWeather(sites, cfg.days);
  const nk = core.nowKey();

  const wins = [], byDay = {};
  for (const s of sites){
    const R = core.analyseSite(s, wx[s.id], L, nk); if (!R) continue;
    R.wins.forEach(r => wins.push({r, w: wx[s.id]}));
    for (const [d, o] of Object.entries(R.byDay)){
      // best spot each day: part of a full window first, then most offshore or calm hours, then most good hours
      const score = (o.win ? 1000 : 0) + o.ideal * 10 + o.good;
      if (o.good && (!byDay[d] || score > byDay[d].score)) byDay[d] = {s, score, ...o};
    }
  }
  wins.sort((a, b) => b.r.score - a.r.score);

  const title = `Camping windows near ${cfg.centre.name}: ${core.dayName(nk)}`;
  const out = [`# ${title}`, "",
    `Checked ${sites.length} coastal campgrounds within ${cfg.radiusKm} km of ${cfg.centre.name} for the next ${cfg.days} days.`, ""];
  if (note) out.push(`> ${note}`, "");

  out.push("## Best windows", "");
  if (!wins.length) out.push(`None. No campground has ${L.minHrs} hours in a row that meet your limits this week.`, "");
  wins.slice(0, cfg.maxListed).forEach(({r, w}, i) => {
    const s = r.site, away = r0(core.kmBetween(s, cfg.centre));
    out.push(`${i + 1}. **${s.name}** (${away} km away, coast faces ${core.compass(s.facing)})  `,
      `   ${core.whenText(w, r)}, ${r.n} hours · wind up to ${r0(r.wmax)} km/h, gusts ${r0(r.gmax)}, mostly ${core.compass(r.dir)} (${r.offPct}% offshore or calm) · ${r0(r.tmin)} to ${r0(r.tmax)} °C`);
  });
  if (wins.length) out.push("");

  out.push("## Day by day", "", "| Day | Best spot | Good hours |", "| --- | --- | --- |");
  const times = wx[sites[0]?.id]?.time || [];
  const days = [...new Set(times.map(t => t.slice(0, 10)))].filter(d => d >= nk.slice(0, 10));
  for (const d of days){
    const b = byDay[d];
    out.push(b ? `| ${core.dayName(d)} | ${b.s.name}${b.win ? " (full window)" : ""} | ${b.good} |` : `| ${core.dayName(d)} | None | 0 |`);
  }
  out.push("",
    `Limits: wind up to ${L.maxWind} km/h, gusts up to ${L.maxGust} km/h, wind direction ${DIR[L.dirMode]} (ignored below ${L.calm} km/h), `
    + `daytime ${L.tMin} to ${L.tMax} °C, overnight at least ${L.nMin} °C, rain chance up to ${L.rain}%, windows of ${L.minHrs} hours or more, `
    + `campgrounds within ${L.coastKm} km of the sea. Change them in report/config.json.`,
    "", `Open the app for the hour-by-hour view: ${APP}`);
  return {title, body: out.join("\n")};
}

async function gh(method, url, body){
  const r = await fetch(`https://api.github.com/repos/${process.env.REPO}${url}`, {method,
    headers: {Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": UA["User-Agent"]},
    body: body ? JSON.stringify(body) : undefined});
  if (!r.ok) throw new Error(`GitHub ${method} ${url}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function main(){
  const {title, body} = await buildReport();
  fs.writeFileSync(path.join(__dirname, "latest.md"), body + "\n");
  console.log(body);
  if (!process.env.GITHUB_TOKEN || !process.env.REPO) return;
  // A new issue each day is what triggers GitHub's email; the mention makes sure it reaches the owner.
  const made = await gh("POST", "/issues", {title, body: body + `\n\ncc @${cfg.notify}`});
  const open = await gh("GET", "/issues?state=open&per_page=50");
  for (const i of open) if (i.number !== made.number && i.title.startsWith("Camping windows near ") && !i.pull_request)
    await gh("PATCH", `/issues/${i.number}`, {state: "closed"});
  console.log(`Opened issue #${made.number}`);
}

main().catch(e => { console.error(e); process.exit(1); });
