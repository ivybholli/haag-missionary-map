console.log("🔥 APP.JS LOADED");

// =====================
// MAP SETUP
// =====================

const map = L.map('map').setView([20, 0], 2);

L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  {
    attribution: '© OpenStreetMap & CartoDB'
  }
).addTo(map);

// =====================
// GEOCODE
// =====================

async function geocode(location) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.length) return null;

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon)
  };
}

// =====================
// HELPERS
// =====================

function getColor(sex) {
  return sex === "Female" ? "#ec4899" : "#2563eb";
}

function getTitle(sex, name) {
  return sex === "Female"
    ? `Sister ${name}`
    : `Elder ${name}`;
}

// =====================
// GOOGLE SHEET (JSON VERSION)
// =====================

async function loadSheet() {
  const url =
    "https://docs.google.com/spreadsheets/d/15BJwH_54gL9fWGCtg0FOwF_qYy4mAm7KWN1LVnSBl5w/gviz/tq?tqx=out:json";

  const res = await fetch(url);
  const text = await res.text();

  const json = JSON.parse(text.substring(47).slice(0, -2));

  const cols = json.table.cols.map(c => c.label);

  return json.table.rows.map(row => {
    let obj = {};

    row.c.forEach((cell, i) => {
      obj[cols[i]] = cell ? cell.v : "";
    });

    return obj;
  });
}

// =====================
// BUILD MAP
// =====================

async function buildMap() {
  const data = await loadSheet();

  console.log("RAW DATA LENGTH:", data.length);
  console.log("FIRST ROW:", data[0]);

  for (let m of data) {

    console.log("ROW:", m);

    const city = m["Mission City"];
    const country = m["Mission Country"];

    console.log("CITY:", city);
    console.log("COUNTRY:", country);

    if (!city || !country) {
      console.log("SKIPPED ROW (missing city/country)");
      continue;
    }

    const location = `${city}, ${country}`;
    console.log("LOCATION:", location);

    const coords = await geocode(location);
    console.log("COORDS:", coords);

    if (!coords) {
      console.log("GEOCODE FAILED:", location);
      continue;
    }

    const sex = m["Biological Sex"];
    const name = m["Missionary Name (First Last) (e.g., Dawn Hollingsworth)"];

    const color = getColor(sex);
    const title = getTitle(sex, name);

    L.circleMarker([coords.lat, coords.lng], {
      radius: 6,
      color,
      fillColor: color,
      fillOpacity: 0.85,
      weight: 2
    })
    .addTo(map)
    .bindPopup(`
      <b>${title}</b><br><br>
      ${m["Official Mission name (Ex: Maryland Baltimore)"] || ""}<br>
      ${location}<br><br>
      ${m["Start Date (MM/YYYY)"] || ""} – ${m["End Date (MM/YYYY)"] || ""}
    `);

    await new Promise(r => setTimeout(r, 300));
  }
}

// =====================
// START
// =====================

buildMap();
