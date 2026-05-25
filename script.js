const topPanel = document.getElementById("topPanel");
const bottomPanel = document.getElementById("bottomPanel");
const roomStatus = document.getElementById("roomStatus");
const statusMain = document.getElementById("statusMain");
const workspaceName = document.getElementById("workspaceName");

const PRESENT_COLOR = "#43a047";
const ABSENT_COLOR = "#ff9800";
const TEXT_PRESENT = "Direttore Presente";
const TEXT_ABSENT = "Direttore Assente";

let xapi;
let peopleCountCurrent = 0;

window.onload = async function () {
  init();
};

async function init() {
  try {
    xapi = await window.getXAPI();
    xapi.Config.UserInterface.LedControl.Mode.set("Manual").catch(() => {});
    getInitial();
    subscribe();
    loadWorkspaceName();
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

async function loadWorkspaceName() {
  try {
    const status = await xapi.Status.get();
    if (status?.Webex?.DevicePersonalization?.Accounts?.[0]?.DisplayName) {
      workspaceName.innerHTML =
        status.Webex.DevicePersonalization.Accounts[0].DisplayName;
      return;
    }
    if (status?.Webex?.Accounts?.[0]?.DisplayName) {
      workspaceName.innerHTML = status.Webex.Accounts[0].DisplayName;
    }
  } catch (e) {
    console.log("Nome workspace non disponibile:", e);
  }
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
  statusMain.innerHTML = text;
}

function displayPresent() {
  setStatusBarColor(PRESENT_COLOR);
  setStatusText(TEXT_PRESENT);
  xapi.Command.UserInterface.LedControl.Color.Set({ Color: "Green" }).catch(
    () => {}
  );
}

function displayAbsent() {
  setStatusBarColor(ABSENT_COLOR);
  setStatusText(TEXT_ABSENT);
  xapi?.Command?.UserInterface?.LedControl?.Color?.Set({ Color: "Yellow" }).catch(
    () => {}
  );
}
