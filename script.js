const topPanel = document.getElementById("topPanel");
const bottomPanel = document.getElementById("bottomPanel");
const roomStatus = document.getElementById("roomStatus");
const accessButton = document.getElementById("accessButton");

const PRESENT_COLOR = "#43a047";
const ABSENT_COLOR = "#ff9800";
const TEXT_PRESENT = "Direttore Presente";
const TEXT_ABSENT = "Direttore Assente";

const BTN_GRAY = "#9e9e9e";
const BTN_RED = "#e53935";
const COLOR_WHITE = "#ffffff";
const COLOR_RED_TEXT = "#e53935";

let xapi;
let peopleCountCurrent = 0;
let accessRequestPending = false;

window.onload = async function () {
  accessButton.addEventListener("click", handleAccessButtonClick);
  init();
};

async function init() {
  try {
    xapi = await window.getXAPI();
    xapi.Config.UserInterface.LedControl.Mode.set("Manual").catch(() => {});
    getInitial();
    subscribe();
  } catch (e) {
    console.log("Impossibile connettersi al device:", e);
    displayAbsent();
  }
}

async function getInitial() {
  xapi.Status.RoomAnalytics.PeopleCount.Current.get().then((currentCount) => {
    if (currentCount == "-1") currentCount = 0;
    peopleCountCurrent = parseInt(currentCount, 10) || 0;
    updatePresence();
  });
}

function subscribe() {
  xapi.Status.RoomAnalytics.PeopleCount.Current.on((currentCount) => {
    if (currentCount == "-1") currentCount = 0;
    peopleCountCurrent = parseInt(currentCount, 10) || 0;
    updatePresence();
  });
}

function handleAccessButtonClick() {
  if (peopleCountCurrent < 1 || accessRequestPending) return;
  accessRequestPending = true;
  updateAccessButton();
}

function updatePresence() {
  if (peopleCountCurrent >= 1) {
    displayPresent();
  } else {
    displayAbsent();
  }
}

function setStatusBarColor(color) {
  topPanel.style.backgroundColor = color;
  bottomPanel.style.backgroundColor = color;
}

function setStatusText(text) {
  roomStatus.innerHTML = text;
}

function updateAccessButton() {
  if (peopleCountCurrent >= 1) {
    if (accessRequestPending) {
      accessButton.disabled = true;
      accessButton.style.backgroundColor = BTN_RED;
      accessButton.style.color = COLOR_WHITE;
      accessButton.textContent = "Attendere Autorizzazione";
      return;
    }
    accessButton.disabled = false;
    accessButton.style.backgroundColor = BTN_GRAY;
    accessButton.style.color = COLOR_WHITE;
    accessButton.textContent = "Richiedi accesso";
    return;
  }

  accessButton.disabled = true;
  accessButton.style.backgroundColor = BTN_GRAY;
  accessButton.style.color = COLOR_RED_TEXT;
  accessButton.textContent = "Divieto di Accesso";
}

function displayPresent() {
  setStatusBarColor(PRESENT_COLOR);
  setStatusText(TEXT_PRESENT);
  updateAccessButton();
  xapi?.Command?.UserInterface?.LedControl?.Color?.Set({ Color: "Green" }).catch(
    () => {}
  );
}

function displayAbsent() {
  accessRequestPending = false;
  setStatusBarColor(ABSENT_COLOR);
  setStatusText(TEXT_ABSENT);
  updateAccessButton();
  xapi?.Command?.UserInterface?.LedControl?.Color?.Set({ Color: "Yellow" }).catch(
    () => {}
  );
}
