const QRCode = require('qrcode');

/**
 * Generates a QR code as a base64 PNG data URL.
 * The QR encodes the scan URL that a student's phone camera will open.
 * Always use high contrast black/white — works on all phone cameras including dark mode.
 *
 * @param {string} token - UUID token for the session
 * @param {string} frontendUrl - Base URL of the Next.js frontend
 * @returns {Promise<string>} Base64 PNG data URL (ready for <img src={...} />)
 */
const generateQR = async (token, frontendUrl) => {
  const scanUrl = `${frontendUrl}/scan?token=${token}`;

  const dataUrl = await QRCode.toDataURL(scanUrl, {
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'H', // High error correction — still scans if partly obscured
    color: {
      dark: '#000000',  // Force black — never transparent
      light: '#FFFFFF', // Force white — works on dark mode phones
    },
  });

  return { dataUrl, scanUrl };
};

module.exports = { generateQR };
