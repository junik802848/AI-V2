module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const rawUrl = String(process.env.SUPABASE_URL || '').trim().replace(/^['"]|['"]$/g, '');
  let base = rawUrl;
  try { base = new URL(rawUrl).origin; } catch {}
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!base || !key) return res.status(503).json({ error: 'Supabase is not configured' });
  try {
    let page = String((req.query && req.query.page) || 'tbm40').replace(/[^a-z0-9_-]/gi, '') || 'tbm40';
    const storagePage = `ai-v2/${page}`;
    const r = await fetch(`${base}/storage/v1/object/list/tbm-files`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }, body: JSON.stringify({ prefix: `${storagePage}/`, limit: 1000, sortBy: { column: 'created_at', order: 'desc' } }) });
    const rows = await r.json();
    if (!r.ok) return res.status(500).json({ error: 'Latest image lookup failed', detail: Array.isArray(rows) ? 'empty' : (rows.message || rows.hint || rows.code || 'supabase error') });
    const images = Array.isArray(rows) ? rows.filter(function(x){return /\.(png|jpe?g|webp|gif)$/i.test(String(x.name||''))}) : [];
    let item = images.sort(function(a,b){
      const at = Number(String(a.name||'').match(/^\d+/)?.[0]||0);
      const bt = Number(String(b.name||'').match(/^\d+/)?.[0]||0);
      return bt-at || Math.max(new Date(b.created_at||0).getTime(),new Date(b.updated_at||0).getTime())-Math.max(new Date(a.created_at||0).getTime(),new Date(a.updated_at||0).getTime());
    })[0];
    if (!item && page === "tbm75") { page = "tbm40"; const retry = await fetch(`${base}/storage/v1/object/list/tbm-files`, { method: "POST", headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json", "Cache-Control": "no-cache" }, body: JSON.stringify({ prefix: "ai-v2/tbm40/", limit: 1000 }) }); const retryRows = await retry.json(); const retryImages = Array.isArray(retryRows) ? retryRows.filter(x => /\.(png|jpe?g|webp|gif)$/i.test(String(x.name || ""))) : []; item = retryImages.sort((a,b) => Number(String(b.name||"").match(/^\d+/)?.[0]||0) - Number(String(a.name||"").match(/^\d+/)?.[0]||0))[0]; }
    return res.status(200).json({ image: item ? { public_url: `${base}/storage/v1/object/public/tbm-files/ai-v2/${page}/${item.name}`, file_name: item.name } : null });
  } catch (e) { return res.status(500).json({ error: 'Latest image lookup failed', detail: e && e.message ? e.message : 'supabase error' }); }
};
