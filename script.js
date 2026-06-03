document.addEventListener("DOMContentLoaded", async () => {
  const xapi = await window.getXAPI();

  await xapi.Command.Standby.Deactivate();

  await xapi.Command.UserInterface.Message.TextLine.Display({
    Duration: 60,
    Text: "TEST TextLine da PWA",
    X: 500,
    Y: 500,
    Target: "OSD",        // opzionale: rimuovi se errore
    PeripheralId: 2,      // opzionale: id touch, altrimenti ometti
  });
});
