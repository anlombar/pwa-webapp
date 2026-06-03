/**
 * Test messaggi xAPI da PWA Navigator.
 * TextLine.Display spesso NON esiste (errore "Method not found") — si prova anche Alert.
 */

const MESSAGE = {
  duration: 60,
  text: "TEST messaggio da PWA",
};

const SKIP_STANDBY = true;

const logEl = document.getElementById("log");

function log(line) {
  const msg = String(line);
  console.log(msg);
  if (logEl) {
    logEl.textContent += (logEl.textContent ? "\n" : "") + msg;
  }
}

function formatError(e) {
  if (e == null) return "unknown";
  if (typeof e === "string") return e;
  if (e.error) {
    const err = e.error;
    const code = err.code != null ? " code=" + err.code : "";
    const msg = err.message || err.Message || JSON.stringify(err);
    return msg + code;
  }
  if (e.message) return e.message;
  try {
    return JSON.stringify(e, null, 2);
  } catch {
    return String(e);
  }
}

async function tryCommand(xapi, label, fn) {
  log("");
  log("--- " + label + " ---");
  try {
    await fn();
    log("OK: " + label);
    return true;
  } catch (e) {
    log("FAIL: " + label);
    log(formatError(e));
    return false;
  }
}

async function logDeviceInfo(xapi) {
  const paths = [
    ["Status", "SystemUnit", "SoftwareVersion"],
    ["Status", "SystemUnit", "ProductId"],
    ["Status", "SystemUnit", "TouchPanel", "Mode"],
  ];
  for (const parts of paths) {
    try {
      let node = xapi;
      for (const p of parts) node = node[p];
      const val = await node.get();
      log(parts.join(".") + ": " + val);
    } catch (e) {
      log(parts.join(".") + ": (n/d) " + formatError(e));
    }
  }

  try {
    const devices = await xapi.Status.Peripherals.ConnectedDevice.get();
    const list = Array.isArray(devices) ? devices : [devices];
    log("ConnectedDevice count: " + list.length);
    list.slice(0, 5).forEach((d, i) => {
      log("  [" + i + "] id=" + d.id + " " + d.Type + " " + (d.Name || ""));
    });
  } catch (e) {
    log("ConnectedDevice: " + formatError(e));
  }
}

async function runTests(xapi) {
  if (!SKIP_STANDBY) {
    await tryCommand(xapi, "Standby.Deactivate", () =>
      xapi.Command.Standby.Deactivate()
    );
  } else {
    log("Standby.Deactivate saltato");
  }

  const textLineOk = await tryCommand(
    xapi,
    "TextLine.Display (minimo)",
    () =>
      xapi.Command.UserInterface.Message.TextLine.Display({
        Duration: MESSAGE.duration,
        Text: MESSAGE.text,
        X: 0,
        Y: 0,
      })
  );

  if (!textLineOk) {
    log("");
    log("DIAGNOSI: Method not found su TextLine = comando NON esposto");
    log("all'xAPI della PWA Navigator (API ridotta, non il codec completo).");
  }

  const alertOk = await tryCommand(xapi, "Alert.Display", () =>
    xapi.Command.UserInterface.Message.Alert.Display({
      Text: MESSAGE.text,
      Duration: MESSAGE.duration,
    })
  );

  if (alertOk) {
    log("");
    log("Alert accettato — messaggio su display collegato al device xAPI.");
    log("Dopo 60s sparisce, oppure Alert.Clear.");
    try {
      await xapi.Command.UserInterface.Message.Alert.Clear();
      log("Alert.Clear OK");
    } catch (e) {
      log("Alert.Clear: " + formatError(e));
    }
    return;
  }

  log("");
  log("Nessun comando messaggio disponibile su questa connessione xAPI.");
  log("Mostra il testo solo nella PWA (HTML) o usa WebView/HttpClient verso il codec.");
}

document.addEventListener("DOMContentLoaded", () => {
  logEl.textContent = "";

  window.addEventListener("unhandledrejection", (ev) => {
    log("UNHANDLED: " + formatError(ev.reason));
    ev.preventDefault();
  });

  void (async () => {
    if (typeof window.getXAPI !== "function") {
      log("getXAPI assente — solo Persistent Web App su Navigator.");
      return;
    }

    let xapi;
    try {
      log("getXAPI()…");
      xapi = await window.getXAPI();
      log("OK: WebSocket xAPI pronto.");
    } catch (e) {
      log("getXAPI fallito: " + formatError(e));
      return;
    }

    await logDeviceInfo(xapi);
    await runTests(xapi);
  })();
});
