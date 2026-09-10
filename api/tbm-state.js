module.exports = async function handler(req, res) {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return res.status(503).json({ error: 'Supabase is not configured' });
  const page = String((req.query && req.query.page) || 'tbm60').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
  const path = `ai-v2/state/${page}.json`;
  const headers = { Authorization: `Bearer ${key}`, apikey: key };
  const emptyState = (v) => {
    if (v == null || v === '' || v === false || v === 0) return true;
    if (Array.isArray(v)) return v.length === 0 || v.every(emptyState);
    if (typeof v === 'object') return Object.values(v).every(emptyState);
    return false;
  };
  try {
    if (req.method === 'GET') {
      const r = await fetch(`${base}/storage/v1/object/tbm-files/${path}?v=${Date.now()}`, { headers, cache: 'no-store' });
      if (r.status === 404 || r.status === 400) return res.status(200).json({ state: null });
      if (!r.ok) throw Error(`상태 조회 실패 (${r.status})`);
      const state = await r.json();
      if (page === 'tbm50' && state && Array.isArray(state['tbm50-extracted-checklists']) && emptyState(state['tbm50-extracted-checklists']) && Array.isArray(state['tbm72-grouped-final'])) state['tbm50-extracted-checklists'] = state['tbm72-grouped-final'];
      return res.status(200).json({ state });
    }
    if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
    let raw = ''; for await (const c of req) raw += c;
    const body = JSON.parse(raw || '{}');
    if (emptyState(body.state)) return res.status(200).json({ ok: true, preserved: true });
    const r = await fetch(`${base}/storage/v1/object/tbm-files/${path}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'x-upsert': 'true', 'Cache-Control': 'no-cache' }, body: JSON.stringify(body.state === undefined ? {} : body.state) });
    if (!r.ok) throw Error(`상태 저장 실패 (${r.status})`);
    return res.status(200).json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e.message || 'Supabase state error' }); }
};
