const QRCode = require('qrcode');
module.exports = async function handler(req, res) {
  try {
    const text = String((req.query && req.query.text) || '');
    if (!text) return res.status(400).json({ error: 'text is required' });
    const png = await QRCode.toBuffer(text, { type: 'png', width: 280, margin: 2, errorCorrectionLevel: 'M' });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(png);
  } catch (e) { return res.status(500).json({ error: 'QR generation failed' }); }
};
