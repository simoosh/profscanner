/**
 * MathML -> OMML converter used for the Word export.
 *
 * Wraps `mathml2omml` and post-processes its output to fix what it gets wrong or
 * leaves out, so equations look like they were typed in Word's equation editor:
 *
 *  1. Stray text nodes (e.g. the "=7" after a sum) are wrapped in <m:r><m:t>; Word
 *     silently drops bare text inside OMML elements.
 *  2. Function names (sin, ln, lim…) are set upright. mathml2omml merges adjacent
 *     tokens into one run ("ln(x)"), which Word would render all in italics.
 *  3. Brackets around "tall" content (fractions, roots, matrices…) become stretchy
 *     delimiters (<m:d>); mathml2omml never emits delimiters.
 *  4. An opening brace followed by a matrix (systems of equations) becomes a
 *     stretchy left brace.
 *
 * Runs in the browser (DOMParser / XMLSerializer).
 */
import { mml2omml } from 'mathml2omml';

const M_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math';

const FUNCTION_NAME_REGEX =
  /(?<![A-Za-z])(arcsin|arccos|arctan|sinh|cosh|tanh|cotan|sin|cos|tan|cot|ln|log|exp|lim|max|min|sup|inf|det|pgcd|ppcm|gcd)(?![A-Za-z])/g;

const OPENING = new Map([
  ['(', ')'],
  ['[', ']'],
  ['{', '}'],
]);
const CLOSING = new Set([')', ']', '}']);
const BRACKET_CHARS = /([()[\]{}|])/;

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** mathml2omml can emit raw "<" inside <m:t> (e.g. for <mo>&lt;</mo>): re-escape. */
const escapeOmmlText = (omml: string) =>
  omml.replace(/<m:t(\s[^>]*)?>([\s\S]*?)<\/m:t>/g, (_match, attrs, text: string) => {
    const decoded = text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
    return `<m:t${attrs || ''}>${escapeXml(decoded)}</m:t>`;
  });

const elementChildren = (node: Node): Element[] =>
  Array.from(node.childNodes).filter((child): child is Element => child.nodeType === 1);

const isMathElement = (node: Node | null, localName: string): node is Element =>
  !!node && node.nodeType === 1 && (node as Element).namespaceURI === M_NS && (node as Element).localName === localName;

const getRunText = (run: Element): string | null => {
  const texts = elementChildren(run).filter((child) => isMathElement(child, 't'));
  return texts.length === 1 ? texts[0].textContent ?? '' : null;
};

const isNormalTextRun = (run: Element) =>
  elementChildren(run).some(
    (child) => isMathElement(child, 'rPr') && elementChildren(child).some((p) => isMathElement(p, 'nor'))
  );

const createRun = (doc: Document, text: string, template: Element | null): Element => {
  const run = doc.createElementNS(M_NS, 'm:r');
  const templateProps = template
    ? elementChildren(template).find((child) => isMathElement(child, 'rPr'))
    : undefined;
  if (templateProps) run.appendChild(templateProps.cloneNode(true));
  const t = doc.createElementNS(M_NS, 'm:t');
  t.setAttribute('xml:space', 'preserve');
  t.textContent = text;
  run.appendChild(t);
  return run;
};

const setUpright = (doc: Document, run: Element) => {
  let props = elementChildren(run).find((child) => isMathElement(child, 'rPr'));
  if (!props) {
    props = doc.createElementNS(M_NS, 'm:rPr');
    run.insertBefore(props, run.firstChild);
  }
  if (!elementChildren(props).some((child) => isMathElement(child, 'sty'))) {
    const sty = doc.createElementNS(M_NS, 'm:sty');
    sty.setAttribute('m:val', 'p');
    props.appendChild(sty);
  }
};

/** Replaces `run` by one run per piece, keeping its run properties. */
const replaceRun = (doc: Document, run: Element, pieces: { text: string; upright?: boolean }[]) => {
  const parent = run.parentNode;
  if (!parent) return;
  pieces
    .filter((piece) => piece.text !== '')
    .forEach((piece) => {
      const newRun = createRun(doc, piece.text, run);
      if (piece.upright) setUpright(doc, newRun);
      parent.insertBefore(newRun, run);
    });
  parent.removeChild(run);
};

// 1. Wrap stray text nodes ---------------------------------------------------------
const wrapStrayText = (doc: Document, element: Element) => {
  Array.from(element.childNodes).forEach((child) => {
    if (child.nodeType === 3 && element.localName !== 't' && (child.textContent ?? '').trim()) {
      element.replaceChild(createRun(doc, (child.textContent ?? '').trim(), null), child);
    } else if (child.nodeType === 1) {
      wrapStrayText(doc, child as Element);
    }
  });
};

// 2 + 3a. Split runs on function names and bracket characters ----------------------
const splitRuns = (doc: Document, root: Element) => {
  const runs = Array.from(root.getElementsByTagNameNS(M_NS, 'r'));
  runs.forEach((run) => {
    if (isNormalTextRun(run)) return;
    const text = getRunText(run);
    if (text === null || text.length <= 1) return;

    const pieces: { text: string; upright?: boolean }[] = [];
    let lastIndex = 0;
    text.replace(FUNCTION_NAME_REGEX, (match: string, _name: string, offset: number) => {
      pieces.push({ text: text.slice(lastIndex, offset) });
      pieces.push({ text: match, upright: true });
      lastIndex = offset + match.length;
      return match;
    });
    pieces.push({ text: text.slice(lastIndex) });

    // Isolate bracket characters so they can be paired across siblings.
    const finalPieces = pieces.flatMap((piece): { text: string; upright?: boolean }[] =>
      piece.upright
        ? [piece]
        : piece.text
            .split(BRACKET_CHARS)
            .filter((part) => part !== '')
            .map((part) => ({ text: part }))
    );

    const changed = finalPieces.length > 1 || finalPieces.some((piece) => piece.upright);
    if (changed) replaceRun(doc, run, finalPieces);
  });
};

// 3b + 4. Build stretchy delimiters --------------------------------------------------
const TALL_ELEMENTS = new Set([
  'f', 'rad', 'm', 'nary', 'eqArr', 'limLow', 'limUpp', 'd', 'box', 'borderBox', 'func',
]);

const containsTallContent = (nodes: Element[]): boolean =>
  nodes.some(
    (node) =>
      (node.namespaceURI === M_NS && TALL_ELEMENTS.has(node.localName)) ||
      // a superscript/subscript is tall only if its base or script holds tall content
      (node.namespaceURI === M_NS &&
        ['sSup', 'sSub', 'sSubSup'].includes(node.localName) &&
        Array.from(node.getElementsByTagNameNS(M_NS, '*')).some((d) => TALL_ELEMENTS.has(d.localName)))
  );

const bracketOf = (node: Element): string | null => {
  if (!isMathElement(node, 'r') || isNormalTextRun(node)) return null;
  const text = getRunText(node);
  return text && text.length === 1 && /[()[\]{}|]/.test(text) ? text : null;
};

const createDelimiter = (doc: Document, begin: string, end: string, content: Element[]): Element => {
  const delimiter = doc.createElementNS(M_NS, 'm:d');
  const props = doc.createElementNS(M_NS, 'm:dPr');
  const begChr = doc.createElementNS(M_NS, 'm:begChr');
  begChr.setAttribute('m:val', begin);
  const endChr = doc.createElementNS(M_NS, 'm:endChr');
  endChr.setAttribute('m:val', end);
  props.appendChild(begChr);
  props.appendChild(endChr);
  delimiter.appendChild(props);
  const e = doc.createElementNS(M_NS, 'm:e');
  content.forEach((node) => e.appendChild(node));
  delimiter.appendChild(e);
  return delimiter;
};

const buildDelimiters = (doc: Document, container: Element) => {
  // innermost first
  elementChildren(container).forEach((child) => buildDelimiters(doc, child));

  let changed = true;
  while (changed) {
    changed = false;
    const children = elementChildren(container);
    const stack: { index: number; char: string }[] = [];

    for (let i = 0; i < children.length && !changed; i += 1) {
      const char = bracketOf(children[i]);
      if (!char) continue;

      const top = stack[stack.length - 1];
      const closesTop =
        top && ((OPENING.get(top.char) === char) || (top.char === '|' && char === '|'));

      if (closesTop) {
        stack.pop();
        const inner = children.slice(top.index + 1, i);
        if (inner.length && containsTallContent(inner)) {
          const delimiter = createDelimiter(doc, top.char, char, inner);
          container.insertBefore(delimiter, children[top.index]);
          container.removeChild(children[top.index]);
          container.removeChild(children[i]);
          changed = true;
        }
      } else if (OPENING.has(char) || char === '|') {
        stack.push({ index: i, char });
      } else if (CLOSING.has(char)) {
        stack.length = 0;
      }
    }

    // Unmatched "{" directly followed by a matrix: system of equations.
    if (!changed) {
      const kids = elementChildren(container);
      for (let i = 0; i < kids.length - 1; i += 1) {
        if (bracketOf(kids[i]) === '{' && isMathElement(kids[i + 1], 'm')) {
          const matrix = kids[i + 1];
          container.insertBefore(createDelimiter(doc, '{', '', [matrix]), kids[i]);
          container.removeChild(kids[i]);
          changed = true;
          break;
        }
      }
    }
  }
};

/**
 * Post-processes an OMML string produced by mathml2omml.
 * Returns the input unchanged if it cannot be parsed.
 */
export const fixOmml = (omml: string): string => {
  const escaped = escapeOmmlText(omml);
  const doc = new DOMParser().parseFromString(escaped, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return escaped;

  const root = doc.documentElement;
  wrapStrayText(doc, root);
  splitRuns(doc, root);
  buildDelimiters(doc, root);
  return new XMLSerializer().serializeToString(root);
};

/** Converter passed to html-to-docx's `math.converter` option. */
export const convertMathMLToOMML = (mathml: string): string => fixOmml(mml2omml(mathml));
