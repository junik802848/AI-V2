module.exports = async function handler(req, res) {
  const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!base || !key) return res.status(503).json({ error: 'Supabase is not configured' });
  try {
    const r = await fetch(`${base}/rest/v1/tbm_files?select=public_url,file_name,created_at,mime_type&page=eq.tbm40&order=created_at.desc&limit=10`, { headers: { Authorization: `Bearer ${key}`, apikey: key } });
    const rows = await r.json();
    if (!r.ok) return res.status(500).json({ error: 'Latest image lookup failed', detail: Array.isArray(rows) ? 'empty' : (rows.message || rows.hint || rows.code || 'supabase error') });
    return res.status(200).json({ image: rows.find(function(x){return String(x.mime_type||"").indexOf("image/")===0}) || rows[0] || null });
  } catch (e) { return res.status(500).json({ error: 'Latest image lookup failed', detail: Array.isArray(rows) ? 'empty' : (rows.message || rows.hint || rows.code || 'supabase error') }); }
};
