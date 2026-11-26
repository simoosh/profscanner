/**
 * HTML (+ MathML) -> .docx, entirely in the browser.
 *
 * Uses html-to-docx with its MathML support: every <math> becomes a native,
 * editable Word equation. The library (~1.7 MB) is loaded only on first export.
 */
// Imported statically on purpose: JSZip detects Node's Buffer when it is first loaded, and
// must be initialised BEFORE installNodeGlobals() adds the minimal Buffer shim that the
// html-to-docx browser build needs (with the shim, JSZip writes broken file names).
import JSZip from 'jszip';
import { convertMathMLToOMML } from './mathConverter';

/**
 * The html-to-docx browser build expects a few Node.js globals to exist before it
 * loads (documented in its README, "Browser Usage").
 */
const installNodeGlobals = () => {
  const g = globalThis as any;
  if (typeof g.global === 'undefined') g.global = globalThis;
  if (typeof g.process === 'undefined') g.process = { env: {} };
  if (typeof g.Buffer === 'undefined') {
    g.Buffer = {
      from(data: unknown, encoding?: string) {
        if (typeof data === 'string') {
          if (encoding === 'base64') {
            const binary = atob(data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
            return bytes;
          }
          return new TextEncoder().encode(data);
        }
        return new Uint8Array(data as ArrayBuffer);
      },
      isBuffer: () => false,
    };
  }
};

const BLOCK_TAGS =new Set(['P', 'DIV', 'UL', 'OL', 'TABLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE']);

/**
 * Right-to-left documents are converted with every paragraph marked RTL (w:bidi). Two
 * things then need to be mirrored for Word to show what the HTML shows:
 * - alignment: in an RTL paragraph Word reads "right" as "end of line", which is the LEFT
 *   side, so text-align left/right are swapped;
 * - tables: the converter writes cells left to right and has no RTL table support, so the
 *   cells of each row are reversed (the first cell, read first, ends up on the right).
 */
const mirrorForRtl = (doc: Document) => {
  doc.body.querySelectorAll<HTMLElement>('[style*="text-align"]').forEach((el) => {
    const align = el.style.textAlign;
    if (align === 'right') el.style.textAlign = 'left';
    else if (align === 'left') el.style.textAlign = 'right';
  });
  doc.body.querySelectorAll('table').forEach((table) => {
    Array.from(table.rows).forEach((row) => {
      Array.from(row.cells)
        .reverse()
        .forEach((cell) => row.appendChild(cell));
    });
  });
};

/**
 * Normalizes AI-generated HTML before conversion:
 * - keeps only the <body> content (no doctype/head/title noise);
 * - detects right-to-left documents;
 * - wraps inline content of table cells in a <p>, otherwise the converter would put
 *   each inline element (text, equation, bold…) of a "boxed" cell on its own line.
 */
const normalizeHtml = (html: string): { body: string; rtl: boolean } => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rtl =
    doc.documentElement.getAttribute('dir') === 'rtl' ||
    doc.body.getAttribute('dir') === 'rtl' ||
    /direction\s*:\s*rtl/i.test(doc.body.getAttribute('style') || '');

  doc.body.querySelectorAll('td, th').forEach((cell) => {
    const hasBlockChild = Array.from(cell.children).some((child) => BLOCK_TAGS.has(child.tagName));
    if (!hasBlockChild && cell.childNodes.length) {
      const p = doc.createElement('p');
      while (cell.firstChild) p.appendChild(cell.firstChild);
      cell.appendChild(p);
    }
  });

  doc.body.querySelectorAll('script, style, link, meta, title').forEach((node) => node.remove());

  if (rtl) mirrorForRtl(doc);

  return { body: doc.body.innerHTML, rtl };
};

// ── Right-to-left runs ──────────────────────────────────────────────────
const RTL_CHARS = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const LATIN_LETTERS = /[A-Za-zÀ-ɏ]/;
// Run properties that must come after <w:rtl/> (OOXML child order).
const AFTER_RTL = /<w:(cs|em|lang|eastAsianLayout|specVanish|oMath)\b/;

/**
 * Marks one <w:r> as right-to-left by adding <w:rtl/> to its properties.
 * An RTL run is drawn with the "complex script" properties (bCs, iCs, szCs), so bold,
 * italic and size are mirrored onto them; otherwise Arabic text would lose its
 * bold and get the style's complex-script size instead of the requested one.
 */
const addRtlToRun = (run: string): string => {
  if (/<w:rtl\s*\/>/.test(run)) return run;
  if (/<w:rPr\s*\/>/.test(run)) return run.replace(/<w:rPr\s*\/>/, '<w:rPr><w:rtl/></w:rPr>');
  const props = run.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
  if (props) {
    let inner = props[1];
    if (/<w:b\s*\/>/.test(inner) && !/<w:bCs\b/.test(inner)) inner = inner.replace(/<w:b\s*\/>/, '<w:b/><w:bCs/>');
    if (/<w:i\s*\/>/.test(inner) && !/<w:iCs\b/.test(inner)) inner = inner.replace(/<w:i\s*\/>/, '<w:i/><w:iCs/>');
    const size = inner.match(/<w:sz w:val="(\d+)"\s*\/>/);
    if (size && !/<w:szCs\b/.test(inner)) inner = inner.replace(size[0], `${size[0]}<w:szCs w:val="${size[1]}"/>`);
    const index = inner.search(AFTER_RTL);
    const updated = index >= 0 ? `${inner.slice(0, index)}<w:rtl/>${inner.slice(index)}` : `${inner}<w:rtl/>`;
    return run.replace(props[0], `<w:rPr>${updated}</w:rPr>`);
  }
  return run.replace(/^<w:r>/, '<w:r><w:rPr><w:rtl/></w:rPr>');
};

/**
 * html-to-docx marks RTL paragraphs with <w:bidi/> but puts <w:rtl/> in the paragraph
 * properties, where Word ignores it, instead of on the text runs. Without it Word lays
 * out digits, colons and parentheses next to Arabic text as left-to-right, which
 * scrambles lines like « تمرين 1 : … » or « 1) … ».
 * In every RTL paragraph, runs with Arabic/Hebrew text, or with only digits and
 * punctuation, become RTL (as when typing with an Arabic keyboard); runs containing
 * Latin letters (French, variable names) stay LTR.
 */
export const fixRtlRuns = (documentXml: string): string =>
  documentXml
    .replace(/(<w:pPr>(?:(?!<\/w:pPr>)[\s\S])*?)<w:rtl w:val="1"\s*\/>/g, '$1')
    .replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraph) => {
      if (!/<w:bidi\s*\/>/.test(paragraph)) return paragraph;
      return paragraph.replace(/<w:r>[\s\S]*?<\/w:r>/g, (run) => {
        const text = [...run.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
        if (!text.trim()) return run;
        const rtl = RTL_CHARS.test(text) || !LATIN_LETTERS.test(text);
        return rtl ? addRtlToRun(run) : run;
      });
    });

const postProcessRtl = async (blob: Blob): Promise<Blob> => {
  const zip = await JSZip.loadAsync(blob);
  const file = zip.file('word/document.xml');
  if (!file) return blob;
  zip.file('word/document.xml', fixRtlRuns(await file.async('string')));
  // Arabic text uses the complex-script font: make it Calibri like the rest of the document
  // instead of the theme's default (Times New Roman / Arial).
  const styles = zip.file('word/styles.xml');
  if (styles) {
    zip.file('word/styles.xml', (await styles.async('string')).replace(/w:cstheme="minorBidi"/g, 'w:cs="Calibri"'));
  }
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
};

/** Builds a .docx Blob from the transcription HTML. */
export const buildDocx = async (html: string, title: string): Promise<Blob> => {
  installNodeGlobals();
  const { default: HTMLtoDOCX } = await import('../vendor/html-to-docx/html-to-docx.browser.esm.js');
  const { body, rtl } = normalizeHtml(html);

  const result = await HTMLtoDOCX(body, null, {
    title,
    creator: 'ProfScanner',
    font: 'Calibri',
    fontSize: 24, // half-points: 12 pt, as requested in the transcription prompt
    complexScriptFontSize: 24, // Arabic text uses the complex-script size: keep it at 12 pt too
    direction: rtl ? 'rtl' : 'ltr',
    lang: rtl ? 'ar-DZ' : 'fr-FR',
    math: { converter: convertMathMLToOMML },
  });

  const blob =
    result instanceof Blob
      ? result
      : new Blob([result], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
  return rtl ? postProcessRtl(blob) : blob;
};

/** Triggers the download of a Blob as `<fileName>.docx`. */
export const downloadBlob = (blob: Blob, fileName: string) => {
  const safeName = fileName.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'transcription';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
