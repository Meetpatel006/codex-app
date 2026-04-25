// FILE: qr.js
// Purpose: Prints the bridge QR payload for explicit iPhone pairing.
// Layer: CLI helper
// Exports: printQR
// Depends on: qrcode-terminal

const qrcode = require("qrcode-terminal");

function buildQrImageUrl(pairingPayload) {
  const payload = JSON.stringify(pairingPayload);
  return `https://quickchart.io/qr?size=360&text=${encodeURIComponent(payload)}`;
}

function printQR(pairingPayload) {
  const payload = JSON.stringify(pairingPayload);

  console.log("\nScan this QR with the iPhone:\n");
  qrcode.generate(payload, { small: true });
  console.log("\nPairing payload JSON (paste into Pair screen):");
  console.log(payload);
  console.log("\nQR image link (open in browser):");
  console.log(buildQrImageUrl(pairingPayload));
  console.log(`\nSession ID: ${pairingPayload.sessionId}`);
  console.log(`Device ID: ${pairingPayload.macDeviceId}`);
  if (pairingPayload.shortCode) {
    console.log(
      `Short Code: ${pairingPayload.shortCodeFormatted || pairingPayload.shortCode}`,
    );
  }
  console.log(`Expires: ${new Date(pairingPayload.expiresAt).toLocaleString()}\n`);
}

module.exports = { printQR };
