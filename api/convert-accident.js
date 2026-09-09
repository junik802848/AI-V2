const { put } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const tokenKey = Object.keys(process.env).find((key) => key.endsWith('_READ_WRITE_TOKEN'));
  const blobToken = (tokenKey && process.env[tokenKey]) || process.env.BLOB_READ_WRITE_TOKEN;
  const convertKey = process.env.CLOUDCONVERT_API_KEY;
  if (!convertKey) return res.status(500).json({ error: 'CloudConvert API 키가 설정되지 않았습니다.' });
  const type = req.headers['content-type'] || '';
  const inputFormat = type === 'application/vnd.ms-powerpoint' ? 'ppt' : 'pptx';
  if (!['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'].includes(type)) return res.status(415).json({ error: 'PPT 또는 PPTX 파일만 지원합니다.' });
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const source = Buffer.concat(chunks);
  if (!source.length || source.length > 20 * 1024 * 1024) return res.status(413).json({ error: '파일은 20MB 이하만 업로드할 수 있습니다.' });
  try {
    const storedSource = await uploadAndRecord({ body: source, contentType: type, fileName: `accident-source.${inputFormat}`, page: 'tbm50' });
    const original = storedSource || (blobToken ? await put(`tbm50-accident-source/${Date.now()}.${inputFormat}`, source, { access: 'public', token: blobToken, contentType: type }) : null);
    if (!original) throw new Error('업로드 저장소가 설정되지 않았습니다.');
    const jobResponse = await fetch('https://sync.api.cloudconvert.com/v2/jobs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${convertKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: {
        import_file: { operation: 'import/url', url: original.url },
        convert_file: { operation: 'convert', input: 'import_file', input_format: inputFormat, output_format: 'pdf' },
        export_file: { operation: 'export/url', input: 'convert_file' }
      } })
    });
    const job = await jobResponse.json();
    if (!jobResponse.ok || job.data?.status === 'error') throw new Error('CloudConvert 변환에 실패했습니다.');
    const task = job.data.tasks.find((item) => item.name === 'export_file');
    const resultUrl = task?.result?.files?.[0]?.url;
    if (!resultUrl) throw new Error('변환된 PDF를 찾을 수 없습니다.');
    const pdfResponse = await fetch(resultUrl);
    if (!pdfResponse.ok) throw new Error('변환 결과 다운로드에 실패했습니다.');
    const pdf = Buffer.from(await pdfResponse.arrayBuffer());
    const storedPdf = await uploadAndRecord({ body: pdf, contentType: 'application/pdf', fileName: '사고사례.pdf', page: 'tbm50' });
    const output = storedPdf || (blobToken ? await put(`tbm50-accident/${Date.now()}.pdf`, pdf, { access: 'public', token: blobToken, contentType: 'application/pdf' }) : null);
    if (!output) throw new Error('변환 결과 저장소가 설정되지 않았습니다.');
    return res.status(200).json({ url: output.url, type: 'application/pdf', name: '사고사례.pdf' });
  } catch (error) {
    return res.status(502).json({ error: error.message || 'PPTX 변환에 실패했습니다.' });
  }
};
