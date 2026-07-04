console.log("🔥 APP.JS LOADED");

const SHEET_ID = "15BJwH_54gL9fWGCtg0FOwF_qYy4mAm7KWN1LVnSBl5w";

const MISSIONARY_SHEET_NAME = "Form Responses 1";
const COORDINATES_SHEET_NAME = "Coordinates";

const map = L.map("map", {
  zoomControl: true,
  worldCopyJump: true
}).setView([25, 0], 2);

L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  {
    attribution: "Tiles © Esri"
  }
).addTo(map);

let allMissionaries = [];
let allMarkers = [];

const TITLE_BY_LANGUAGE = {
  English: { elder: "Elder", sister: "Sister" },
  Spanish: { elder: "Élder", sister: "Hermana" },
  Italian: { elder: "Anziano", sister: "Sorella" },
  French: { elder: "Aîné", sister: "Sœur" },
  German: { elder: "Ältester", sister: "Schwester" },
  Portuguese: { elder: "Élder", sister: "Irmã" },
  Danish: { elder: "Ældste", sister: "Søster" }
};

const CONTINENTS = {
  "United States": "North America",
  USA: "North America",
  US: "North America",
  Brazil: "South America",
  Denmark: "Europe",
  Germany: "Europe",
  Italy: "Europe",
  France: "Europe",
  Spain: "Europe",
  Mexico: "North America",
  Canada: "North America",
  England: "Europe",
  "United Kingdom": "Europe",
  Argentina: "South America",
  Chile: "South America",
  Peru: "South America",
  Colombia: "South America",
  Philippines: "Asia",
  Japan: "Asia",
  Australia: "Oceania",
  "New Zealand": "Oceania"
};

function normalize(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cleanHeader(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getValue(row, possibleNames) {
  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== "") return row[name];
  }

  const keys = Object.keys(row);

  for (const name of possibleNames) {
    const foundKey = keys.find(key => normalize(key) === normalize(name));
    if (foundKey && row[foundKey] !== "") return row[foundKey];
  }

  return "";
}

async function loadSheet(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

  const res = await fetch(url);
  const text = await res.text();

  const json = JSON.parse(text.substring(47).slice(0, -2));
  const cols = json.table.cols.map(c => cleanHeader(c.label));

  return json.table.rows.map(row => {
    const obj = {};

    row.c.forEach((cell, i) => {
      obj[cols[i]] = cell ? cell.v : "";
    });

    return obj;
  });
}

function getName(m) {
  return getValue(m, [
    "Missionary Name (First Last) (e.g., Dawn Hollingsworth)",
    "Missionary Name (First Last)",
    "Missionary Name",
    "Name"
  ]);
}

function getSex(m) {
  return getValue(m, ["Biological Sex", "Sex", "Gender"]);
}

function getRelation(m) {
  return getValue(m, ["Who is your Haag relation?", "Haag relation", "Relation"]);
}

function getRelationshipToElvaDarrell(m) {
  return getValue(m, [
    "What is your relationship to Elva and Darrell?",
    "Relationship to Elva and Darrell"
  ]);
}

function getMissionName(m) {
  return getValue(m, [
    "Official Mission name (Ex: Maryland Baltimore)",
    "Official Mission Name",
    "Official Mission name",
    "Mission Name"
  ]);
}

function getState(m) {
  return getValue(m, ["State/Region", "State", "Mission State"]);
}

function getCountry(m) {
  return getValue(m, ["Country", "Mission Country"]);
}

function getLanguage(m) {
  return getValue(m, [
    "Assigned Language(s)",
    "Assigned Languages",
    "Language",
    "Languages"
  ]);
}

function getStartDate(m) {
  return getValue(m, ["Start Date (MM/YYYY)", "Start Date"]);
}

function getEndDate(m) {
  return getValue(m, ["End Date (MM/YYYY)", "End Date"]);
}

function getPresidents(m) {
  return getValue(m, [
    "Mission President Names (Ex: President and Sister Piros; President and Sister Varner)",
    "Mission President Names",
    "Mission Presidents"
  ]);
}

function getSpouse(m) {
  return getValue(m, [
    "Your Spouse's Name (If Applicable)",
    "Spouse",
    "Spouse Name"
  ]);
}

function getTitle(sex, name, language) {
  const firstLanguage = String(language || "English").split(",")[0].trim();
  const titles = TITLE_BY_LANGUAGE[firstLanguage] || TITLE_BY_LANGUAGE.English;
  const prefix = sex === "Female" ? titles.sister : titles.elder;
  return `${prefix} ${name || ""}`;
}

function getColor(sex) {
  return sex === "Female" ? "#ec4899" : "#2563eb";
}

function parseMissionEndDate(value) {
  if (!value) return null;

  const parts = String(value).trim().split("/");
  if (parts.length !== 2) return null;

  const month = Number(parts[0]);
  const year = Number(parts[1]);

  if (!month || !year) return null;

  return new Date(year, month, 0);
}

function isCurrentlyServing(m) {
  const endDate = parseMissionEndDate(getEndDate(m));
  if (!endDate) return false;

  return endDate >= new Date();
}

function isInLaw(m) {
  return normalize(getRelationshipToElvaDarrell(m)).includes("in-law");
}

function getMarkerShape(m) {
  if (isInLaw(m)) return "heart";
  if (isCurrentlyServing(m)) return "star";
  return "circle";
}

function createIcon(shape, color, count = null) {
  let svgShape;

  if (shape === "star") {
    svgShape = `<path d="M12 2 L15 8.5 L22 9.2 L16.7 14 L18.2 21 L12 17.3 L5.8 21 L7.3 14 L2 9.2 L9 8.5 Z" />`;
  } else if (shape === "heart") {
    svgShape = `<path d="M12 21 C7.5 17.1 3 14.1 3 8.7 C3 5.6 5.4 3.5 8.1 3.5 C9.8 3.5 11.1 4.4 12 5.7 C12.9 4.4 14.2 3.5 15.9 3.5 C18.6 3.5 21 5.6 21 8.7 C21 14.1 16.5 17.1 12 21 Z" />`;
  } else {
    svgShape = `<circle cx="12" cy="12" r="8" />`;
  }

  const countBadge = count && count > 1
    ? `<div class="marker-count">${count}</div>`
    : "";

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div class="marker-wrap">
        <svg width="30" height="30" viewBox="0 0 24 24">
          <g fill="${color}" stroke="white" stroke-width="2">
            ${svgShape}
          </g>
        </svg>
        ${countBadge}
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
}

function getFlagImage(country, state) {
  const cleanCountry = String(country || "").replace(/\s+/g, " ").trim();
  const cleanState = String(state || "").replace(/\s+/g, " ").trim();

  console.log("FLAG CHECK:", { cleanCountry, cleanState });

  const usStateFlags = {
    Maryland: "https://upload.wikimedia.org/wikipedia/commons/a/a0/Flag_of_Maryland.svg",
    Louisiana: "https://upload.wikimedia.org/wikipedia/commons/e/e0/Flag_of_Louisiana.svg",
    Utah: "https://upload.wikimedia.org/wikipedia/commons/f/f6/Flag_of_Utah.svg",
    Ohio: "https://upload.wikimedia.org/wikipedia/commons/4/4c/Flag_of_Ohio.svg",
    Washington: "https://upload.wikimedia.org/wikipedia/commons/5/54/Flag_of_Washington.svg",
    Oregon: "https://upload.wikimedia.org/wikipedia/commons/b/b9/Flag_of_Oregon.svg",
    Connecticut: "https://upload.wikimedia.org/wikipedia/commons/9/96/Flag_of_Connecticut.svg"
  };

  const countryCodes = {
    "united states": "us",
    "usa": "us",
    "us": "us",
    "brazil": "br",
    "denmark": "dk",
    "germany": "de",
    "italy": "it"
  };

  if (
    ["United States", "USA", "US"].includes(cleanCountry) &&
    usStateFlags[cleanState]
  ) {
    return `<img class="flag-img" src="${usStateFlags[cleanState]}" alt="${cleanState} flag">`;
  }

  const code = countryCodes[cleanCountry.toLowerCase()];

  if (!code) {
    return `<div class="flag-placeholder">🌍</div>`;
  }

  return `<img class="flag-img" src="https://flagcdn.com/w80/${code}.png" alt="${cleanCountry} flag">`;
}

function formatPresidents(presidents) {
  return String(presidents || "")
    .split(";")
    .map(name => name.trim())
    .filter(Boolean)
    .join("<br>");
}
 
function showInfoCard(missionaries) {
  const list = Array.isArray(missionaries) ? missionaries : [missionaries];

  if (list.length === 1) {
    const m = list[0];

    const name = getName(m);
    const sex = getSex(m);
    const language = getLanguage(m);
    const mission = getMissionName(m);
    const country = getCountry(m);
    const state = getState(m);
    const start = getStartDate(m);
    const end = getEndDate(m);
    const presidents = getPresidents(m);
    const spouse = getSpouse(m);

    document.getElementById("infoCardContent").innerHTML = `
      <h2>${getTitle(sex, name, language)}</h2>

      <div class="card-divider"></div>

      <div class="card-location-small">
        ${getFlagImage(country, state)}
        <div class="card-mission">${mission || ""}</div>
      </div>

      <div class="card-dates">${start || ""} – ${end || ""}</div>

      ${presidents ? `<div class="card-presidents">${formatPresidents(presidents)}</div>` : ""}

      ${spouse ? `<div class="card-spouse">Married to ${spouse}</div>` : ""}
    `;
  } else {
    const first = list[0];
    const mission = getMissionName(first);
    const country = getCountry(first);
    const state = getState(first);

    document.getElementById("infoCardContent").innerHTML = `
      <h2>${mission}</h2>

      <div class="card-divider"></div>

      <div class="card-location-small">
        ${getFlagImage(country, state)}
        <div class="card-mission">${list.length} missionaries served here</div>
      </div>

      <div class="missionary-list">
        ${list.map(m => `
          <div class="missionary-list-item">
            <strong>${getTitle(getSex(m), getName(m), getLanguage(m))}</strong>
            <span>${getStartDate(m) || ""} – ${getEndDate(m) || ""}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  document.getElementById("infoCard").classList.remove("hidden");
}

function matchesFamily(m) {
  const selected = document.getElementById("familyFilter").value;

  if (selected === "all") return true;

  return normalize(getRelation(m)).includes(normalize(selected));
}

function matchesSex(m) {
  const showElders = document.getElementById("showElders").checked;
  const showSisters = document.getElementById("showSisters").checked;

  return getSex(m) === "Female" ? showSisters : showElders;
}

function getFilteredData() {
  return allMissionaries.filter(m => matchesFamily(m) && matchesSex(m));
}

function updateStats(data) {
  document.getElementById("totalMissionaries").textContent = data.length;

  document.getElementById("totalElders").textContent =
    data.filter(m => getSex(m) !== "Female").length;

  document.getElementById("totalSisters").textContent =
    data.filter(m => getSex(m) === "Female").length;

  const countries = new Set(data.map(m => getCountry(m)).filter(Boolean));

  const languages = new Set();

  data.forEach(m => {
    String(getLanguage(m) || "")
      .split(/,|;|\/|&/)
      .map(x => x.trim())
      .filter(Boolean)
      .forEach(lang => languages.add(lang));
  });

  const continents = new Set(
    data.map(m => CONTINENTS[getCountry(m)]).filter(Boolean)
  );

  document.getElementById("countriesServed").textContent = countries.size;
  document.getElementById("totalLanguages").textContent = languages.size;
  document.getElementById("totalContinents").textContent = continents.size;
}

function clearMarkers() {
  allMarkers.forEach(marker => map.removeLayer(marker));
  allMarkers = [];
}

function groupByCoordinates(data) {
  const groups = {};

  data.forEach(m => {
    if (!m.coords) return;

    const key = `${m.coords.lat},${m.coords.lng}`;

    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });

  return Object.values(groups);
}

function drawMarkers() {
  clearMarkers();

  const data = getFilteredData();
  updateStats(data);

  const groups = groupByCoordinates(data);
  const bounds = [];

  groups.forEach(group => {
    const first = group[0];
    const coords = first.coords;

    let markerColor = getColor(getSex(first));
    let markerShape = getMarkerShape(first);

    if (group.length > 1) {
      const hasFemale = group.some(m => getSex(m) === "Female");
      const hasMale = group.some(m => getSex(m) !== "Female");

      if (hasFemale && !hasMale) markerColor = "#ec4899";
      if (hasMale && !hasFemale) markerColor = "#2563eb";
      if (hasFemale && hasMale) markerColor = "#6d28d9";

      if (group.some(m => isCurrentlyServing(m))) markerShape = "star";
      else if (group.some(m => isInLaw(m))) markerShape = "heart";
      else markerShape = "circle";
    }

    const marker = L.marker([coords.lat, coords.lng], {
      icon: createIcon(markerShape, markerColor, group.length)
    }).addTo(map);

    marker.on("mouseover", () => showInfoCard(group));
    marker.on("click", () => {
      showInfoCard(group);
      map.panTo([coords.lat, coords.lng]);
    });

    allMarkers.push(marker);
    bounds.push([coords.lat, coords.lng]);
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, {
      padding: [80, 80],
      maxZoom: 5
    });
  }
}

async function buildMap() {
  const missionaries = await loadSheet(MISSIONARY_SHEET_NAME);
  const coordinates = await loadSheet(COORDINATES_SHEET_NAME);

  const coordLookup = {};

  coordinates.forEach(row => {
    const missionName = getValue(row, [
      "Official Mission name (Ex: Maryland Baltimore)",
      "Official Mission Name",
      "Official Mission name",
      "Mission Name"
    ]);

    const lat = Number(getValue(row, ["Latitude", "Lat"]));
    const lng = Number(getValue(row, ["Longitude", "Long", "Lng"]));

    if (!missionName || isNaN(lat) || isNaN(lng)) return;

    coordLookup[normalize(missionName)] = { lat, lng };
  });

  allMissionaries = missionaries.map(m => {
    const missionName = getMissionName(m);
    const coords = coordLookup[normalize(missionName)] || null;

    if (!coords) {
      console.warn("No coordinates found for mission:", missionName);
    }

    return {
      ...m,
      coords
    };
  });

  drawMarkers();
}

document.getElementById("showElders").addEventListener("change", drawMarkers);
document.getElementById("showSisters").addEventListener("change", drawMarkers);
document.getElementById("familyFilter").addEventListener("change", drawMarkers);

document.getElementById("closeCard").addEventListener("click", () => {
  document.getElementById("infoCard").classList.add("hidden");
});

buildMap();
