# Vendored `@turbodocx/html-to-docx` (with MathML support)

`html-to-docx.browser.esm.js` is the minified browser build of
[`@turbodocx/html-to-docx`](https://github.com/TurboDocx/html-to-docx) **plus the MathML support
proposed in [TurboDocx/html-to-docx#271](https://github.com/TurboDocx/html-to-docx/pull/271)**.

- Source: [`simoosh/html-to-docx`](https://github.com/simoosh/html-to-docx), branch `feat/mathml-support`, commit `c20607b`
- Built with: `cross-env NODE_ENV=production BUILD_TARGET=browser rollup -c`
- License: MIT (see `LICENSE`)

It is vendored only until that pull request is merged and released. Then:

1. `npm install @turbodocx/html-to-docx`
2. In `services/docxExport.ts`, import from `@turbodocx/html-to-docx` instead of this folder
3. Delete this folder
