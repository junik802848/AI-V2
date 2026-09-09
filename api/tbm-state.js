module.exports = async function handler(req,res){
  const base=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
  if(!base||!key)return res.status(503).json({error:'Supabase is not configured'});
  const page=String((req.query&&req.query.page)||'tbm60').replace(/[^a-z0-9_-]/gi,'').slice(0,40);
  const headers={Authorization:`Bearer ${key}`,apikey:key,'Content-Type':'application/json'};
  try{
    if(req.method==='GET'){
      const r=await fetch(`${base}/rest/v1/tbm_page_state?select=state& page=eq.${encodeURIComponent(page)}`.replace('state& page','state&page'),{headers});
      const rows=await r.json(); let state=rows[0]?.state||null;
      if(page==='tbm75'&&state&&Array.isArray(state['tbm75-panels-v1']))state=state['tbm75-panels-v1'];
      return res.status(r.ok?200:500).json({state});
    }
    if(req.method!=='PUT')return res.status(405).json({error:'Method not allowed'});
    let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw||'{}');let state=body.state||{};
    if(page==='tbm75'&&Array.isArray(state['tbm75-panels-v1'])){
      state['tbm75-panels-v1']=state['tbm75-panels-v1'].filter(Boolean).sort((a,b)=>Number(b.uploadedAt||0)-Number(a.uploadedAt||0));
    }
    if(page==='tbm80'&&Array.isArray(state.rows)&&state.rows.length===0){try{const old=await fetch(`${base}/rest/v1/tbm_page_state?select=state&page=eq.tbm80`,{headers});const oldRows=await old.json();const previous=oldRows[0]?.state?.rows;if(Array.isArray(previous)&&previous.length)state={...oldRows[0].state,...state,rows:previous}}catch{}}
    const r=await fetch(`${base}/rest/v1/tbm_page_state?on_conflict=page`,{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({page,state,updated_at:new Date().toISOString()})});
    return res.status(r.ok?200:500).json({ok:r.ok});
  }catch(e){return res.status(500).json({error:e.message||'Supabase state error'});}
};
