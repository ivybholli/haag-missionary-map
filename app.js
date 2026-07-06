console.log("🔥 HAAG FAMILY MISSIONARY MAP v4 LOADED");

const SHEET_ID = "15BJwH_54gL9fWGCtg0FOwF_qYy4mAm7KWN1LVnSBl5w";
const MISSIONARY_SHEET_NAME = "Form Responses 1";
const COORDINATES_SHEET_NAME = "Coordinates";

let allMissionaries = [];
let allMarkers = [];
let selectedYears = new Set();
let activeSearch = "";

const GOOGLE_EARTH_STYLE = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Imagery © Esri"
    },
    labels: {
      type: "raster",
      tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Labels © Esri"
    }
  },
  layers: [
    { id: "satellite", type: "raster", source: "satellite" },
    { id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.82 } }
  ],
  sky: { "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0] }
};

const map = new maplibregl.Map({
  container: "map",
  style: GOOGLE_EARTH_STYLE,
  center: [0, 25],
  zoom: 1.25,
  minZoom: 0,
  maxZoom: 18,
  projection: "globe",
  attributionControl: true
});

map.addControl(new maplibregl.NavigationControl({ showCompass: false, showZoom: true, visualizePitch: false }), "bottom-right");
map.dragRotate.disable();
map.touchZoomRotate.disableRotation();
let currentPopup = null;

const CONTINENTS = {"United States":"North America",USA:"North America",US:"North America",Brazil:"South America",Denmark:"Europe",Germany:"Europe",Italy:"Europe",France:"Europe",Spain:"Europe",Mexico:"North America",Canada:"North America",England:"Europe","United Kingdom":"Europe",Argentina:"South America",Chile:"South America",Peru:"South America",Colombia:"South America",Philippines:"Asia",Japan:"Asia",Australia:"Oceania","New Zealand":"Oceania"};

function normalize(v){return String(v||"").replace(/\s+/g," ").trim().toLowerCase();}
function normalizeNoAccent(v){return normalize(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
function cleanHeader(v){return String(v||"").replace(/\s+/g," ").trim();}
function getValue(row,names){for(const n of names){if(row[n]!==undefined&&row[n]!=="")return row[n];}const keys=Object.keys(row);for(const n of names){const k=keys.find(x=>normalize(x)===normalize(n));if(k&&row[k]!=="")return row[k];}return "";}
async function loadSheet(sheetName){const url=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;const res=await fetch(url);const text=await res.text();const json=JSON.parse(text.substring(47).slice(0,-2));const cols=json.table.cols.map(c=>cleanHeader(c.label));return json.table.rows.map(row=>{const obj={};row.c.forEach((cell,i)=>{obj[cols[i]]=cell?cell.v:""});return obj;});}

function getName(m){return getValue(m,["Missionary Name (First Last) (e.g., Dawn Hollingsworth)","Missionary Name (First Last)","Missionary Name","Name"])}
function getSex(m){return getValue(m,["Biological Sex","Sex","Gender"])}
function getRelation(m){return getValue(m,["Who is your Haag relation?","Haag relation","Relation"])}
function getRelationship(m){return getValue(m,["What is your relationship to Elva and Darrell?","Relationship to Elva and Darrell"])}
function getMissionName(m){return getValue(m,["Official Mission name (Ex: Maryland Baltimore)","Official Mission Name","Official Mission name","Mission Name"])}
function getCity(m){return getValue(m,["City","Mission City"])}
function getState(m){return getValue(m,["State/Region","State","Mission State"])}
function getCountry(m){return getValue(m,["Country","Mission Country"])}
function getLanguage(m){return getValue(m,["Assigned Language(s)","Assigned Languages","Language","Languages"])}
function getStartDate(m){return getValue(m,["Start Date (MM/YYYY)","Start Date"])}
function getEndDate(m){return getValue(m,["End Date (MM/YYYY)","End Date"])}
function getPresidents(m){return getValue(m,["Mission President Names (Ex: President and Sister Piros; President and Sister Varner)","Mission President Names","Mission Presidents"])}
function getSpouse(m){return getValue(m,["Your Spouse's Name (If Applicable)","Spouse","Spouse Name"])}
function getMissionType(m){return getValue(m,["Type of Mission","Mission Type","Type of mission","Mission type"])}

function getTitle(sex,name,language){if(sex!=="Female")return `Elder ${name||""}`;const first=String(language||"English").split(",")[0].trim();const sister={Spanish:"Hermana",Italian:"Sorella",French:"Sœur"};return `${sister[first]||"Sister"} ${name||""}`;}
function getColor(sex){return sex==="Female"?"#ec4899":"#2563eb";}
function isInLaw(m){return normalize(getRelationship(m)).includes("in-law");}
function parseMonthYear(v){if(!v)return null;const p=String(v).trim().split("/");if(p.length!==2)return null;const month=Number(p[0]),year=Number(p[1]);if(!month||!year||month<1||month>12)return null;return {month,year};}
function formatMissionDate(v){const p=parseMonthYear(v);if(!p)return v||"";const months=["January","February","March","April","May","June","July","August","September","October","November","December"];return `${months[p.month-1]} ${p.year}`;}
function isCurrentlyServing(m){const e=parseMonthYear(getEndDate(m));if(!e)return false;return new Date(e.year,e.month,0)>=new Date();}
function missionLength(start,end){const s=parseMonthYear(start),e=parseMonthYear(end);if(!s||!e)return "";const months=(e.year-s.year)*12+(e.month-s.month)+1;return `${months} month${months===1?"":"s"}`;}
function formatMissionDates(m){const s=getStartDate(m),e=getEndDate(m);if(isCurrentlyServing(m))return `<div class="card-date-main">${formatMissionDate(s)} – Present</div><div class="currently-serving">✓ Currently Serving</div>`;return `<div class="card-date-main">${formatMissionDate(s)} – ${formatMissionDate(e)}</div><div class="mission-length">${missionLength(s,e)}</div>`;}
function formatPresidents(t){return String(t||"").split(";").map(x=>x.trim()).filter(Boolean).join("<br>");}
function missionaryYears(m){const s=parseMonthYear(getStartDate(m)),e=parseMonthYear(getEndDate(m));if(!s||!e)return [];const arr=[];for(let y=s.year;y<=e.year;y++)arr.push(y);return arr;}

function escapeHtml(v){return String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function escapeAttr(v){return escapeHtml(v);}
function isOriginalAssignment(m){const t=normalize(getMissionType(m));return !t || t.includes("original");}
function shouldShowMissionType(m){return getMissionType(m) && !isOriginalAssignment(m);}
function findSpouseMissionary(m){const spouseName=normalize(getSpouse(m));if(!spouseName)return null;return allMissionaries.find(x=>normalize(getName(x))===spouseName&&x.coords);}
function findOriginalAssignment(m){const name=normalize(getName(m));return allMissionaries.find(x=>x!==m&&normalize(getName(x))===name&&isOriginalAssignment(x)&&x.coords)||allMissionaries.find(x=>normalize(getName(x))===name&&isOriginalAssignment(x)&&x.coords);}
function findAdditionalAssignments(m){const name=normalize(getName(m));return allMissionaries.filter(x=>x!==m&&normalize(getName(x))===name&&!isOriginalAssignment(x)&&x.coords);}
function makeMissionLink(m,label,extraClass=""){return `<a href="#" class="mission-jump-link ${extraClass}" data-name="${escapeAttr(getName(m))}" data-mission="${escapeAttr(getMissionName(m))}" data-type="${escapeAttr(getMissionType(m))}">${escapeHtml(label)}</a>`;}
function findMissionaryFromDataset(ds){return allMissionaries.find(m=>normalize(getName(m))===normalize(ds.name)&&normalize(getMissionName(m))===normalize(ds.mission)&&normalize(getMissionType(m))===normalize(ds.type))||allMissionaries.find(m=>normalize(getName(m))===normalize(ds.name)&&normalize(getMissionName(m))===normalize(ds.mission));}
function findMarkerForMissionary(m){return allMarkers.find(marker=>marker.missionaryGroup&&marker.missionaryGroup.includes(m));}
function jumpToMissionary(m){if(!m||!m.coords)return;hideDetailPreview();if(currentPopup){currentPopup.remove();currentPopup=null;}map.flyTo({center:[m.coords.lng,m.coords.lat],zoom:Math.max(map.getZoom(),6),duration:1300,essential:true});setTimeout(()=>{const marker=findMarkerForMissionary(m);if(!marker)return;openMarkerPopup(marker,marker.missionaryGroup||[m]);if(marker.missionaryGroup&&marker.missionaryGroup.length>1){setTimeout(()=>{const popupEl=currentPopup&&currentPopup.getElement();const idx=marker.missionaryGroup.indexOf(m);const btn=popupEl&&popupEl.querySelector(`.missionary-list-item[data-index="${idx}"]`);if(btn){btn.classList.add("active");showDetailPreview(m,btn);}},180);}},900);}
function missionMetaHtml(m){const lang=getLanguage(m);const pieces=[];if(lang)pieces.push(escapeHtml(lang));if(shouldShowMissionType(m))pieces.push(`<span class="mission-type-pill">${escapeHtml(getMissionType(m))}</span>`);return pieces.length?`<div class="popup-language mission-meta">${pieces.join('<span class="meta-separator">•</span>')}</div>`:"";}
function assignmentLinksHtml(m){if(!isOriginalAssignment(m)){const original=findOriginalAssignment(m);return original?`<div class="assignment-links">${makeMissionLink(original,"See Original Assignment","original-link")}</div>`:"";}const related=findAdditionalAssignments(m);if(!related.length)return "";return `<div class="assignment-links"><div class="assignment-links-title">Additional Assignments</div>${related.map(r=>makeMissionLink(r,getMissionType(r)||getMissionName(r),"related-link")).join("")}</div>`;}
function spouseHtml(m){const spouse=getSpouse(m);if(!spouse)return "";const spouseMissionary=findSpouseMissionary(m);if(!spouseMissionary)return `<div class="card-spouse">Married to ${escapeHtml(spouse)}</div>`;return `<div class="card-spouse">Married to ${makeMissionLink(spouseMissionary,spouse,"spouse-link")}</div>`;}


function getFlagImage(country,state){const c=String(country||"").replace(/\s+/g," ").trim();const st=String(state||"").replace(/\s+/g," ").trim();const key=normalizeNoAccent(st);const us={maryland:"https://upload.wikimedia.org/wikipedia/commons/a/a0/Flag_of_Maryland.svg",louisiana:"https://upload.wikimedia.org/wikipedia/commons/e/e0/Flag_of_Louisiana.svg",utah:"https://upload.wikimedia.org/wikipedia/commons/f/f6/Flag_of_Utah.svg",ohio:"https://upload.wikimedia.org/wikipedia/commons/4/4c/Flag_of_Ohio.svg",washington:"https://upload.wikimedia.org/wikipedia/commons/5/54/Flag_of_Washington.svg",oregon:"https://upload.wikimedia.org/wikipedia/commons/b/b9/Flag_of_Oregon.svg",connecticut:"https://upload.wikimedia.org/wikipedia/commons/9/96/Flag_of_Connecticut.svg"};const br={goias:"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAwIDcwMCI+PHJlY3Qgd2lkdGg9IjEwMDAiIGhlaWdodD0iNzAwIiBmaWxsPSIjMDA5YjNhIi8+PGcgZmlsbD0iI2ZmZGYwMCI+PHJlY3QgeT0iODcuNSIgd2lkdGg9IjEwMDAiIGhlaWdodD0iODcuNSIvPjxyZWN0IHk9IjI2Mi41IiB3aWR0aD0iMTAwMCIgaGVpZ2h0PSI4Ny41Ii8+PHJlY3QgeT0iNDM3LjUiIHdpZHRoPSIxMDAwIiBoZWlnaHQ9Ijg3LjUiLz48cmVjdCB5PSI2MTIuNSIgd2lkdGg9IjEwMDAiIGhlaWdodD0iODcuNSIvPjwvZz48cmVjdCB3aWR0aD0iMzUwIiBoZWlnaHQ9IjM1MCIgZmlsbD0iIzAwMjc3NiIvPjxnIGZpbGw9IiNmZmYiPjxwb2x5Z29uIHBvaW50cz0iMTc1LDcwIDE4NiwxMDMgMjIxLDEwMyAxOTMsMTI0IDIwNCwxNTcgMTc1LDEzNyAxNDYsMTU3IDE1NywxMjQgMTI5LDEwMyAxNjQsMTAzIi8+PHBvbHlnb24gcG9pbnRzPSIxMDUsMTUwIDExNiwxODMgMTUxLDE4MyAxMjMsMjA0IDEzNCwyMzcgMTA1LDIxNyA3NiwyMzcgODcsMjA0IDU5LDE4MyA5NCwxODMiLz48cG9seWdvbiBwb2ludHM9IjI0NSwxNTAgMjU2LDE4MyAyOTEsMTgzIDI2MywyMDQgMjc0LDIzNyAyNDUsMjE3IDIxNiwyMzcgMjI3LDIwNCAxOTksMTgzIDIzNCwxODMiLz48cG9seWdvbiBwb2ludHM9IjEyMCwyNjAgMTMxLDI5MyAxNjYsMjkzIDEzOCwzMTQgMTQ5LDM0NyAxMjAsMzI3IDkxLDM0NyAxMDIsMzE0IDc0LDI5MyAxMDksMjkzIi8+PHBvbHlnb24gcG9pbnRzPSIyMzAsMjYwIDI0MSwyOTMgMjc2LDI5MyAyNDgsMzE0IDI1OSwzNDcgMjMwLDMyNyAyMDEsMzQ3IDIxMiwzMTQgMTg0LDI5MyAyMTksMjkzIi8+PC9nPjwvc3ZnPg==","rio de janeiro":"https://upload.wikimedia.org/wikipedia/commons/7/73/Bandeira_do_estado_do_Rio_de_Janeiro.svg"};if(["United States","USA","US"].includes(c)&&us[key])return `<img class="flag-img" src="${us[key]}" alt="${st} flag">`;if(c==="Brazil"&&br[key])return `<img class="flag-img" src="${br[key]}" alt="${st} flag">`;const codes={"United States":"us",USA:"us",US:"us",Brazil:"br",Denmark:"dk",Germany:"de",Italy:"it",France:"fr",Spain:"es",Mexico:"mx",Canada:"ca",England:"gb","United Kingdom":"gb",Argentina:"ar",Chile:"cl",Peru:"pe",Colombia:"co",Philippines:"ph",Japan:"jp",Australia:"au","New Zealand":"nz"};const code=codes[c];return code?`<img class="flag-img" src="https://flagcdn.com/w80/${code}.png" alt="${c} flag">`:`<div class="flag-placeholder">🌍</div>`;}

function missionaryPopupHtml(m){const lang=getLanguage(m),pres=getPresidents(m);return `<div class="leaflet-mission-popup single-missionary-popup"><h2>${getTitle(getSex(m),getName(m),lang)}</h2><div class="card-divider"></div><div class="card-location-small">${getFlagImage(getCountry(m),getState(m))}<div><div class="card-mission">${escapeHtml(getMissionName(m)||"")}</div>${missionMetaHtml(m)}</div></div>${assignmentLinksHtml(m)}<div class="card-dates">${formatMissionDates(m)}</div>${pres?`<div class="card-presidents">${formatPresidents(pres)}</div>`:""}${spouseHtml(m)}</div>`;}
function groupPopupHtml(group){const f=group[0];const langs=new Set(group.map(m=>getLanguage(m)).filter(Boolean));return `<div class="leaflet-mission-popup group-mission-popup"><h2>${escapeHtml(getMissionName(f))}</h2><div class="card-divider"></div><div class="card-location-small">${getFlagImage(getCountry(f),getState(f))}<div><div class="card-mission">${group.length} missionaries served here</div>${langs.size?`<div class="popup-language">${Array.from(langs).map(escapeHtml).join(", ")}</div>`:""}</div></div><div class="missionary-list">${group.map((m,i)=>`<button type="button" class="missionary-list-item" data-index="${i}"><strong>${getTitle(getSex(m),getName(m),getLanguage(m))}</strong><span>${formatMissionDate(getStartDate(m))} – ${isCurrentlyServing(m)?"Present":formatMissionDate(getEndDate(m))}${shouldShowMissionType(m)?` • ${escapeHtml(getMissionType(m))}`:""}</span></button>`).join("")}</div></div>`;}
function showDetailPreview(m,anchor){const p=document.getElementById("detailPreview");if(!p||!anchor)return;p.innerHTML=missionaryPopupHtml(m);p.classList.remove("hidden");const r=anchor.getBoundingClientRect();let left=r.right+14,top=r.top;p.style.left=`${left}px`;p.style.top=`${top}px`;const pr=p.getBoundingClientRect();if(pr.right>window.innerWidth-12)left=r.left-pr.width-14;if(pr.bottom>window.innerHeight-12)top=window.innerHeight-pr.height-12;if(top<12)top=12;p.style.left=`${left}px`;p.style.top=`${top}px`;}
function hideDetailPreview(){const p=document.getElementById("detailPreview");if(!p)return;p.classList.add("hidden");p.innerHTML="";document.querySelectorAll(".missionary-list-item.active").forEach(b=>b.classList.remove("active"));}
function handleOutsidePreviewClick(e){const p=document.getElementById("detailPreview");if(!p||p.classList.contains("hidden"))return;if(!p.contains(e.target)&&!e.target.closest(".missionary-list-item")&&!e.target.closest(".mission-jump-link"))hideDetailPreview();}
function setupGroupPopupEvents(popup,group){setTimeout(()=>{const el=popup&&popup.getElement();if(!el)return;el.querySelectorAll(".missionary-list-item").forEach(btn=>{const m=group[Number(btn.dataset.index)];const show=()=>{document.querySelectorAll(".missionary-list-item.active").forEach(b=>b.classList.remove("active"));btn.classList.add("active");showDetailPreview(m,btn);};btn.addEventListener("mouseenter",show);btn.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();show();});});document.addEventListener("click",handleOutsidePreviewClick);},0);popup.on("close",()=>{hideDetailPreview();document.removeEventListener("click",handleOutsidePreviewClick);if(currentPopup===popup)currentPopup=null;});}
function openMarkerPopup(marker,group){if(currentPopup){currentPopup.remove();currentPopup=null;}const maxWidth=group.length===1?"360px":"380px";const html=group.length===1?missionaryPopupHtml(group[0]):groupPopupHtml(group);const popup=new maplibregl.Popup({closeButton:true,closeOnClick:false,maxWidth,className:"haag-leaflet-popup globe-popup"}).setLngLat(marker.getLngLat()).setHTML(html).addTo(map);currentPopup=popup;if(group.length>1)setupGroupPopupEvents(popup,group);return popup;}
function bindMarkerPopup(marker,group){marker.missionaryGroup=group;const el=marker.getElement();el.addEventListener("mouseenter",()=>openMarkerPopup(marker,group));el.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();openMarkerPopup(marker,group);});}
function createMarkerIcon(group){const count=group.length,hasMale=group.some(m=>getSex(m)!=="Female"),hasFemale=group.some(m=>getSex(m)==="Female"),hasCurrent=group.some(isCurrentlyServing),hasInLaw=group.some(isInLaw);let color=getColor(getSex(group[0]));if(hasMale&&hasFemale)color="#7c3aed";let inner="";if(count>1)inner=`<span class="marker-number">${count}</span>`;const cls=["mission-marker",count>1?"duplicate-marker":"",hasCurrent?"current-marker":"",hasInLaw&&count===1?"heart-marker":"dot-marker"].join(" ");const wrapper=document.createElement("div");wrapper.className="custom-marker";wrapper.innerHTML=`<div class="${cls}" style="--marker-color:${color}">${inner}</div>`;return wrapper;}
function clearMarkers(){allMarkers.forEach(m=>m.remove());allMarkers=[];}
function getFilteredData(){return allMissionaries.filter(m=>matchesFamily(m)&&matchesSex(m)&&matchesCurrent(m)&&matchesInLaw(m)&&matchesSearch(m)&&matchesYears(m));}
function matchesFamily(m){const s=document.getElementById("familyFilter").value;return s==="all"||normalize(getRelation(m)).includes(normalize(s));}
function matchesSex(m){return getSex(m)==="Female"?document.getElementById("showSisters").checked:document.getElementById("showElders").checked;}
function matchesCurrent(m){return document.getElementById("showCurrent").checked||!isCurrentlyServing(m);}
function matchesInLaw(m){return document.getElementById("showInLaws").checked||!isInLaw(m);}
function matchesSearch(m){if(!activeSearch)return true;const h=[getName(m),getMissionName(m),getCity(m),getState(m),getCountry(m),getLanguage(m),getMissionType(m),getPresidents(m),getSpouse(m),getRelation(m)].join(" ");return normalize(h).includes(normalize(activeSearch));}
function matchesYears(m){return selectedYears.size===0||missionaryYears(m).some(y=>selectedYears.has(y));}
function groupByMission(data){const groups={};data.forEach(m=>{if(!m.coords)return;const k=normalize(getMissionName(m));if(!groups[k])groups[k]=[];groups[k].push(m);});return Object.values(groups);}
function drawMarkers(){clearMarkers();hideDetailPreview();if(currentPopup){currentPopup.remove();currentPopup=null;}const data=getFilteredData();updateStats(data);const groups=groupByMission(data);let bounds=null;groups.forEach(g=>{const c=g[0].coords;const marker=new maplibregl.Marker({element:createMarkerIcon(g),anchor:"center"}).setLngLat([c.lng,c.lat]).addTo(map);bindMarkerPopup(marker,g);allMarkers.push(marker);if(!bounds)bounds=new maplibregl.LngLatBounds([c.lng,c.lat],[c.lng,c.lat]);else bounds.extend([c.lng,c.lat]);});if(bounds&&!bounds.isEmpty())map.fitBounds(bounds,{padding:{top:80,bottom:80,left:80,right:80},maxZoom:5,duration:900});}
function countItems(values){const c={};values.filter(Boolean).forEach(v=>{const k=String(v).trim();c[k]=(c[k]||0)+1;});return c;}
function topItem(values){const e=Object.entries(countItems(values));if(!e.length)return"--";e.sort((a,b)=>b[1]-a[1]);return `${e[0][0]} (${e[0][1]})`;}
function getLanguageList(m){return String(getLanguage(m)||"").split(/,|;|\/|&/).map(x=>x.trim()).filter(Boolean);}
function updateStats(data){document.getElementById("totalMissionaries").textContent=data.length;document.getElementById("totalElders").textContent=data.filter(m=>getSex(m)!=="Female").length;document.getElementById("totalSisters").textContent=data.filter(m=>getSex(m)==="Female").length;document.getElementById("currentMissionaries").textContent=data.filter(isCurrentlyServing).length;document.getElementById("countriesServed").textContent=new Set(data.map(getCountry).filter(Boolean)).size;document.getElementById("totalContinents").textContent=new Set(data.map(m=>CONTINENTS[getCountry(m)]).filter(Boolean)).size;const langs=new Set();data.forEach(m=>getLanguageList(m).forEach(l=>langs.add(l)));document.getElementById("totalLanguages").textContent=langs.size;const missionCounts=countItems(data.map(getMissionName));document.getElementById("duplicateMissions").textContent=Object.values(missionCounts).filter(n=>n>1).length;document.getElementById("topLanguage").textContent=topItem(data.flatMap(getLanguageList));document.getElementById("topCountry").textContent=topItem(data.map(getCountry));}
function buildYearCheckboxes(){const box=document.getElementById("yearCheckboxes");const years=new Set();allMissionaries.forEach(m=>missionaryYears(m).forEach(y=>years.add(y)));box.innerHTML=Array.from(years).sort((a,b)=>b-a).map(y=>`<label class="year-option"><input type="checkbox" value="${y}"> ${y}</label>`).join("");box.querySelectorAll("input").forEach(input=>input.addEventListener("change",()=>{const y=Number(input.value);input.checked?selectedYears.add(y):selectedYears.delete(y);drawMarkers();}));}
function resetAllFilters(){activeSearch="";selectedYears.clear();const search=document.getElementById("searchInput");if(search)search.value="";document.querySelectorAll("#yearCheckboxes input").forEach(i=>i.checked=false);document.getElementById("familyFilter").value="all";document.getElementById("showElders").checked=true;document.getElementById("showSisters").checked=true;document.getElementById("showCurrent").checked=true;document.getElementById("showInLaws").checked=true;drawMarkers();}
function setupControls(){["showElders","showSisters","showCurrent","showInLaws","familyFilter"].forEach(id=>document.getElementById(id).addEventListener("change",drawMarkers));document.getElementById("searchInput").addEventListener("input",e=>{activeSearch=e.target.value;drawMarkers();});const clearYears=document.getElementById("clearYears");if(clearYears)clearYears.addEventListener("click",()=>{selectedYears.clear();document.querySelectorAll("#yearCheckboxes input").forEach(i=>i.checked=false);drawMarkers();});const clearAll=document.getElementById("clearAllFilters");if(clearAll)clearAll.addEventListener("click",resetAllFilters);document.getElementById("menuToggle").addEventListener("click",()=>{menuPanel.classList.remove("hidden-panel");menuToggle.style.display="none";});document.getElementById("menuClose").addEventListener("click",()=>{menuPanel.classList.add("hidden-panel");menuToggle.style.display="block";});document.getElementById("statsToggle").addEventListener("click",()=>{statsPanel.classList.remove("hidden-panel");statsToggle.style.display="none";});document.getElementById("statsClose").addEventListener("click",()=>{statsPanel.classList.add("hidden-panel");statsToggle.style.display="block";});const isPhone=window.matchMedia("(max-width: 700px)").matches;if(isPhone){menuPanel.classList.add("hidden-panel");statsPanel.classList.add("hidden-panel");menuToggle.style.display="block";statsToggle.style.display="block";}else{menuToggle.style.display="none";statsToggle.style.display="none";}document.addEventListener("click",e=>{const link=e.target.closest(".mission-jump-link");if(!link)return;e.preventDefault();e.stopPropagation();jumpToMissionary(findMissionaryFromDataset(link.dataset));});}
async function buildMap(){const missionaries=await loadSheet(MISSIONARY_SHEET_NAME);const coordinates=await loadSheet(COORDINATES_SHEET_NAME);const lookup={};coordinates.forEach(r=>{const mission=getMissionName(r);const lat=Number(getValue(r,["Latitude","Lat"]));const lng=Number(getValue(r,["Longitude","Long","Lng"]));if(mission&&!isNaN(lat)&&!isNaN(lng))lookup[normalize(mission)]={lat,lng};});allMissionaries=missionaries.map(m=>{const mission=getMissionName(m);const coords=lookup[normalize(mission)]||null;if(!coords)console.warn("No coordinates found for mission:",mission);return {...m,coords};});buildYearCheckboxes();setupControls();drawMarkers();}
buildMap();
