module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!base || !key) return res.status(503).json({ error: 'Supabase is not configured' });
  try {
    let raw = ''; for await (const c of req) raw += c;
    const body = JSON.parse(raw || '{}');
    const url = new URL(String(body.url || ''));
    const prefix = '/storage/v1/object/public/tbm-files/';
    if (url.origin !== new URL(base).origin || !url.pathname.startsWith(prefix)) return res.status(400).json({ error: 'Invalid image URL' });
    const path = decodeURIComponent(url.pathname.slice(prefix.length));
    if (!path.startsWith('ai-v2/tbm75/')) return res.status(400).json({ error: 'Only AI V2 TBM75 images can be deleted' });
    const r = await fetch(`${base}/storage/v1/object/tbm-files/${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${key}`, apikey: key } });
    if (!r.ok) return res.status(500).json({ error: 'Supabase image delete failed' });
    return res.status(200).json({ ok: true });
  } catch (e) { return res.status(400).json({ error: e.message || 'Invalid request' }); }
};
