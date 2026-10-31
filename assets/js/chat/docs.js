/**
 * Lectura de archivos en el dispositivo (nada se sube para extraer el texto):
 * PDF (pdf.js), DOCX/XLSX (fflate), CSV/TXT/MD/JSON/código e imágenes (vista previa).
 */
export const MAX_FILE_MB = 25;
const TEXT_EXT = /\.(txt|md|markdown|json|js|mjs|ts|tsx|jsx|py|html?|css|sql|xml|ya?ml|csv|tsv|log|ini|sh|java|c|cpp|cs|go|rs|php|rb)$/i;

export function kindOf(file) {
  const n = file.name.toLowerCase();
  if (file.type.startsWith('image/')) return 'image';
  if (n.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (n.endsWith('.docx')) return 'docx';
  if (n.endsWith('.xlsx')) return 'xlsx';
  if (/\.(csv|tsv)$/.test(n)) return 'csv';
  if (TEXT_EXT.test(n) || file.type.startsWith('text/')) return 'text';
  return 'other';
}

function parseCSV(text, sep) {
  sep = sep || (text.split('\n')[0].split(';').length > text.split('\n')[0].split(',').length ? ';' : text.includes('\t') ? '\t' : ',');
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; if (rows.length > 5000) break; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ''));
}

async function extractPdf(file, onProgress) {
  const pdfjs = await import('/assets/vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/assets/vendor/pdfjs/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const pages = Math.min(doc.numPages, 150);
  let text = '';
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const c = await page.getTextContent();
    text += c.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('') + '\n\n';
    onProgress && onProgress(p / pages);
  }
  return { text: text.replace(/[ \t]+\n/g, '\n').trim(), pages: doc.numPages };
}

/** Devuelve { id, name, kind, size, text?, table?, sheets?, pages?, url?, width?, height?, error? } */
export async function readFile(file, onProgress) {
  const base = { id: 'f' + Math.random().toString(36).slice(2, 9), name: file.name, size: file.size, kind: kindOf(file), type: file.type };
  if (file.size > MAX_FILE_MB * 1024 * 1024) return { ...base, error: `Supera ${MAX_FILE_MB} MB.` };
  try {
    if (base.kind === 'image') {
      const url = URL.createObjectURL(file);
      const dims = await new Promise((res) => { const im = new Image(); im.onload = () => res({ width: im.naturalWidth, height: im.naturalHeight }); im.onerror = () => res({}); im.src = url; });
      return { ...base, url, ...dims };
    }
    if (base.kind === 'pdf') return { ...base, ...(await extractPdf(file, onProgress)) };
    if (base.kind === 'docx') { const { extractDocx } = await import('/assets/vendor/office.js'); return { ...base, text: extractDocx(await file.arrayBuffer()) }; }
    if (base.kind === 'xlsx') {
      const { extractXlsx } = await import('/assets/vendor/office.js');
      const sheets = extractXlsx(await file.arrayBuffer());
      const text = sheets.map((s) => `## ${s.name}\n` + s.rows.slice(0, 300).map((r) => r.join(' | ')).join('\n')).join('\n\n');
      return { ...base, sheets, table: sheets[0] ? sheets[0].rows : [], text };
    }
    if (base.kind === 'csv') { const text = await file.text(); return { ...base, text, table: parseCSV(text, file.name.endsWith('.tsv') ? '\t' : undefined) }; }
    if (base.kind === 'text') return { ...base, text: (await file.text()).slice(0, 400_000) };
    return { ...base, error: 'Formato no soportado todavía.' };
  } catch (e) {
    console.warn('[docs]', e);
    return { ...base, error: 'No se pudo leer el archivo.' };
  }
}

export function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
