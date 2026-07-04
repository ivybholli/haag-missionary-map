/* =====================================================
   APP STARTUP
===================================================== */

console.log("🔥 HAAG MISSIONARY MAP LOADED");

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

  setupFilters();
  drawMarkers();
}

buildMap();
