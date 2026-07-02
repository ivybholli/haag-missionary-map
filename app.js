
// =====================
// MAP SETUP
// =====================

const map = L.map('map').setView([20, 0], 2);

L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  {
    attribution: '&copy; OpenStreetMap & CartoDB'
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
// GOOGLE SHEET
// =====================

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/15BJwH_54gL9fWGCtg0FOwF_qYy4mAm7KWN1LVnSBl5w/gviz/tq?tqx=out:csv";

async function loadSheet() {
  const res = await fetch(SHEET_URL);
  const text = await res.text();
  return parseCSV(text);
}


// =====================
// CSV PARSER
// =====================

function parseCSV(csv) {
  const lines = csv.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());

  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.replace(/"/g, "").trim());

    let obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i];
    });

    return obj;
  });
}


// =====================
// BUILD MAP
// =====================

async function buildMap() {

  const data = await loadSheet();

  console.log("Loaded rows:", data.length);
  console.log("Sample row:", data[0]);

  for (let m of data) {

    if (!m["Mission City"] || !m["Mission Country"]) continue;

    const location = `${m["Mission City"]}, ${m["Mission Country"]}`;

    const coords = await geocode(location);

    if (!coords) {
      console.log("No coords for:", location);
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

    await new Promise(r => setTimeout(r, 1000));
  }
}


// =====================
// START APP
// =====================

buildMap();
