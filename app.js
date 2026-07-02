console.log("🔥 APP.JS LOADED");

const map = L.map("map").setView([20, 0], 2);

L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  {
    attribution: "Tiles © Esri"
  }
).addTo(map);

const allMarkers = [];
const bounds = [];

async function geocode(location) {
  const cacheKey = `geo:${location.toLowerCase()}`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.length) return null;

  const coords = {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon)
  };

  localStorage.setItem(cacheKey, JSON.stringify(coords));

  return coords;
}

const TITLE_BY_LANGUAGE = {
  English: { elder: "Elder", sister: "Sister" },
  Spanish: { elder: "Élder", sister: "Hermana" },
  Italian: { elder: "Anziano", sister: "Sorella" },
  French: { elder: "Aîné", sister: "Sœur" },
  German: { elder: "Ältester", sister: "Schwester" },
  Portuguese: { elder: "Élder", sister: "Irmã" }
};

function getTitle(sex, name, language) {
  const cleanLanguage = (language || "English").split(",")[0].trim();
  const lang = TITLE_BY_LANGUAGE[cleanLanguage] || TITLE_BY_LANGUAGE.English;
  const prefix = sex === "Female" ? lang.sister : lang.elder;
  return `${prefix} ${name}`;
}

function getColor(sex) {
  return sex === "Female" ? "#ec4899" : "#2563eb";
}

function getCountryCode(country) {
  const codes = {
    Italy: "it",
    "United States": "us",
    USA: "us",
    Mexico: "mx",
    Brazil: "br",
    France: "fr",
    Germany: "de",
    Spain: "es",
    Japan: "jp",
    Canada: "ca",
    England: "gb",
    "United Kingdom": "gb",
    Argentina: "ar",
    Chile: "cl",
    Peru: "pe",
    Colombia: "co",
    Philippines: "ph",
    Australia: "au",
    "New Zealand": "nz"
  };

  return codes[country] || null;
}

function getFlagImage(country, state) {
  const usNames = ["United States", "USA", "US", "U.S.", "U.S.A."];

  if (usNames.includes(country) && state) {
    const stateCode = state.toLowerCase().replace(/\s+/g, "-");
    return `<img class="flag-img" src="https://cdn.jsdelivr.net/gh/hampusborgos/country-flags@main/svg/us/${stateCode}.svg" alt="${state} flag">`;
  }

  const codes = {
    Italy: "it",
    Mexico: "mx",
    Brazil: "br",
    France: "fr",
    Germany: "de",
    Spain: "es",
    Japan: "jp",
    Canada: "ca",
    Argentina: "ar",
    Chile: "cl",
    Peru: "pe",
    Colombia: "co",
    Philippines: "ph",
    Australia: "au",
    "New Zealand": "nz",
    England: "gb",
    "United Kingdom": "gb"
  };

  const code = codes[country];

  if (!code) return `<div class="flag-placeholder">🌍</div>`;

  return `<img class="flag-img" src="https://flagcdn.com/w80/${code}.png" alt="${country} flag">`;
}
function shouldShowSpouse(relation) {
  return (relation || "").toLowerCase().includes("in-law");
}

async function loadSheet() {
  const url =
    "https://docs.google.com/spreadsheets/d/15BJwH_54gL9fWGCtg0FOwF_qYy4mAm7KWN1LVnSBl5w/gviz/tq?tqx=out:json";

  const res = await fetch(url);
  const text = await res.text();

  const json = JSON.parse(text.substring(47).slice(0, -2));
  const cols = json.table.cols.map(c => c.label);

  return json.table.rows.map(row => {
    const obj = {};

    row.c.forEach((cell, i) => {
      obj[cols[i]] = cell ? cell.v : "";
    });

    return obj;
  });
}

function formatMissionLocation(country, state, city) {
  const usNames = ["United States", "USA", "US", "U.S.", "U.S.A."];

  if (usNames.includes(country)) {
    return `${state || ""}<br>${city || ""}`;
  }

  return `${country || ""}<br>${city || ""}`;
}

function showInfoCard(m) {
  const country = m["Mission Country"];
  const state = m["Mission State"];
  const mission = m["Official Mission name (Ex: Maryland Baltimore)"];

  const sex = m["Biological Sex"];
  const name = m["Missionary Name (First Last) (e.g., Dawn Hollingsworth)"];
  const language = m["Assigned Language(s)"];
  const title = getTitle(sex, name, language);

  const spouse = m["Your Spouse's Name (If Applicable)"];
  const relation = m["Who is your Haag relation?"];

  const spouseLine =
    shouldShowSpouse(relation) && spouse
      ? `<div class="card-spouse">Spouse: ${spouse}</div>`
      : "";

  document.getElementById("infoCardContent").innerHTML = `
    <h2>${title}</h2>

    <div class="card-divider"></div>

    <div class="card-location-small">
      ${getFlagImage(country, state)}
      <div class="card-mission">${mission || ""}</div>
    </div>

    <div class="card-dates">
      ${m["Start Date (MM/YYYY)"] || ""} – ${m["End Date (MM/YYYY)"] || ""}
    </div>

    ${spouseLine}
  `;

  document.getElementById("infoCard").classList.remove("hidden");
}

function updateStats(data) {
  document.getElementById("totalMissionaries").textContent = data.length;

  const countries = new Set(
    data.map(m => m["Mission Country"]).filter(Boolean)
  );

  document.getElementById("countriesServed").textContent = countries.size;
}

async function buildMap() {
  const data = await loadSheet();

  updateStats(data);

  for (let m of data) {
    const city = m["Mission City"];
    const country = m["Mission Country"];

    if (!city || !country) continue;

    const location = `${city}, ${country}`;
    const coords = await geocode(location);

    if (!coords) continue;

    const sex = m["Biological Sex"];
    const color = getColor(sex);

    const marker = L.circleMarker([coords.lat, coords.lng], {
      radius: 7,
      color,
      fillColor: color,
      fillOpacity: 0.9,
      weight: 2
    }).addTo(map);

   marker.on("click", () => {
  showInfoCard(m);
  map.panTo([coords.lat, coords.lng]);
});

marker.on("mouseover", () => {
  showInfoCard(m);
});

marker.on("mouseout", () => {
  // keeps card open if they clicked; leave blank on purpose
});

    allMarkers.push({ marker, sex });
    bounds.push([coords.lat, coords.lng]);

    await new Promise(r => setTimeout(r, 300));
  }

  if (bounds.length > 0) {
    map.fitBounds(bounds, {
      padding: [60, 60],
      maxZoom: 5
    });
  }
}

function applyFilters() {
  const showElders = document.getElementById("showElders").checked;
  const showSisters = document.getElementById("showSisters").checked;

  allMarkers.forEach(item => {
    const isFemale = item.sex === "Female";
    const shouldShow = isFemale ? showSisters : showElders;

    if (shouldShow) {
      item.marker.addTo(map);
    } else {
      map.removeLayer(item.marker);
    }
  });
}

document.getElementById("showElders").addEventListener("change", applyFilters);
document.getElementById("showSisters").addEventListener("change", applyFilters);

document.getElementById("closeCard").addEventListener("click", () => {
  document.getElementById("infoCard").classList.add("hidden");
});

buildMap();
