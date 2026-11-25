# runtime-bridge.github.io

The website and documentation for [rbridge](https://github.com/runtime-bridge/rbridge), published at <https://runtime-bridge.github.io>.

```sh
node build.mjs           # build into dist/
node build.mjs --serve   # build and serve on http://localhost:4173
```

No dependencies: Node.js 20 or later is enough. `build.mjs` renders the docs from a small Markdown dialect, highlights code at build time and writes a search index.

## Layout

| Path | What it holds |
|---|---|
| `src/index.html` | The landing page |
| `src/docs/NN-name.md` | One docs page each; the front matter sets its title, section and order |
| `src/assets/` | Styles, the page script and images |

Docs pages are Markdown with three additions:

- ```` ```lang title="Label" ```` names a code block.
- `:::tabs` around several code blocks shows them as tabs; readers' choice of tab is remembered across pages.
- `:::note`, `:::tip` and `:::warn` (optionally followed by a label) make a callout, closed by `:::`.

Pushing to `main` builds and publishes the site with GitHub Pages.
