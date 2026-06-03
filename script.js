const PRESENT_COLOR = "#43a047";
const ABSENT_COLOR = "#ff9800";
const BTN_GRAY = "#9e9e9e";
const BTN_RED = "#e53935";
const TEXT_WHITE = "#ffffff";
const TEXT_RED = "#e53935";
const TEXT_PRESENT = "Direttore Presente";
const TEXT_ABSENT = "Direttore Assente";

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
    await readPeopleCount();
    subscribePeopleCount();
  } catch (e) {
    roomStatus.textContent = "Init Error: " + e.message;
    applyUiState(false, false);
  }
}

// --- Comandi Nativi (WebView) ---

async function showOsdRichiestaAccesso() {
  try {
    // Utilizziamo WebView.Display via JSON-RPC nativo
    // Questo è il metodo più compatibile per mostrare contenuti a video
    await xapi.Command.UserInterface.WebView.Display({
      Mode: "Modal",
      Target: "OSD",
      Title: "RICHIESTA DI ACCESSO",
      Url: "data:text/html,<html><body style='display:flex; justify-content:center; align-items:center; height:100vh; background:white; font-size:8vw; font-weight:bold; color:red; font-family:sans-serif; text-transform:uppercase;'>RICHIESTA DI ACCESSO</body></html>"
    });
    osdRichiestaVisible = true;
  } catch (e) {
    roomStatus.textContent = "WV Err: " + e.message;
  }
}

async function clearOsdRichiestaAccesso() {
  try {
    await xapi.Command.UserInterface.WebView.Clear({
      Target: "OSD"
    });
    osdRichiestaVisible = false;
  } catch (e) {
    roomStatus.textContent = "Clear Err: " + e.message;
  }
}

async function syncOsdWithPending(isPending) {
  if (isPending && !osdRichiestaVisible) await showOsdRichiestaAccesso();
  else if (!isPending && osdRichiestaVisible) await clearOsdRichiestaAccesso();
}

// --- Logica di Stato e UI ---

function applyUiState(isPresent, isPending) {
  directorPresent = isPresent;
  accessRequestPending = isPending && isPresent;

  if (isPresent) {
    topPanel.style.backgroundColor = PRESENT_COLOR;
    bottomPanel.style.backgroundColor = PRESENT_COLOR;
    if (!roomStatus.textContent.startsWith("WV")) roomStatus.textContent = TEXT_PRESENT;
    
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
