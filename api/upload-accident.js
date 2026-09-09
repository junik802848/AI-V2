const { put } = require('@vercel/blob');
const { uploadAndRecord } = require('./_supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const tokenKey = Object.keys(process.env).find((key) => key.endsWith('_READ_WRITE_TOKEN'));
  const token = (tokenKey && process.env[tokenKey]) || process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return res.status(500).json({ error: 'Blob token is not configured' });
  const type = req.headers['content-type'] || 'application/octet-stream';
  const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(type)) return res.status(415).json({ error: 'PPTX, PDF, JPG, PNG, WEBP 파일만 지원합니다.' });
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  if (!body.length || body.length > 20 * 1024 * 1024) return res.status(413).json({ error: '파일은 20MB 이하만 업로드할 수 있습니다.' });
  const ext = type === 'application/pdf' ? '.pdf' : type.includes('presentation') ? '.pptx' : type === 'image/png' ? '.png' : type === 'image/webp' ? '.webp' : '.jpg';
  const fileName = req.headers['x-file-name'] || `사고사례${ext}`;
  const supabase = await uploadAndRecord({ body, contentType: type, fileName, page: 'tbm50' });
  if (supabase) return res.status(200).json({ url: supabase.url, type, name: fileName, storage: 'supabase' });
  const blob = await put(`tbm50-accident/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`, body, { access: 'public', token, contentType: type, addRandomSuffix: false });
  return res.status(200).json({ url: blob.url, type, name: fileName });
};
