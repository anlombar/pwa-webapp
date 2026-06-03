const PRESENT_COLOR = "#43a047";
const ABSENT_COLOR = "#ff9800";
const TEXT_PRESENT = "Direttore Presente";
const TEXT_ABSENT = "Direttore Assente";

let xapi;
let directorPresent = false;
let accessRequestPending = false;

function boot() {
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      xapi = await window.getXAPI();
      // Setup iniziale
      await xapi.Config.UserInterface.LedControl.Mode.set("Manual");
      
      // Monitoraggio presenza
      xapi.Status.RoomAnalytics.PeopleCount.Current.on((count) => {
        let c = parseInt(count == "-1" ? 0 : count, 10) || 0;
        directorPresent = (c >= 1);
        updateUI();
      });

      // Lettura iniziale
      let initialCount = await xapi.Status.RoomAnalytics.PeopleCount.Current.get();
      directorPresent = (parseInt(initialCount == "-1" ? 0 : initialCount, 10) >= 1);
      updateUI();

      // Eventi pulsante
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

async function showMessage(text) {
  try {
    // Risveglia lo schermo
    await xapi.Command.Standby.Deactivate();
    
    // Comando TextLine: il più compatibile in assoluto
    await xapi.Command.UserInterface.Message.TextLine.Display({
      Duration: 120,
      Text: text,
      X: 500,
      Y: 500
    });
  } catch (e) {
    console.error("Errore invio messaggio:", e);
  }
}

async function clearMessage() {
  // TextLine non ha un Clear, inviamo un testo vuoto o ignoriamo
  // In alternativa puoi provare a inviare un Alert.Clear se il sistema lo accetta
  try {
    await xapi.Command.UserInterface.Message.Alert.Clear();
  } catch (e) {}
}

function updateUI() {
  const status = document.getElementById("roomStatus");
  const panel = document.getElementById("topPanel");
  const btn = document.getElementById("accessButton");
  const btnLabel = document.getElementById("accessButtonLabel");

  if (directorPresent) {
    panel.style.backgroundColor = PRESENT_COLOR;
    status.textContent = TEXT_PRESENT;
    btnLabel.textContent = accessRequestPending ? "Attendere..." : "Richiedi Accesso";
    btn.style.backgroundColor = accessRequestPending ? "#e53935" : "#9e9e9e";
    
    if (accessRequestPending) {
      showMessage("RICHIESTA DI ACCESSO");
      xapi?.Command?.UserInterface?.LedControl?.Color?.Set({ Color: "Green" });
    } else {
      clearMessage();
      xapi?.Command?.UserInterface?.LedControl?.Color?.Set({ Color: "Green" });
    }
  } else {
    panel.style.backgroundColor = ABSENT_COLOR;
    status.textContent = TEXT_ABSENT;
    btnLabel.textContent = "Divieto di Accesso";
    btn.style.backgroundColor = "#9e9e9e";
    accessRequestPending = false;
    clearMessage();
    xapi?.Command?.UserInterface?.LedControl?.Color?.Set({ Color: "Yellow" });
  }
}

boot();
