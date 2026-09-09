module.exports = async function handler(req, res) {
  const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!base || !key) return res.status(503).json({ error: 'Supabase is not configured' });
  try {
    const r = await fetch(`${base}/rest/v1/tbm_files?select=public_url,file_name,created_at&and=(page.eq.tbm40,mime_type.like.image/*)&order=created_at.desc&limit=1`, { headers: { Authorization: `Bearer ${key}`, apikey: key } });
    const rows = await r.json();
    if (!r.ok) return res.status(500).json({ error: 'Latest image lookup failed' });
    return res.status(200).json({ image: rows[0] || null });
  } catch (e) { return res.status(500).json({ error: 'Latest image lookup failed' }); }
};
