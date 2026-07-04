/* =====================================================
   FILTERS + SEARCH + TIMELINE
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

function matchesCurrentFilter(m) {
  const showCurrent = document.getElementById("showCurrent").checked;

  if (showCurrent) return true;

  return !isCurrentlyServing(m);
}

function matchesInLawFilter(m) {
  const showInLaws = document.getElementById("showInLaws").checked;

  if (showInLaws) return true;

  return !isInLaw(m);
}

function matchesSearch(m) {
  if (!activeSearch) return true;

  const haystack = [
    getName(m),
    getMissionName(m),
    getCountry(m),
    getState(m),
    getCity(m),
    getLanguage(m),
    getRelation(m)
  ].join(" ");

  return normalize(haystack).includes(normalize(activeSearch));
}

function matchesTimeline(m) {
  if (allYearsMode) return true;
  return servedDuringYear(m, Number(activeYear));
}

function getFilteredData() {
  return allMissionaries.filter(m => {
    return (
      matchesFamily(m) &&
      matchesSex(m) &&
      matchesCurrentFilter(m) &&
      matchesInLawFilter(m) &&
      matchesSearch(m) &&
      matchesTimeline(m)
    );
  });
}

/* =====================================================
   EVENT LISTENERS
===================================================== */

function setupFilters() {
  document.getElementById("showElders").addEventListener("change", drawMarkers);
  document.getElementById("showSisters").addEventListener("change", drawMarkers);
  document.getElementById("showCurrent").addEventListener("change", drawMarkers);
  document.getElementById("showInLaws").addEventListener("change", drawMarkers);
  document.getElementById("familyFilter").addEventListener("change", drawMarkers);

  document.getElementById("searchInput").addEventListener("input", event => {
    activeSearch = event.target.value;
    drawMarkers();
  });

  document.getElementById("timelineSlider").addEventListener("input", event => {
    activeYear = Number(event.target.value);
    allYearsMode = false;
    document.getElementById("timelineYearLabel").textContent = activeYear;
    drawMarkers();
  });

  document.getElementById("showAllYears").addEventListener("click", () => {
    allYearsMode = true;
    activeYear = "all";
    document.getElementById("timelineYearLabel").textContent = "All Years";
    drawMarkers();
  });

  document.getElementById("showToday").addEventListener("click", () => {
    allYearsMode = false;
    activeYear = new Date().getFullYear();

    document.getElementById("timelineSlider").value = activeYear;
    document.getElementById("timelineYearLabel").textContent = "Today";

    drawMarkers();
  });
}
