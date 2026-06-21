# Facebook Live Utils — Stream Deck

Toggle pinned links in your **Facebook Live Producer** Featured Links panel from an Elgato Stream Deck button.

The Stream Deck plugin itself is named **Live Pin Utils** and does not mention Facebook anywhere in its manifest or UI — that keeps it eligible for the Stream Deck Marketplace. This README is for GitHub setup and can reference Facebook directly.

## How it works

```
Stream Deck  →  Bridge server (localhost)  →  Browser extension (content script)  →  Facebook Live Producer
```

1. Links are read automatically from the **Featured → Links** panel in Facebook Live Producer.
2. The dropdown in Stream Deck lists those links — you do not add them manually.
3. Pressing a button clicks **Pin** or **Unpin** on the matching link row.

## Prerequisites

- [Elgato Stream Deck](https://www.elgato.com/stream-deck) app **7.1+**
- [Node.js](https://nodejs.org/) **20+**
- Google Chrome or another Chromium browser (Edge, Brave, etc.)
- Facebook Live Producer open with your **Featured Links** panel visible

## Quick start

### 1. Clone and build the plugin

```powershell
git clone https://github.com/AKASGaming/Facebook-Live-Utils-Streamdeck.git
cd Facebook-Live-Utils-Streamdeck
npm install
npm run icons
npm run profiles
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

After updates, click **Reload** on the extension card.

### 5. Configure Stream Deck

1. In Stream Deck, find **Live Pin Utils** in the actions list
2. Drag **Toggle Pin Link** onto a key
3. Open **Facebook Live Producer** in Chrome with the **Featured → Links** tab visible
4. In the Stream Deck property inspector, pick a link from the **Link** dropdown

You can add multiple Stream Deck buttons, each assigned to a different link.

#### Pin Link Menu (Krabs-style folder)

Instead of assigning one link per button, you can use **Pin Link Menu**:

1. Drag **Pin Link Menu** onto a key on your main profile
2. When prompted, install the bundled **Pin Links** profile for your device (required once per device type)
3. Press the button during a stream — the plugin refreshes links from Live Producer and switches to the menu profile
4. Each key shows a link title (currently pinned links are marked **PINNED**)
5. Press a link key to pin that link
6. Press **BACK** (top-left) to return to your previous profile

The menu supports up to **14 links** on a standard Stream Deck, **31** on XL, **7** on Plus/Neo, and **5** on Mini. Extra keys stay blank if you have fewer links.

Both **Toggle Pin Link** and **Pin Link Menu** share the same bridge URL setting in the property inspector. The menu action does not use the link dropdown — links load automatically when you press the button.

### 6. Go live

1. Start your Facebook Live stream as usual
2. Keep **Live Producer** open in Chrome with the Links panel visible
3. Press your Stream Deck button to pin or unpin the selected link

If a different link is already pinned, the extension unpins it first, then pins your selected link.

## Updating an existing install

From your project folder:

```powershell
cd Facebook-Live-Utils-Streamdeck
git pull
npm install
npm run prepare:plugin
cd companion
npm install
```

`npm run prepare:plugin` regenerates icons, menu profiles, and the plugin bundle in one step. You can run the steps separately instead if you prefer: `npm run icons`, then `npm run profiles`, then `npm run build`.

Then apply the update:

1. **Reload the browser extension** at `chrome://extensions` (click the reload icon on Live Pin Bridge)
2. **Restart the bridge** — stop the old terminal (`Ctrl+C`), then run `npm start` again in `companion/`
3. **Restart the Stream Deck plugin** — from the project root, run `streamdeck restart com.ashton.livepin`, or restart the Stream Deck app entirely
4. **Reinstall the Pin Links profile** if you use **Pin Link Menu** — Stream Deck may prompt you again after the update. Accept the install prompt for your device. If nothing happens, unlink and re-link the plugin:

```powershell
streamdeck unlink com.ashton.livepin
streamdeck link "com.ashton.livepin.sdPlugin"
```

Restart Stream Deck, then accept the **Pin Links** profile install when prompted.

If you linked the plugin with `streamdeck link`, a rebuild is enough for most changes — Stream Deck picks up updates after the restart in step 3. If the plugin does not update at all, run `streamdeck link "com.ashton.livepin.sdPlugin"` again from the repo root.

**Pin Link Menu:** Drag **Pin Link Menu** onto a key to open a full-page menu of links from Live Producer (see [Pin Link Menu](#pin-link-menu-krabs-style-folder) above). It does not use the link dropdown — links load when you press the button. Existing **Toggle Pin Link** buttons keep working as before.

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
| `companion/extension/` | Chrome extension — WebSocket runs in the content script on the Live Producer tab |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Plugin not in Stream Deck | Run `streamdeck link` again; restart Stream Deck |
| Button shows **Error** | Make sure `companion/server.js` is running |
| **Browser extension not connected** | Reload the extension; confirm the bridge is running; keep Live Producer tab open |
| Dropdown is empty | Open Live Producer, expand **Featured**, select the **Links** tab, then reopen the property inspector |
| **Pin Link Menu** shows a link dropdown that never loads | Update to the latest build — the menu uses its own settings panel and does not need a dropdown |
| **Pin Links profile install does nothing** | Run `npm install`, then `npm run prepare:plugin`, restart the plugin, and accept the install prompt. If it still fails, run `streamdeck unlink com.ashton.livepin` then `streamdeck link "com.ashton.livepin.sdPlugin"` and restart Stream Deck |
| Menu button flashes alert | Install the **Pin Links** profile when prompted, or check that the bridge and Live Producer tab are open |
| **Link not found in Live Producer** | Ensure the Links panel is expanded and links are listed with Pin buttons |
| Extension disconnects often | Update to latest version — the WebSocket now runs in the content script (tab must stay open) |
| Linking fails (no Plugins folder) | Install Stream Deck desktop app first |

## Why two names?

- **Live Pin Utils** — Stream Deck plugin name (marketplace-safe, no platform branding)
- **Facebook Live Utils** — This repo describes what it actually does

## License

MIT
