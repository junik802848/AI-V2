const { put } = require('@vercel/blob');
const { uploadAndRecord } = require('./_supabase');

async function readBinaryBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (req.body instanceof Uint8Array) return Buffer.from(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

module.exports = async function handler(req, res) {
    const tokenKey = Object.keys(process.env).find((key) => key.endsWith('_READ_WRITE_TOKEN'));
    const token = (tokenKey && process.env[tokenKey]) || process.env.BLOB_READ_WRITE_TOKEN;
    if (req.method === 'GET') {
      if (!token) return res.status(500).json({ error: 'Blob token is not configured' });
      const { list } = require('@vercel/blob');
      const prefix = String((req.query && req.query.prefix) || 'tbm73/').toLowerCase().replace(/[^a-z0-9_\/-]/g, '').slice(0, 40) || 'tbm73/';
      const result = await list({ prefix, token, limit: 1000 });
      return res.status(200).json({ blobs: result.blobs });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = await readBinaryBody(req);
      const type = req.headers['content-type'] || 'image/jpeg';
      if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) {
        return res.status(415).json({ error: '지원하지 않는 이미지 형식입니다.' });
      }
      if (!body.length) return res.status(400).json({ error: '빈 파일입니다.' });
      if (body.length > 10 * 1024 * 1024) return res.status(413).json({ error: '파일은 10MB 이하만 업로드할 수 있습니다.' });
      const folder = String(req.headers['x-upload-folder'] || 'uploads')
        .toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30) || 'uploads';
      const ext = type === 'image/png' ? '.png' : type === 'image/webp' ? '.webp' : type === 'image/gif' ? '.gif' : '.jpg';
      const name = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    let supabaseFailure = null;
    try {
      const supabase = await uploadAndRecord({ body, contentType: type, fileName: req.headers['x-file-name'] || name, page: req.headers['x-upload-page'] || folder, slot: req.headers['x-upload-slot'], expiresAt: req.headers['x-expires-at'], protectedFlag: req.headers['x-delete-protected'] === 'true' });
      if (supabase) return res.status(200).json({ url: supabase.url, storage: 'supabase', provider: 'supabase' });
    } catch (supabaseError) {
      supabaseFailure = supabaseError;
      console.error('Supabase image upload failed; using Blob fallback:', supabaseError && supabaseError.message);
    }
    if (folder.startsWith('ai-v2-')) return res.status(502).json({ error: 'Supabase 저장 실패', detail: supabaseFailure && supabaseFailure.message ? supabaseFailure.message : 'Supabase 저장 응답 없음' });
    // Keep the feature usable when this project has no storage credentials yet.
    // The client can still preview the selected image; cloud persistence becomes
    // available automatically once Supabase or Blob environment variables exist.
    if (!token) {
      const encoded = body.toString('base64');
      return res.status(200).json({ url: `data:${type};base64,${encoded}`, storage: 'browser-fallback', provider: 'supabase' });
    }
    const blob = await put(name, body, { access: 'public', token, contentType: type, addRandomSuffix: false });
    return res.status(200).json({ url: blob.url, storage: 'blob-fallback', provider: 'supabase' });
  } catch (error) {
      return res.status(500).json({ error: 'Image upload failed', detail: error && error.message ? error.message : 'unknown error' });
  }
};

// Vercel must leave the binary request body untouched.
module.exports.config = { api: { bodyParser: false } };
