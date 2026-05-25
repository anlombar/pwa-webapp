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
const DESK_HOST = "CHANGE_ME";
const DESK_API_USER = "admin";
const DESK_API_PASS = "CHANGE_ME";

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
let osdRichiestaVisible = false;
let deskHost = "";
let deskHttpReady = false;

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
    deskHost = resolveDeskHost();
    await initDeskHttpClient();
    await readPeopleCount();
    subscribePeopleCount();
  } catch (e) {
    console.log("Impossibile connettersi al device:", e);
    applyUiState(false, false);
  }
}

function resolveDeskHost() {
  const fromUrl = new URLSearchParams(window.location.search).get("desk");
  if (fromUrl) return peerBaseUrl(fromUrl);
  if (DESK_HOST && DESK_HOST !== "CHANGE_ME") return peerBaseUrl(DESK_HOST);
  return "";
}

function peerBaseUrl(hostSetting) {
  let base = String(hostSetting).trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) {
    base = "https://" + base;
  }
  return base;
}

function peerUrl(path) {
  const p = path.startsWith("/") ? path : "/" + path;
  return deskHost + p;
}

function peerHostName() {
  try {
    return new URL(deskHost).hostname;
  } catch {
    return "";
  }
}

function authHeader() {
  if (!DESK_API_USER || !DESK_API_PASS || DESK_API_PASS === "CHANGE_ME") {
    return "";
  }
  return "Authorization: Basic " + base64Encode(DESK_API_USER + ":" + DESK_API_PASS);
}

function base64Encode(text) {
  if (typeof btoa === "function") {
    return btoa(text);
  }
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let out = "";
  let i = 0;
  while (i < text.length) {
    const a = text.charCodeAt(i++);
    const b = i < text.length ? text.charCodeAt(i++) : 0;
    const c = i < text.length ? text.charCodeAt(i++) : 0;
    const n = (a << 16) | (b << 8) | c;
    out +=
      chars[(n >> 18) & 63] +
      chars[(n >> 12) & 63] +
      chars[(n >> 6) & 63] +
      chars[n & 63];
  }
  const pad = text.length % 3;
  if (pad === 1) out = out.slice(0, -2) + "==";
  if (pad === 2) out = out.slice(0, -1) + "=";
  return out;
}

function httpClientParams(url, headers) {
  return {
    Url: url,
    Header: headers,
    Timeout: 8,
    AllowInsecureHTTPS: "True",
    ResultBody: "PlainText",
  };
}

async function httpPostXml(url, xmlBody) {
  const headers = ["Content-Type: application/xml"];
  const auth = authHeader();
  if (auth) headers.push(auth);
  return xapi.Command.HttpClient.Post(httpClientParams(url, headers), xmlBody);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function webViewDisplayXml(title, url) {
  return (
    "<Command><UserInterface><WebView><Display>" +
    "<Mode>Modal</Mode>" +
    "<Target>" +
    escapeXml(OSD_TARGET) +
    "</Target>" +
    "<Title>" +
    escapeXml(title) +
    "</Title>" +
    "<Url>" +
    escapeXml(url) +
    "</Url>" +
    "</Display></WebView></UserInterface></Command>"
  );
}

function webViewClearXml() {
  return (
    "<Command><UserInterface><WebView><Clear>" +
    "<Target>" +
    escapeXml(OSD_TARGET) +
    "</Target>" +
    "</Clear></WebView></UserInterface></Command>"
  );
}

async function initDeskHttpClient() {
  deskHttpReady = false;
  if (!deskHost) {
    console.log(
      "OSD Desk: aggiungi ?desk=https://IP_DESK all'URL PWA oppure imposta DESK_HOST in script.js"
    );
    return;
  }

  const host = peerHostName();
  if (host) {
    await xapi.Command.HttpClient.Allow.Hostname.Add({ Hostname: host }).catch((e) => {
      console.log("HttpClient Allow Hostname (admin sul Navigator se fallisce):", e);
    });
  }

  // La PWA non può fare xSet Config (Not authorized): HttpClient va abilitato da admin sul Navigator.
  deskHttpReady = true;
  console.log("OSD Desk target:", peerUrl("/putxml"));
  console.log(
    "OSD Desk: se putxml fallisce, in admin Navigator abilitare HttpClient Mode On, AllowInsecureHTTPS On, Allow Hostname per il Desk"
  );
}

async function sendDeskCommand(xmlBody) {
  if (!xapi || !deskHost) {
    console.log("OSD Desk: IP Desk mancante (?desk= nell'URL PWA)");
    return false;
  }
  if (!deskHttpReady) {
    await initDeskHttpClient();
  }
  try {
    const res = await httpPostXml(peerUrl("/putxml"), xmlBody);
    console.log("OSD Desk risposta:", res);
    return true;
  } catch (e) {
    const msg = JSON.stringify(e);
    console.log("OSD Desk putxml fallito:", e);
    if (msg.includes("Insecure HTTPS") || msg.includes("hostlist")) {
      console.log(
        "OSD Desk: sul Navigator (admin) → HttpClient AllowInsecureHTTPS On + Allow Hostname Add per " +
          peerHostName()
      );
    }
    if (msg.includes("Not authorized") || msg.includes("Forbidden")) {
      console.log("OSD Desk: verifica user/password API del Desk in script.js");
    }
    return false;
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

function createRichiestaAccessoDataUri() {
  const html = `<!DOCTYPE html>
  <html lang="it">
    <head>
      <meta charset="UTF-8" />
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
      />
      <style>
        html,
        body {
          overflow: hidden;
          margin: 0;
          padding: 0;
          height: 100vh;
          width: 100vw;
        }

        body {
          background-color: red;
          display: flex;
          justify-content: center;
          align-items: center;
          font-family: Arial, sans-serif;
        }

        .content {
          color: red;
          background-color: white;
          border: 50px solid red;
          border-radius: 80px;
          width: 100vw;
          height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 20vw;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5vw;
          box-sizing: border-box;
        }
      </style>
    </head>
    <body>
      <div class="content">Richiesta Accesso</div>
    </body>
  </html>`;

  return "data:text/html, " + html.split("\n").map((line) => line.trim()).join("");
}

async function showOsdRichiestaAccesso() {
  if (osdRichiestaVisible) return;
  const url = createRichiestaAccessoDataUri();
  const ok = await sendDeskCommand(webViewDisplayXml("Richiesta Accesso", url));
  if (ok) {
    osdRichiestaVisible = true;
    console.log("OSD Desk: Richiesta Accesso mostrata");
  }
}

async function clearOsdRichiestaAccesso() {
  await sendDeskCommand(webViewClearXml());
  osdRichiestaVisible = false;
  console.log("OSD Desk: Richiesta Accesso chiusa");
}

async function syncOsdWithPending(isPending) {
  if (isPending) {
    await showOsdRichiestaAccesso();
  } else {
    await clearOsdRichiestaAccesso();
  }
}

function applyUiState(isPresent, isPending) {
  directorPresent = isPresent;
  accessRequestPending = isPending && isPresent;

  if (isPresent) {
    topPanel.style.backgroundColor = PRESENT_COLOR;
    bottomPanel.style.backgroundColor = PRESENT_COLOR;
    roomStatus.textContent = TEXT_PRESENT;
    setAccessButton(isPending ? "pending" : "present");
    syncOsdWithPending(isPending);
    xapi?.Command?.UserInterface?.LedControl?.Color?.Set({ Color: "Green" }).catch(
      () => {}
    );
    return;
  }

  topPanel.style.backgroundColor = ABSENT_COLOR;
  bottomPanel.style.backgroundColor = ABSENT_COLOR;
  roomStatus.textContent = TEXT_ABSENT;
  setAccessButton("absent");
  syncOsdWithPending(false);
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
