const PRESENT_COLOR = "#43a047";
const ABSENT_COLOR = "#ff9800";
const BTN_GRAY = "#9e9e9e";
const BTN_RED = "#e53935";
const TEXT_WHITE = "#ffffff";
const TEXT_RED = "#e53935";
const TEXT_PRESENT = "Direttore Presente";
const TEXT_ABSENT = "Direttore Assente";
const OSD_TARGET = "OSD";

/** Desk Pro — oppure ?desk=https://192.168.x.x nell'URL PWA */
const DESK_HOST = "192.168.254.9";
const DESK_API_USER = "admin";
const DESK_API_PASS = "Cisco2026!";

const BUTTON = {
  present: { label: "Richiedi Accesso", bg: BTN_GRAY, fg: TEXT_WHITE, clickable: true },
  pending: { label: "Attendere Autorizzazione", bg: BTN_RED, fg: TEXT_WHITE, clickable: true },
  absent: { label: "Divieto di Accesso", bg: BTN_GRAY, fg: TEXT_RED, clickable: false },
};

let topPanel, bottomPanel, roomStatus, accessButton, accessButtonLabel;
let xapi;
let peopleCountCurrent = 0;
let accessRequestPending = false;
let directorPresent = false;
let lastButtonTapMs = 0;
let osdRichiestaVisible = false;
let deskHost = "";
let deskHttpReady = false;

function boot() {
  topPanel = document.getElementById("topPanel");
  bottomPanel = document.getElementById("bottomPanel");
  roomStatus = document.getElementById("roomStatus");
  accessButton = document.getElementById("accessButton");
  accessButtonLabel = document.getElementById("accessButtonLabel");

  if (!accessButton || !accessButtonLabel) return;

  accessButton.addEventListener("touchend", handleAccessButtonTouch, { passive: false });
  accessButton.addEventListener("click", handleAccessButtonClick);

  applyUiState(false, false);
  init();
}

document.addEventListener("DOMContentLoaded", boot);

async function init() {
  try {
    xapi = await window.getXAPI();
    await xapi.Config.UserInterface.LedControl.Mode.set("Manual");
    deskHost = resolveDeskHost();
    await initDeskHttpClient();
    await readPeopleCount();
    subscribePeopleCount();
  } catch (e) {
    applyUiState(false, false);
  }
}

// --- Funzioni di Rete e XML ---

function resolveDeskHost() {
  const fromUrl = new URLSearchParams(window.location.search).get("desk");
  if (fromUrl) return peerBaseUrl(fromUrl);
  return DESK_HOST && DESK_HOST !== "CHANGE_ME" ? peerBaseUrl(DESK_HOST) : "";
}

function peerBaseUrl(hostSetting) {
  let base = String(hostSetting).trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(base) ? base : "https://" + base;
}

function peerUrl(path) { return deskHost + (path.startsWith("/") ? path : "/" + path); }

function authHeader() {
  if (!DESK_API_USER || !DESK_API_PASS) return "";
  return "Authorization: Basic " + btoa(DESK_API_USER + ":" + DESK_API_PASS);
}

function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function alertDisplayXml(text, duration) {
  return `<Command><UserInterface><Message><Alert><Display><Duration>${duration}</Duration><Target>${OSD_TARGET}</Target><Text>${escapeXml(text)}</Text></Display></Alert></Message></UserInterface></Command>`;
}

function alertClearXml() {
  return `<Command><UserInterface><Message><Alert><Clear/></Alert></Message></UserInterface></Command>`;
}

async function initDeskHttpClient() {
  if (!deskHost) return;
  try {
    const host = new URL(deskHost).hostname;
    await xapi.Command.HttpClient.Allow.Hostname.Add({ Hostname: host });
    deskHttpReady = true;
  } catch (e) { deskHttpReady = true; }
}

async function sendDeskCommand(xmlBody) {
  if (!xapi || !deskHost) return false;
  try {
    await xapi.Command.HttpClient.Post({ Url: peerUrl("/putxml"), Header: ["Content-Type: application/xml", authHeader()], Timeout: 8, AllowInsecureHTTPS: "True" }, xmlBody);
    return true;
  } catch (e) { return false; }
}

// --- Logica di Stato e UI ---

async function showOsdRichiestaAccesso() {
  const ok = await sendDeskCommand(alertDisplayXml("RICHIESTA DI ACCESSO", 120));
  if (ok) osdRichiestaVisible = true;
}

async function clearOsdRichiestaAccesso() {
  const ok = await sendDeskCommand(alertClearXml());
  if (ok) osdRichiestaVisible = false;
}

async function syncOsdWithPending(isPending) {
  if (isPending && !osdRichiestaVisible) await showOsdRichiestaAccesso();
  else if (!isPending && osdRichiestaVisible) await clearOsdRichiestaAccesso();
}

function applyUiState(isPresent, isPending) {
  directorPresent = isPresent;
  accessRequestPending = isPending && isPresent;

  if (isPresent) {
    topPanel.style.backgroundColor = PRESENT_COLOR;
    bottomPanel.style.backgroundColor = PRESENT_COLOR;
    roomStatus.textContent = TEXT_PRESENT;
    setAccessButton(accessRequestPending ? "pending" : "present");
    syncOsdWithPending(accessRequestPending);
    xapi?.Command?.UserInterface?.LedControl?.Color?.Set({ Color: "Green" }).catch(() => {});
  } else {
    topPanel.style.backgroundColor = ABSENT_COLOR;
    bottomPanel.style.backgroundColor = ABSENT_COLOR;
    roomStatus.textContent = TEXT_ABSENT;
    setAccessButton("absent");
    syncOsdWithPending(false);
    xapi?.Command?.UserInterface?.LedControl?.Color?.Set({ Color: "Yellow" }).catch(() => {});
  }
}

function setAccessButton(mode) {
  const cfg = BUTTON[mode];
  accessButtonLabel.textContent = cfg.label;
  accessButton.style.backgroundColor = cfg.bg;
  accessButtonLabel.style.color = cfg.fg;
  accessButton.style.pointerEvents = cfg.clickable ? "auto" : "none";
}

// --- Eventi e Monitoraggio ---

async function readPeopleCount() {
  try {
    let count = await xapi.Status.RoomAnalytics.PeopleCount.Current.get();
    peopleCountCurrent = parseInt(count == "-1" ? 0 : count, 10) || 0;
    applyUiState(peopleCountCurrent >= 1, accessRequestPending);
  } catch (e) { applyUiState(false, false); }
}

function subscribePeopleCount() {
  xapi.Status.RoomAnalytics.PeopleCount.Current.on((count) => {
    peopleCountCurrent = parseInt(count == "-1" ? 0 : count, 10) || 0;
    if (peopleCountCurrent < 1) accessRequestPending = false;
    applyUiState(peopleCountCurrent >= 1, accessRequestPending);
  });
}

function handleAccessButtonTouch(e) { e.preventDefault(); triggerAccessButtonToggle(); }
function handleAccessButtonClick() { if (Date.now() - lastButtonTapMs > 400) triggerAccessButtonToggle(); }

function triggerAccessButtonToggle() {
  lastButtonTapMs = Date.now();
  if (!directorPresent) return;
  accessRequestPending = !accessRequestPending;
  applyUiState(true, accessRequestPending);
}
