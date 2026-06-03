const PRESENT_COLOR = "#43a047";
const ABSENT_COLOR = "#ff9800";
const TEXT_PRESENT = "Direttore Presente";
const TEXT_ABSENT = "Direttore Assente";

/** TextLine su display RoomOS (codec / periferica) */
const TEXTLINE = {
  duration: 120,
  x: 500,
  y: 500,
  target: "OSD",
  text: "RICHIESTA DI ACCESSO",
  peripheralId: null,
};

let xapi;
let directorPresent = false;
let accessRequestPending = false;
let textLineVisible = false;

function boot() {
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      xapi = await window.getXAPI();

      await xapi.Config.UserInterface.LedControl.Mode.set("Manual");
      await resolveTextLinePeripheralId();

      xapi.Status.RoomAnalytics.PeopleCount.Current.on((count) => {
        const c = parseInt(count == "-1" ? 0 : count, 10) || 0;
        directorPresent = c >= 1;
        if (!directorPresent) {
          accessRequestPending = false;
        }
        updateUI();
      });

      const initialCount = await xapi.Status.RoomAnalytics.PeopleCount.Current.get();
      directorPresent =
        (parseInt(initialCount == "-1" ? 0 : initialCount, 10) || 0) >= 1;
      updateUI();

      document.getElementById("accessButton").addEventListener("click", () => {
        if (directorPresent) {
          accessRequestPending = !accessRequestPending;
          updateUI();
        }
      });
    } catch (e) {
      console.error("Init error:", e);
    }
  });
}

async function resolveTextLinePeripheralId() {
  if (!xapi) return;

  try {
    const devices = await xapi.Status.Peripherals.ConnectedDevice.get();
    const list = Array.isArray(devices) ? devices : [devices];
    const navigator = list.find(
      (d) =>
        d.Type === "TouchPanel" &&
        (String(d.Name || "").includes("Navigator") || d.Location === "InsideRoom")
    );

    if (navigator?.id != null) {
      TEXTLINE.peripheralId = parseInt(navigator.id, 10);
      console.log("TextLine PeripheralId:", TEXTLINE.peripheralId);
    }
  } catch (e) {
    console.log("PeripheralId non risolto (Display senza PeripheralId):", e);
  }
}

function textLineDisplayParams(text) {
  const params = {
    Duration: TEXTLINE.duration,
    Text: text,
    X: TEXTLINE.x,
    Y: TEXTLINE.y,
  };

  if (TEXTLINE.target) {
    params.Target = TEXTLINE.target;
  }
  if (TEXTLINE.peripheralId != null && !Number.isNaN(TEXTLINE.peripheralId)) {
    params.PeripheralId = TEXTLINE.peripheralId;
  }

  return params;
}

async function showMessage(text) {
  if (!xapi) return;

  try {
    await xapi.Command.Standby.Deactivate();
    await xapi.Command.UserInterface.Message.TextLine.Display(
      textLineDisplayParams(text)
    );
    textLineVisible = true;
  } catch (e) {
    console.error("Errore invio messaggio:", e);
  }
}

async function clearMessage() {
  if (!xapi || !textLineVisible) return;

  try {
    await xapi.Command.UserInterface.Message.TextLine.Clear();
  } catch (e) {
    console.error("Errore clear messaggio:", e);
  } finally {
    textLineVisible = false;
  }
}

function updateUI() {
  const status = document.getElementById("roomStatus");
  const topPanel = document.getElementById("topPanel");
  const bottomPanel = document.getElementById("bottomPanel");
  const btn = document.getElementById("accessButton");
  const btnLabel = document.getElementById("accessButtonLabel");

  if (directorPresent) {
    topPanel.style.backgroundColor = PRESENT_COLOR;
    if (bottomPanel) bottomPanel.style.backgroundColor = PRESENT_COLOR;
    status.textContent = TEXT_PRESENT;
    btnLabel.textContent = accessRequestPending ? "Attendere..." : "Richiedi Accesso";
    btn.style.backgroundColor = accessRequestPending ? "#e53935" : "#9e9e9e";

    if (accessRequestPending) {
      showMessage(TEXTLINE.text);
    } else {
      clearMessage();
    }
    xapi?.Command?.UserInterface?.LedControl?.Color?.Set({ Color: "Green" }).catch(
      () => {}
    );
    return;
  }

  topPanel.style.backgroundColor = ABSENT_COLOR;
  if (bottomPanel) bottomPanel.style.backgroundColor = ABSENT_COLOR;
  status.textContent = TEXT_ABSENT;
  btnLabel.textContent = "Divieto di Accesso";
  btn.style.backgroundColor = "#9e9e9e";
  accessRequestPending = false;
  clearMessage();
  xapi?.Command?.UserInterface?.LedControl?.Color?.Set({ Color: "Yellow" }).catch(
    () => {}
  );
}

boot();
