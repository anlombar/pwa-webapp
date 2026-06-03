// --- Funzioni per il controllo dell'Alert (Sostituiscono WebView) ---

function alertDisplayXml(text, duration) {
  return (
    "<Command><UserInterface><Message><Alert><Display>" +
    "<Duration>" + duration + "</Duration>" +
    "<Target>" + OSD_TARGET + "</Target>" +
    "<Text>" + escapeXml(text) + "</Text>" +
    "</Display></Alert></Message></UserInterface></Command>"
  );
}

function alertClearXml() {
  return (
    "<Command><UserInterface><Message><Alert><Clear/></Alert></Message></UserInterface></Command>"
  );
}

// --- Funzioni aggiornate per gestire l'OSD ---

async function showOsdRichiestaAccesso() {
  if (osdRichiestaVisible) return;
  
  // Invio dell'Alert con durata 120 secondi
  const xmlCommand = alertDisplayXml("RICHIESTA DI ACCESSO", 120);
  const ok = await sendDeskCommand(xmlCommand);
  
  if (ok) {
    osdRichiestaVisible = true;
    console.log("OSD Desk: Alert 'RICHIESTA DI ACCESSO' mostrato");
  }
}

async function clearOsdRichiestaAccesso() {
  // Invio del comando per pulire l'Alert
  await sendDeskCommand(alertClearXml());
  osdRichiestaVisible = false;
  console.log("OSD Desk: Alert rimosso");
}

// --- Il resto del codice rimane invariato ---
// Nota: ho rimosso la funzione 'createRichiestaAccessoDataUri' perché non più necessaria.
