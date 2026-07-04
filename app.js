console.log("🔥 APP.JS LOADED");

/* =====================================================
   GOOGLE SHEET SETTINGS
===================================================== */

const SHEET_ID = "15BJwH_54gL9fWGCtg0FOwF_qYy4mAm7KWN1LVnSBl5w";

const MISSIONARY_SHEET_NAME = "Form Responses 1";
const COORDINATES_SHEET_NAME = "Coordinates";

/* =====================================================
   MAP SETUP
===================================================== */

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

/* =====================================================
   GLOBAL STATE
===================================================== */

let allMissionaries = [];
let allMarkers = [];

/* =====================================================
   LANGUAGE TITLES
===================================================== */

const TITLE_BY_LANGUAGE = {
  English: { elder: "Elder", sister: "Sister" },
  Spanish: { elder: "Élder", sister: "Hermana" },
  Italian: { elder: "Elder", sister: "Sorella" },
  French: { elder: "Elder", sister: "Sœur" },
  German: { elder: "Elder", sister: "Schwester" },
  Portuguese: { elder: "Élder", sister: "Sister" },
  Danish: { elder: "Ældste", sister: "Søster" }
};

/* =====================================================
   CONTINENTS
===================================================== */

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

/* =====================================================
   BASIC HELPERS
===================================================== */

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

/* =====================================================
   COLUMN GETTERS
===================================================== */

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
  return getValue(m, [
    "Who is your Haag relation?",
    "Haag relation",
    "Relation"
  ]);
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

function getCity(m) {
  return getValue(m, ["City", "Mission City"]);
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
/* =====================================================
   DATE HELPERS
===================================================== */

function formatMissionDate(dateString) {

    if (!dateString) return "";

    const months = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December"
    ];

    const parts = String(dateString).split("/");

    if(parts.length !== 2) return dateString;

    const month = parseInt(parts[0],10);

    if(month < 1 || month > 12) return dateString;

    return `${months[month-1]} ${parts[1]}`;

}

function missionLength(start,end){

    if(!start || !end) return "";

    const s = start.split("/");
    const e = end.split("/");

    if(s.length!==2 || e.length!==2) return "";

    const startDate = new Date(
        Number(s[1]),
        Number(s[0])-1
    );

    const endDate = new Date(
        Number(e[1]),
        Number(e[0])-1
    );

    const months =
        (endDate.getFullYear()-startDate.getFullYear())*12 +
        (endDate.getMonth()-startDate.getMonth()) + 1;

    return `${months} month${months===1?"":"s"}`;

}

function isCurrentlyServing(m){

    const end = getEndDate(m);

    if(!end) return false;

    const parts = end.split("/");

    if(parts.length!==2) return false;

    const missionEnd = new Date(
        Number(parts[1]),
        Number(parts[0]),
        0
    );

    return missionEnd >= new Date();

}

function formatMissionDates(m){

    const start = getStartDate(m);
    const end = getEndDate(m);

    if(isCurrentlyServing(m)){

        return `
            <div class="card-date-main">
                ${formatMissionDate(start)} – Present
            </div>

            <div class="currently-serving">
                ✓ Currently Serving
            </div>
        `;

    }

    return `
        <div class="card-date-main">
            ${formatMissionDate(start)} – ${formatMissionDate(end)}
        </div>

        <div class="mission-length">
            ${missionLength(start,end)}
        </div>
    `;

}

/* =====================================================
   MISSION PRESIDENTS
===================================================== */

function formatPresidents(text){

    if(!text) return "";

    return text
        .split(";")
        .map(x=>x.trim())
        .filter(Boolean)
        .join("<br>");

}

/* =====================================================
   TITLES
===================================================== */

function getTitle(sex,name,language){

    const lang =
        String(language || "English")
        .split(",")[0]
        .trim();

    const titles =
        TITLE_BY_LANGUAGE[lang] ||
        TITLE_BY_LANGUAGE.English;

    const prefix =
        sex==="Female"
            ? titles.sister
            : titles.elder;

    return `${prefix} ${name}`;

}

/* =====================================================
   COLORS
===================================================== */

function getColor(sex){

    return sex==="Female"
        ? "#ec4899"
        : "#2563eb";

}

/* =====================================================
   RELATIONSHIPS
===================================================== */

function isInLaw(m){

    return normalize(
        getRelationshipToElvaDarrell(m)
    ).includes("in-law");

}

/* =====================================================
   FLAG IMAGES
===================================================== */

function getFlagImage(country,state){

    country = String(country||"").trim();
    state = String(state||"").trim();

    const countryCodes = {

        "United States":"us",
        "USA":"us",
        "US":"us",

        "Brazil":"br",

        "Italy":"it",

        "Germany":"de",

        "France":"fr",

        "Spain":"es",

        "Denmark":"dk",

        "Mexico":"mx",

        "Canada":"ca",

        "England":"gb",

        "United Kingdom":"gb",

        "Japan":"jp",

        "Australia":"au",

        "New Zealand":"nz",

        "Argentina":"ar",

        "Chile":"cl",

        "Peru":"pe",

        "Colombia":"co",

        "Philippines":"ph"

    };

    const usStateFlags={

        "Maryland":"maryland",
        "Louisiana":"louisiana",
        "Utah":"utah",
        "Ohio":"ohio",
        "Washington":"washington",
        "Oregon":"oregon",
        "Connecticut":"connecticut"

    };

    if(
        ["United States","USA","US"].includes(country)
        &&
        usStateFlags[state]
    ){

        return `
        <img
            class="flag-img"
            src="https://upload.wikimedia.org/wikipedia/commons/${getUSFlagPath(state)}"
            alt="${state}">
        `;

    }

    const code = countryCodes[country];

    if(!code){

        return `<div class="flag-placeholder">🌍</div>`;

    }

    return `
        <img
            class="flag-img"
            src="https://flagcdn.com/w80/${code}.png"
            alt="${country}">
    `;

}

/* =====================================================
   US STATE FLAG PATHS
===================================================== */

function getUSFlagPath(state){

    const flags={

        Maryland:"a/a0/Flag_of_Maryland.svg",

        Louisiana:"e/e0/Flag_of_Louisiana.svg",

        Utah:"f/f6/Flag_of_Utah.svg",

        Ohio:"4/4c/Flag_of_Ohio.svg",

        Washington:"5/54/Flag_of_Washington.svg",

        Oregon:"b/b9/Flag_of_Oregon.svg",

        Connecticut:"9/96/Flag_of_Connecticut.svg"

    };

    return flags[state];

}
/* =====================================================
   MARKERS — OPTION B
   Normal: dot
   Current: dot with checkmark
   In-law: heart
   Multiple: numbered dot
===================================================== */

function createMarkerIcon(group) {
  const count = group.length;
  const first = group[0];

  const hasMale = group.some(m => getSex(m) !== "Female");
  const hasFemale = group.some(m => getSex(m) === "Female");
  const hasCurrent = group.some(m => isCurrentlyServing(m));
  const hasInLaw = group.some(m => isInLaw(m));

  let color = getColor(getSex(first));

  if (hasMale && hasFemale) {
    color = "#7c3aed";
  }

  let inner = "";

  if (count > 1) {
    inner = `<span class="marker-number">${count}</span>`;
  } else if (hasCurrent) {
    inner = `<span class="marker-check">✓</span>`;
  }

  const shapeClass = hasInLaw && count === 1 ? "mission-marker heart-marker" : "mission-marker dot-marker";

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div class="${shapeClass}" style="--marker-color:${color}">
        ${inner}
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -12]
  });
}

/* =====================================================
   POPUP HTML
===================================================== */

function missionaryPopupHtml(m) {
  const name = getName(m);
  const sex = getSex(m);
  const language = getLanguage(m);
  const mission = getMissionName(m);
  const country = getCountry(m);
  const state = getState(m);
  const presidents = getPresidents(m);
  const spouse = getSpouse(m);

  return `
    <div class="leaflet-mission-popup">
      <h2>${getTitle(sex, name, language)}</h2>

      <div class="card-divider"></div>

      <div class="card-location-small">
        ${getFlagImage(country, state)}
        <div>
          <div class="card-mission">${mission || ""}</div>
          ${language ? `<div class="popup-language">${language}</div>` : ""}
        </div>
      </div>

      <div class="card-dates">
        ${formatMissionDates(m)}
      </div>

      ${presidents ? `<div class="card-presidents">${formatPresidents(presidents)}</div>` : ""}

      ${spouse ? `<div class="card-spouse">Married to ${spouse}</div>` : ""}
    </div>
  `;
}

function groupPopupHtml(group) {
  const first = group[0];
  const mission = getMissionName(first);
  const country = getCountry(first);
  const state = getState(first);
  const languageSet = new Set(
    group
      .map(m => getLanguage(m))
      .filter(Boolean)
  );

  return `
    <div class="leaflet-mission-popup">
      <h2>${mission}</h2>

      <div class="card-divider"></div>

      <div class="card-location-small">
        ${getFlagImage(country, state)}
        <div>
          <div class="card-mission">${group.length} missionaries served here</div>
          ${
            languageSet.size
              ? `<div class="popup-language">${Array.from(languageSet).join(", ")}</div>`
              : ""
          }
        </div>
      </div>

      <div class="missionary-list">
        ${group.map((m, index) => `
          <button
            type="button"
            class="missionary-list-item"
            data-index="${index}"
          >
            <strong>${getTitle(getSex(m), getName(m), getLanguage(m))}</strong>
            <span>${formatMissionDate(getStartDate(m))} – ${
              isCurrentlyServing(m) ? "Present" : formatMissionDate(getEndDate(m))
            }</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

/* =====================================================
   POPUP EVENTS
===================================================== */

function attachPopupEvents(marker, group) {
  marker.on("popupopen", event => {
    const popupEl = event.popup.getElement();
    if (!popupEl) return;

    popupEl.querySelectorAll(".missionary-list-item").forEach(button => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.index);
        const missionary = group[index];

        marker.setPopupContent(missionaryPopupHtml(missionary));
        marker.openPopup();
      });
    });
  });
}

function bindMarkerPopup(marker, group) {
  if (group.length === 1) {
    marker.bindPopup(missionaryPopupHtml(group[0]), {
      closeButton: true,
      autoPan: true,
      maxWidth: 360,
      className: "haag-leaflet-popup"
    });
  } else {
    marker.bindPopup(groupPopupHtml(group), {
      closeButton: true,
      autoPan: true,
      maxWidth: 380,
      className: "haag-leaflet-popup"
    });

    attachPopupEvents(marker, group);
  }

  marker.on("mouseover", () => {
    marker.openPopup();
  });

  marker.on("click", () => {
    marker.openPopup();
  });
}

/* =====================================================
   FILTERS
===================================================== */

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
/* =====================================================
   STATISTICS
===================================================== */

function updateStats(data) {
  document.getElementById("totalMissionaries").textContent = data.length;

  document.getElementById("totalElders").textContent =
    data.filter(m => getSex(m) !== "Female").length;

  document.getElementById("totalSisters").textContent =
    data.filter(m => getSex(m) === "Female").length;

  document.getElementById("countriesServed").textContent =
    new Set(data.map(m => getCountry(m)).filter(Boolean)).size;

  const languages = new Set();

  data.forEach(m => {
    String(getLanguage(m) || "")
      .split(/,|;|\/|&/)
      .map(x => x.trim())
      .filter(Boolean)
      .forEach(lang => languages.add(lang));
  });

  document.getElementById("totalLanguages").textContent = languages.size;

  document.getElementById("totalContinents").textContent =
    new Set(data.map(m => CONTINENTS[getCountry(m)]).filter(Boolean)).size;
}

/* =====================================================
   MARKER GROUPING
===================================================== */

function clearMarkers() {
  allMarkers.forEach(marker => map.removeLayer(marker));
  allMarkers = [];
}

function groupByMission(data) {
  const groups = {};

  data.forEach(m => {
    if (!m.coords) return;

    const key = normalize(getMissionName(m));

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(m);
  });

  return Object.values(groups);
}

/* =====================================================
   DRAW MAP
===================================================== */

function drawMarkers() {
  clearMarkers();

  const data = getFilteredData();
  updateStats(data);

  const groups = groupByMission(data);
  const bounds = [];

  groups.forEach(group => {
    const first = group[0];
    const coords = first.coords;

    const marker = L.marker([coords.lat, coords.lng], {
      icon: createMarkerIcon(group)
    }).addTo(map);

    bindMarkerPopup(marker, group);

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

/* =====================================================
   BUILD MAP FROM GOOGLE SHEET
===================================================== */

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

/* =====================================================
   EVENT LISTENERS
===================================================== */

document.getElementById("showElders").addEventListener("change", drawMarkers);
document.getElementById("showSisters").addEventListener("change", drawMarkers);
document.getElementById("familyFilter").addEventListener("change", drawMarkers);

buildMap();
