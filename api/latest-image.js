module.exports = async function handler(req, res) {
  const rawUrl = String(process.env.SUPABASE_URL || '').trim().replace(/^['"]|['"]$/g, '');
  let base = rawUrl;
  try { base = new URL(rawUrl).origin; } catch {}
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!base || !key) return res.status(503).json({ error: 'Supabase is not configured' });
  try {
    const r = await fetch(`${base}/storage/v1/object/list/tbm-files`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: 'tbm40', limit: 100, sortBy: { column: 'created_at', order: 'desc' } }) });
    const rows = await r.json();
    if (!r.ok) return res.status(500).json({ error: 'Latest image lookup failed', detail: Array.isArray(rows) ? 'empty' : (rows.message || rows.hint || rows.code || 'supabase error') });
    const item = Array.isArray(rows) && rows.find(function(x){return /\.(png|jpe?g|webp|gif)$/i.test(String(x.name||''))});
    return res.status(200).json({ image: item ? { public_url: `${base}/storage/v1/object/public/tbm-files/${item.name}`, file_name: item.name } : null });
  } catch (e) { return res.status(500).json({ error: 'Latest image lookup failed', detail: Array.isArray(rows) ? 'empty' : (rows.message || rows.hint || rows.code || 'supabase error') }); }
};
