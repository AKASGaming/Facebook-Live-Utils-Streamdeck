# Facebook Live Utils — Stream Deck

Toggle pinned comment links on your **Facebook Live** stream from an Elgato Stream Deck button.

The Stream Deck plugin itself is named **Live Pin Utils** and does not mention Facebook anywhere in its manifest or UI — that keeps it eligible for the Stream Deck Marketplace. This README is for GitHub setup and can reference Facebook directly.

## How it works

```
Stream Deck  →  Bridge server (localhost)  →  Browser extension  →  Facebook Live page
```

1. You configure links in the Stream Deck property inspector.
2. Pressing a button sends a toggle request to the local bridge.
3. The Chrome extension finds your open Facebook Live tab and pins or unpins the comment containing that link.

## Prerequisites

- [Elgato Stream Deck](https://www.elgato.com/stream-deck) app **7.1+**
- [Node.js](https://nodejs.org/) **20+** (22 works for development)
- Google Chrome or another Chromium browser (Edge, Brave, etc.)
- A Facebook page where you go live, with the live post open in the browser during your stream

## Quick start

### 1. Clone and build the plugin

```powershell
git clone https://github.com/AKASGaming/Facebook-Live-Utils-Streamdeck.git
cd Facebook-Live-Utils-Streamdeck
npm install
npm run icons
npm run build
```

### 2. Link the plugin to Stream Deck

```powershell
npm install -g @elgato/cli
streamdeck link "com.ashton.livepin.sdPlugin"
```

Restart the Stream Deck app if the plugin does not appear.

### 3. Start the bridge server

Keep this running while you stream:

```powershell
cd companion
npm install
npm start
```

The bridge listens on `http://127.0.0.1:9742`.

### 4. Load the browser extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `companion/extension` folder from this repo

The extension connects to the bridge automatically in the background.

### 5. Configure Stream Deck

1. In Stream Deck, find **Live Pin Utils** in the actions list
2. Drag **Toggle Pin Link** onto a key
3. In the property inspector:
   - Set **Bridge URL** if you changed the default (`http://127.0.0.1:9742`)
   - Add your links under **Links** (name, URL, optional comment text)
   - Choose which link this button controls from the **Link** dropdown

You can add multiple Stream Deck buttons, each assigned to a different link.

### 6. Go live on Facebook

1. Start your Facebook Live stream as usual
2. Open your **live video post** in the browser (the page with the comment feed)
3. Leave that tab open — do not minimize it
4. Press your Stream Deck button to pin or unpin the selected link

**First press** on a link that is not already in the comments will post the link as a comment and pin it. **Second press** unpins it.

## Development

Watch mode rebuilds the plugin and restarts it in Stream Deck:

```powershell
npm run watch
```

Project layout:

| Path | Purpose |
|------|---------|
| `src/` | Stream Deck plugin TypeScript source |
| `com.ashton.livepin.sdPlugin/` | Built plugin package |
| `companion/server.js` | Local HTTP/WebSocket bridge |
| `companion/extension/` | Chrome extension for Facebook Live DOM control |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Plugin not in Stream Deck | Run `streamdeck link` again; restart Stream Deck |
| Button shows **Error** | Make sure `companion/server.js` is running |
| **Browser extension not connected** | Reload the extension; confirm the bridge is running |
| **Open your live stream page** | Open the Facebook Live post with comments in Chrome |
| Pin action fails | Stay on the live post tab; try posting the comment manually once first |
| Linking fails (no Plugins folder) | Install Stream Deck desktop app first |

## Why two names?

- **Live Pin Utils** — Stream Deck plugin name (marketplace-safe, no platform branding)
- **Facebook Live Utils** — This repo describes what it actually does

## License

MIT
