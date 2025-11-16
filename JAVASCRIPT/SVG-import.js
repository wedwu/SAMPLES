// secure-svg-import.js
// Node 18+ (global fetch). Express 4+. Run `npm i express uuid` if needed.

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import dns from 'dns/promises';
import net from 'net';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { mode: 0o700 });

// Helpers
function isHttpUrl(u) {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function hostnameToIPs(hostname) {
  try {
    const records = await dns.lookup(hostname, { all: true });
    return records.map(r => r.address);
  } catch {
    return [];
  }
}

function isPrivateIp(ip) {
  if (!net.isIP(ip)) return false;
  // IPv4 checks
  if (ip.startsWith('10.') || ip.startsWith('127.') || ip.startsWith('169.254.') ||
      ip.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  // IPv6 loopback / link-local / unspecified
  if (ip === '::1' || ip.startsWith('fe80') || ip === '::') return true;
  return false;
}

// Very conservative SVG sanitizer (regex-based). Removes <script> tags, XML external entities, and on* attributes.
// NOTE: regex isn't a full XML sanitizer but is reasonable for many practical cases. For production consider an XML parser sanitizer.
function sanitizeSvg(svgText) {
  // deny DOCTYPE and ENTITY (XXE)
  if (/<!\s*DOCTYPE/i.test(svgText) || /<!ENTITY/i.test(svgText)) {
    throw new Error('Forbidden SVG: contains DOCTYPE/ENTITY declarations');
  }

  // remove script tags (case-insensitive)
  svgText = svgText.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');

  // remove event handler attributes like onload="..." onclick='...'
  svgText = svgText.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // remove javascript: hrefs/xlink:href
  svgText = svgText.replace(/(href|xlink:href)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, '');

  // remove iframe/object/foreignObject tags which can include HTML
  svgText = svgText.replace(/<(iframe|object|embed|foreignObject)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');

  // optionally further restrictions: strip external <image xlink:href="http..."> or blob:
  // remove external references (very strict)
  svgText = svgText.replace(/(xlink:href|href)\s*=\s*(?:"https?:\/\/[^"]*"|'https?:\/\/[^']*')/gi, '');

  return svgText;
}

// Validate filename pattern (only uuid + .svg)
function isValidUploadName(name) {
  return /^[a-f0-9\-]{36}\.svg$/i.test(name);
}

// Express app
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Upload (import by URL)
app.post('/import.url', async (req, res) => {
  const url = String(req.body?.url || '').trim();
  if (!url) return res.status(400).send('Missing url');

  if (!isHttpUrl(url)) return res.status(400).send('URL must be http or https');

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).send('Invalid URL');
  }

  // Resolve hostname and block private IPs (SSRF mitigation)
  const ips = await hostnameToIPs(parsed.hostname);
  if (ips.length === 0) return res.status(400).send('Could not resolve hostname');

  for (const ip of ips) {
    if (isPrivateIp(ip)) {
      return res.status(403).send('Fetching private IP addresses is not allowed');
    }
  }

  // Optionally: allowlist hostnames (uncomment and fill array)
  // const ALLOWED_HOSTS = ['example.com', 'assets.trusted.com'];
  // if (!ALLOWED_HOSTS.includes(parsed.hostname)) return res.status(403).send('Host not allowed');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const r = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(timeout);

    if (!r.ok) return res.status(502).send(`Upstream fetch failed: ${r.status}`);

    // Check content-type header (some hosts misreport; we'll still inspect content)
    const ctype = r.headers.get('content-type') || '';
    if (!/svg/i.test(ctype) && !/xml/i.test(ctype) && !/text\/plain/i.test(ctype)) {
      // not strictly fatal — but prefer SVG-like responses
      // return res.status(400).send('URL did not return an SVG/XM L content-type');
      // We'll continue but still validate file contents below.
    }

    const text = await r.text();

    // Basic size limit (e.g., 500 KB)
    const maxBytes = 500 * 1024;
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      return res.status(413).send('SVG too large');
    }

    // Very conservative content check and sanitize
    let clean;
    try {
      clean = sanitizeSvg(text);
    } catch (err) {
      return res.status(400).send('SVG rejected: ' + String(err.message));
    }

    // final sanity: ensure it still looks like SVG
    if (!/<svg\b[^>]*>/i.test(clean)) {
      return res.status(400).send('Content is not a valid SVG');
    }

    const filename = `${uuidv4()}.svg`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Write atomically: write to temp then rename
    const tmpPath = filepath + '.tmp';
    fs.writeFileSync(tmpPath, clean, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmpPath, filepath);

    // Respond with where to view it
    return res.status(201).json({ message: 'Imported', filename });
  } catch (e) {
    if (e.name === 'AbortError') return res.status(504).send('Fetch timed out');
    console.error('Import error', e);
    return res.status(500).send('Failed to fetch URL: ' + String(e));
  }
});

// Serve raw uploaded file (safe static serving). Validate filename to prevent traversal.
app.get('/uploads/:name', (req, res) => {
  const name = req.params.name;
  if (!isValidUploadName(name)) return res.status(400).send('Invalid filename');

  const filePath = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');

  // Serve with correct content type and force download if you prefer:
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  // Optionally force download instead of inline to avoid browser executing SVG scripts:
  // res.setHeader('Content-Disposition', 'attachment; filename="' + name + '"');

  // Send file (Express will stream it)
  return res.sendFile(filePath);
});

// Preview page: embed sanitized SVG inline in a strict HTML page using CSP that blocks scripts.
// Because we sanitized earlier, this is an additional layer of defense.
app.get('/view/:name', (req, res) => {
  const name = req.params.name;
  if (!isValidUploadName(name)) return res.status(400).send('Invalid filename');

  const filePath = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');

  const svg = fs.readFileSync(filePath, 'utf8');

  // Very strict CSP for the preview page
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline';");
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Escape filename for title
  const safeTitle = name.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // since svg is sanitized on import, inlining is acceptable; if you want extra safety, serve as <img src="/uploads/...">
  return res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>View SVG - ${safeTitle}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body>
  <h1>Viewing SVG: ${safeTitle}</h1>
  <div id="preview">${svg}</div>
  <p><a href="/uploads/${safeTitle}" download>Download SVG</a> — <a href="/">Back</a></p>
</body>
</html>`);
});

// Example index
app.get('/', (req, res) => {
  res.send(`<h2>SVG Import Service</h2>
<p>POST /import.url with JSON { "url": "https://example.com/file.svg" }</p>`);
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Listening on', PORT);
});
