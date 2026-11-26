// Minimal typings for the vendored browser build (subset of the upstream index.d.ts).

export interface HtmlToDocxOptions {
  orientation?: 'portrait' | 'landscape';
  title?: string;
  creator?: string;
  lastModifiedBy?: string;
  font?: string;
  fontSize?: number;
  complexScriptFontSize?: number;
  lang?: string;
  direction?: 'ltr' | 'rtl';
  table?: { row?: { cantSplit?: boolean }; addSpacingAfter?: boolean };
  preprocessing?: { skipHTMLMinify?: boolean };
  math?: {
    converter?: (mathml: string, context: { display: boolean }) => string | Promise<string>;
  };
}

declare function HTMLtoDOCX(
  htmlString: string,
  headerHTMLString?: string | null,
  documentOptions?: HtmlToDocxOptions,
  footerHTMLString?: string | null
): Promise<ArrayBuffer | Blob>;

export default HTMLtoDOCX;
