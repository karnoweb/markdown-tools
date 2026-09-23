# Markdown Tools

RTL Markdown editor with live preview — built for [karnoweb.ir](https://karnoweb.ir).

## Features

- Pro layout: slim header + file history sidebar + editor/preview
- Local document history in `localStorage` (create, open, rename, lock, delete)
- Locked documents cannot be deleted until unlocked
- Markdown formatting toolbar (bold, italic, strike, headings, lists, tasks, tables, code, links, images)
- Find/replace (Ctrl+F / Ctrl+H), document search, closable/toggleable TOC in full preview, word count, line numbers
- Paste/drop images into Markdown; KaTeX math (`$…$`, `$$…$$`); YAML front matter banner
- Local snapshots, backup import/export, optional autosave-to-disk, Persian/English UI
- Side-by-side edit and preview (RTL / LTR)
- Karnoweb brand themes (Pro Dark / Pro Light)
- Code highlighting (Prism), copyable code blocks, and diagrams (Mermaid)
- Export: HTML, Markdown, PDF, image (PNG), Word (.doc)
- **Web**: PWA with offline cache (via Laragon or any static host)
- **Desktop**: Electron builds for Windows, Linux, and macOS

## Shortcuts

- `Ctrl/Cmd+S` save active document (Electron: also writes linked `.md` file to disk)
- `Ctrl/Cmd+N` new document
- `Esc` exit full preview / close mobile sidebar

## QA

Append `?selfcheck=1` to the URL to run a small title/id self-check in the console.

## Web (Laragon / server)

Serve the project root with any static web server and open `index.html` (e.g. `http://rtlmd.test/` on Laragon).

All libraries and fonts are bundled under `assets/vendor/` — no CDN at runtime.

### PWA (optional, in browser)

1. Open over **http(s)** (not `file://`).
2. Use the **download icon** in the toolbar when the browser offers install, or **Install app** in Chrome/Edge.
3. After install, launch from Start Menu / app launcher — works offline after the first load.

If no install prompt appears, use the toolbar install button for manual instructions, or install via the browser menu.

## Desktop (Electron)

Recommended for double-click use on Windows/Linux/macOS — no terminal window, fully offline.

```bash
npm install
npm run vendor    # bundle CSS/fonts/icons (first time & after dep updates)
npm start         # run desktop app in dev
npm run dist:win  # Windows installer + portable exe → dist/
npm run dist:linux
npm run dist:mac
npm run dist      # build for current OS
```

Output appears in `dist/` (e.g. `Markdown Tools Setup.exe`, portable exe, AppImage, `.deb`, `.dmg`).

### Open `.md` files with double-click

Install with **`Markdown Tools Setup.exe`** (not the portable exe) so Windows registers `.md` / `.markdown` file associations.

After upgrading, **uninstall the old version first**, then install **1.6.2+** and set the default app again:

1. Right-click a `.md` file → **Open with** → **Choose another app**
2. Select **Markdown Tools** (not "Electron")
3. Enable **Always** / **Set default**
4. If an old "Electron" entry remains, pick **Markdown Tools** from the list or browse to `C:\Program Files\Markdown Tools\Markdown Tools.exe`

Dev test without reinstalling:

```bash
npm start -- path\to\notes.md
```

## License

MIT — see [`license`](license).
