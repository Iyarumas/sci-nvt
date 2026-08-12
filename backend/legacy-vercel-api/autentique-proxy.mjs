const PROD_API = 'https://api.autentique.com.br/v2/graphql';
const SANDBOX_API = 'https://api.sandbox.autentique.com.br/v2/graphql';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const contentType = req.headers['content-type'] || '';
  const token = process.env.AUTENTIQUE_TOKEN || process.env.VITE_AUTENTIQUE_TOKEN;
  const isSandbox = req.headers['x-autentique-sandbox'] === 'true';

  if (!token) {
    return res.status(500).json({ error: 'Autentique token not configured on server' });
  }

  try {
    if (contentType.includes('multipart/form-data')) {
      const buffer = await new Promise((resolve) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
      });

      const formData = new FormData();
      const boundary = contentType.split('boundary=')[1];
      if (!boundary) return res.status(400).json({ error: 'No boundary in multipart' });

      const parts = buffer.toString('latin1').split(`--${boundary}`);
      for (const part of parts) {
        if (part.includes('Content-Disposition: form-data; name="operations"')) {
          const m = part.match(/\r\n\r\n([\s\S]*?)\r\n--/);
          if (m) formData.append('operations', m[1].trim());
        } else if (part.includes('Content-Disposition: form-data; name="map"')) {
          const m = part.match(/\r\n\r\n([\s\S]*?)\r\n--/);
          if (m) formData.append('map', m[1].trim());
        } else if (part.includes('Content-Disposition: form-data; name="file"')) {
          const nm = part.match(/filename="([^"]+)"/);
          const fileName = nm ? nm[1] : 'file.pdf';
          const bodyStart = part.indexOf('\r\n\r\n') + 4;
          const endIdx = part.lastIndexOf('\r\n');
          const fileBuf = Buffer.from(part.substring(bodyStart, endIdx), 'latin1');
          formData.append('file', new Blob([fileBuf]), fileName);
        }
      }

      const apiRes = await fetch(isSandbox ? SANDBOX_API : PROD_API, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const text = await apiRes.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { error: text }; }
      return res.status(apiRes.ok ? 200 : apiRes.status).json(data);
    } else {
      let body = '';
      await new Promise(resolve => { req.on('data', c => { body += c; }); req.on('end', resolve); });
      const apiRes = await fetch(isSandbox ? SANDBOX_API : PROD_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body,
      });
      const text = await apiRes.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { error: text }; }
      return res.status(apiRes.ok ? 200 : apiRes.status).json(data);
    }
  } catch (err) {
    console.error('Autentique proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
