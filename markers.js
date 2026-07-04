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
   MARKERS
===================================================== */

function createMarkerIcon(group) {
  const count = group.length;

  const hasMale = group.some(m => getSex(m) !== "Female");
  const hasFemale = group.some(m => getSex(m) === "Female");
  const hasCurrent = group.some(m => isCurrentlyServing(m));
  const hasInLaw = group.some(m => isInLaw(m));

  let color = getColor(getSex(group[0]));

  if (hasMale && hasFemale) {
    color = "#7c3aed";
  }

  let inner = "";

  if (count > 1) {
    inner = `<span class="marker-number">${count}</span>`;
  } else if (hasCurrent) {
    inner = `<span class="marker-check">✓</span>`;
  }

  const shapeClass =
    hasInLaw && count === 1
      ? "mission-marker heart-marker"
      : "mission-marker dot-marker";

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
