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

let topPanel;
let bottomPanel;
let roomStatus;
let accessButton;
let accessButtonLabel;

let xapi;
let peopleCountCurrent = 0;
let accessRequestPending = false;
let directorPresent = false;
let lastButtonTapMs = 0;

function boot() {
  topPanel = document.getElementById("topPanel");
  bottomPanel = document.getElementById("bottomPanel");
  roomStatus = document.getElementById("roomStatus");
  accessButton = document.getElementById("accessButton");
  accessButtonLabel = document.getElementById("accessButtonLabel");

  if (!accessButton || !accessButtonLabel) {
    console.log("Elementi pulsante non trovati");
    return;
  }

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
    console.log("Impossibile connettersi al device:", e);
    applyUiState(false, false);
  }
}

async function readPeopleCount() {
  try {
    let currentCount = await xapi.Status.RoomAnalytics.PeopleCount.Current.get();
    if (currentCount == "-1") currentCount = 0;
    peopleCountCurrent = parseInt(currentCount, 10) || 0;
    applyUiState(peopleCountCurrent >= 1, accessRequestPending);
  } catch (e) {
    console.log("PeopleCount non disponibile:", e);
    applyUiState(false, false);
  }
}

function subscribePeopleCount() {
  xapi.Status.RoomAnalytics.PeopleCount.Current.on((currentCount) => {
    if (currentCount == "-1") currentCount = 0;
    peopleCountCurrent = parseInt(currentCount, 10) || 0;
    if (peopleCountCurrent < 1) {
      accessRequestPending = false;
    }
    applyUiState(peopleCountCurrent >= 1, accessRequestPending);
  });
}

function handleAccessButtonTouch(event) {
  event.preventDefault();
  triggerAccessButtonToggle();
}

function handleAccessButtonClick() {
  if (Date.now() - lastButtonTapMs < 400) return;
  triggerAccessButtonToggle();
}

function triggerAccessButtonToggle() {
  lastButtonTapMs = Date.now();
  if (!directorPresent) return;
  accessRequestPending = !accessRequestPending;
  applyUiState(true, accessRequestPending);
}

function applyUiState(isPresent, isPending) {
  directorPresent = isPresent;
  accessRequestPending = isPending && isPresent;

  if (isPresent) {
    topPanel.style.backgroundColor = PRESENT_COLOR;
    bottomPanel.style.backgroundColor = PRESENT_COLOR;
    roomStatus.textContent = TEXT_PRESENT;
    setAccessButton(isPending ? "pending" : "present");
    xapi?.Command?.UserInterface?.LedControl?.Color?.Set({ Color: "Green" }).catch(
      () => {}
    );
    return;
  }

  topPanel.style.backgroundColor = ABSENT_COLOR;
  bottomPanel.style.backgroundColor = ABSENT_COLOR;
  roomStatus.textContent = TEXT_ABSENT;
  setAccessButton("absent");
  xapi?.Command?.UserInterface?.LedControl?.Color?.Set({ Color: "Yellow" }).catch(
    () => {}
  );
}

function setAccessButton(mode) {
  const cfg = BUTTON[mode];
  accessButtonLabel.textContent = cfg.label;
  accessButton.style.backgroundColor = cfg.bg;
  accessButtonLabel.style.color = cfg.fg;
  accessButton.style.pointerEvents = cfg.clickable ? "auto" : "none";
  accessButton.style.opacity = cfg.clickable ? "1" : "1";
}
