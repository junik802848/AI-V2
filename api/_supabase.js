const crypto = require('crypto');

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}

async function uploadAndRecord({ body, contentType, fileName, page, slot, expiresAt, protectedFlag }) {
  const cfg = config();
  if (!cfg) return null;
  const safe = String(fileName || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${page}/${Date.now()}-${crypto.randomBytes(5).toString('hex')}-${safe}`;
  const upload = await fetch(`${cfg.url}/storage/v1/object/tbm-files/${path}`, {
    method: 'POST', headers: { Authorization: `Bearer ${cfg.key}`, apikey: cfg.key, 'Content-Type': contentType, 'Content-Length': String(body.length), 'x-upsert': 'false' }, body: new Uint8Array(body)
  });
  if (!upload.ok) throw new Error(`Supabase Storage upload failed (${upload.status})`);
  const publicUrl = `${cfg.url}/storage/v1/object/public/tbm-files/${path}`;
  const record = await fetch(`${cfg.url}/rest/v1/tbm_files`, {
    method: 'POST', headers: { Authorization: `Bearer ${cfg.key}`, apikey: cfg.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ page, slot: slot == null ? null : Number(slot), file_name: fileName || safe, mime_type: contentType, storage_path: path, public_url: publicUrl, expires_at: expiresAt || null, delete_protected: !!protectedFlag })
  });
  // Storage is the source used by QR lookup. Metadata is helpful but must not
  // turn a successfully uploaded image into a fallback/non-Supabase response.
  if (!record.ok) console.error(`Supabase metadata save failed (${record.status})`);
  return { url: publicUrl, path };
}

module.exports = { uploadAndRecord };
