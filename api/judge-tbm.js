module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { imageUrl, imageData, workerCount: selectedWorkerCount } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;
    if (!imageUrl) return res.status(400).json({ error: 'Image URL is required' });
    if (!apiKey) return res.status(500).json({ error: 'Gemini API key is not configured' });
    let mimeType = 'image/jpeg';
    let imageBase64;
    if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
      const match = imageData.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (!match) throw new Error('Invalid compressed image');
      mimeType = match[1];
      imageBase64 = match[2];
    } else {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) throw new Error('Unable to read image');
      mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
      imageBase64 = Buffer.from(await imageResponse.arrayBuffer()).toString('base64');
    }
    const prompt = `TBM 문서 이미지를 엄격하게 판정하세요. 이미지 상단의 작업인원 숫자를 읽어 workerCount로 반환하세요. 하단의 'TBM 참석자 서명' 영역만 검사하고 '재TBM 참석자 서명' 영역은 제외하세요. 표 선, 글자, 점, 체크박스, 도장은 서명으로 세지 말고 실제 손글씨 서명 흔적만 세세요. 작업인원 숫자나 서명 개수가 불확실하면 null을 반환하세요. 반드시 JSON 객체만 반환하세요. 형식: {"workerCount":number|null,"signatureCount":number|null,"names":[],"reason":""}`;
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent', { method: 'POST', headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Gemini request failed');
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned no result');
    const result = JSON.parse(text);
    const detectedWorkerCount = Number.isInteger(result.workerCount) ? result.workerCount : null;
    const workerCount = detectedWorkerCount !== null ? detectedWorkerCount : (Number.isInteger(selectedWorkerCount) ? selectedWorkerCount : null);
    const signatureCount = Number.isInteger(result.signatureCount) ? result.signatureCount : null;
    result.workerCount = workerCount;
    result.signatureCount = signatureCount;
    result.pass = workerCount !== null && signatureCount !== null && workerCount > 0 && signatureCount === workerCount;
    if (!result.pass && workerCount !== null && signatureCount !== null && signatureCount < workerCount) result.reason = `작업인원 ${workerCount}명보다 서명 ${signatureCount}개가 부족합니다.`;
    return res.status(200).json(result);
  } catch (error) { return res.status(500).json({ error: error.message || 'TBM image analysis failed' }); }
};
