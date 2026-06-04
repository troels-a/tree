# tree

A single-page app for building directory tree structures and copying them as ASCII/markdown — handy for docs and AI-agent prompts.

```
my-project/
├── src/
│   └── index.ts
├── package.json
└── README.md
```

## Features

- Visual, keyboard-driven tree editor that renders live `├──`/`└──` connectors
- One-click (or `⌘/Ctrl+C`) copy of the rendered ASCII tree
- Clear button to reset the tree to an empty root
- Drag-and-drop reordering (hold `Alt` while dropping to nest)
- Undo / redo (`⌘/Ctrl+Z`, `⌘/Ctrl+Shift+Z`)
- State persisted to `localStorage`

### Keyboard

| Key | Action |
| --- | --- |
| `↑` / `↓` | Move selection through the tree |
| `→` | Go into the first child |
| `←` | Go out to the parent; discards a just-created unnamed node |
| `Space` | Add a sibling |
| `⇧Space` | Add a child |
| `Enter` | Rename the selected node |
| `Delete` / `Backspace` | Remove the selected node (the root is protected) |
| `Tab` / `⇧Tab` | Indent / outdent |
| hold `⇧` + `↑`/`↓` | Move the selected node up/down the whole tree |
| `⌘`/`Ctrl` + `C` | Copy the rendered tree |
| `⌘`/`Ctrl` + `Z` / `⇧Z` | Undo / redo |

Shortcuts work anywhere on the page.

## Stack

Next.js (App Router) · TypeScript · CSS Modules · JetBrains Mono · Jest + React Testing Library. No backend.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit + integration tests
npm run build    # production build
```

## Deploy

Zero-config on Vercel — connect the repo and deploy. No environment variables required.
