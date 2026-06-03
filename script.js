/**
 * Test minimo Room Navigator / RoomOS — solo TextLine.Display + log errori xAPI.
 */

const TEXTLINE = {
  duration: 60,
  x: 0,
  y: 0,
  target: null,
  text: "TEST TextLine da PWA",
  peripheralId: null,
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

function buildParams(options) {
  const params = {
    Duration: TEXTLINE.duration,
    Text: TEXTLINE.text,
    X: options.x,
    Y: options.y,
  };
  if (options.target) params.Target = options.target;
  if (options.peripheralId != null && !Number.isNaN(options.peripheralId)) {
    params.PeripheralId = options.peripheralId;
  }
  return params;
}

async function resolvePeripheralId(xapi) {
  try {
    const devices = await xapi.Status.Peripherals.ConnectedDevice.get();
    const list = Array.isArray(devices) ? devices : [devices];
    const nav = list.find(
      (d) =>
        d.Type === "TouchPanel" &&
        (String(d.Name || "").includes("Navigator") || d.Location === "InsideRoom")
    );
    if (nav?.id != null) {
      TEXTLINE.peripheralId = parseInt(nav.id, 10);
      log("PeripheralId Navigator: " + TEXTLINE.peripheralId);
    } else {
      log("Nessun Navigator in ConnectedDevice");
    }
  } catch (e) {
    log("ConnectedDevice: " + formatError(e));
  }
}

async function tryDisplay(xapi, label, params) {
  log("");
  log("--- " + label + " ---");
  log(JSON.stringify(params));
  try {
    await xapi.Command.UserInterface.Message.TextLine.Display(params);
    log("OK: " + label);
    return true;
  } catch (e) {
    log("FAIL: " + label);
    log(formatError(e));
    return false;
  }
}

async function runTest(xapi) {
  if (!SKIP_STANDBY) {
    try {
      await xapi.Command.Standby.Deactivate();
      log("Standby.Deactivate OK");
    } catch (e) {
      log("Standby.Deactivate (spesso fallisce se non in standby):");
      log(formatError(e));
    }
  } else {
    log("Standby.Deactivate saltato (SKIP_STANDBY=true)");
  }

  const attempts = [
    ["minimo (Text,X,Y,Duration)", buildParams({ x: 0, y: 0 })],
    [
      "con coordinate 500,500",
      buildParams({ x: TEXTLINE.x || 500, y: TEXTLINE.y || 500 }),
    ],
    ["con Target OSD", buildParams({ x: 0, y: 0, target: "OSD" })],
    [
      "con PeripheralId",
      buildParams({ x: 0, y: 0, peripheralId: TEXTLINE.peripheralId }),
    ],
    [
      "tutto",
      buildParams({
        x: 500,
        y: 500,
        target: "OSD",
        peripheralId: TEXTLINE.peripheralId,
      }),
    ],
  ];

  for (const [label, params] of attempts) {
    if (params.PeripheralId == null && label.includes("PeripheralId")) {
      log("Skip " + label + " (nessun PeripheralId)");
      continue;
    }
    if (await tryDisplay(xapi, label, params)) {
      log("Usa sul monitor la variante che ha funzionato.");
      return;
    }
  }

  log("");
  log("Nessun Display riuscito. Controlla firmware / permessi PWA.");
}

document.addEventListener("DOMContentLoaded", () => {
  logEl.textContent = "";

  window.addEventListener("unhandledrejection", (ev) => {
    log("UNHANDLED REJECTION:");
    log(formatError(ev.reason));
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
      log("getXAPI fallito:");
      log(formatError(e));
      return;
    }

    await resolvePeripheralId(xapi);
    await runTest(xapi);
  })();
});
