/* =====================================================
   STATISTICS
===================================================== */

function countItems(values) {
  const counts = {};

  values
    .filter(Boolean)
    .forEach(value => {
      const key = String(value).trim();
      counts[key] = (counts[key] || 0) + 1;
    });

  return counts;
}

function topItem(values) {
  const counts = countItems(values);
  const entries = Object.entries(counts);

  if (!entries.length) return "--";

  entries.sort((a, b) => b[1] - a[1]);

  return `${entries[0][0]} (${entries[0][1]})`;
}

function getLanguageList(m) {
  return String(getLanguage(m) || "")
    .split(/,|;|\/|&/)
    .map(x => x.trim())
    .filter(Boolean);
}

function updateStats(data) {
  document.getElementById("totalMissionaries").textContent = data.length;

  document.getElementById("totalElders").textContent =
    data.filter(m => getSex(m) !== "Female").length;

  document.getElementById("totalSisters").textContent =
    data.filter(m => getSex(m) === "Female").length;

  document.getElementById("currentMissionaries").textContent =
    data.filter(m => isCurrentlyServing(m)).length;

  document.getElementById("countriesServed").textContent =
    new Set(data.map(m => getCountry(m)).filter(Boolean)).size;

  const languages = new Set();

  data.forEach(m => {
    getLanguageList(m).forEach(lang => languages.add(lang));
  });

  document.getElementById("totalLanguages").textContent = languages.size;

  document.getElementById("totalContinents").textContent =
    new Set(data.map(m => CONTINENTS[getCountry(m)]).filter(Boolean)).size;

  document.getElementById("topLanguage").textContent =
    topItem(data.flatMap(m => getLanguageList(m)));

  document.getElementById("topCountry").textContent =
    topItem(data.map(m => getCountry(m)));

  document.getElementById("topMission").textContent =
    topItem(data.map(m => getMissionName(m)));
}
