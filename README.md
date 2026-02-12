# Dota 2 Update Monitor

Discord bot that monitors **Dota 2** (AppID 570) for real-time updates via the **Steam PICS protocol** and sends minimalist embed notifications to a Discord webhook.

## How It Works

```
Steam Network (PICS) → SteamMonitor → UpdateProcessor → DiscordNotifier → Discord Channel
```

1. **SteamMonitor** connects to Steam, enables PICS cache, and listens for `appUpdate` / `changelist` events
2. **UpdateProcessor** filters for Dota 2, extracts changelist number and build ID, deduplicates by changenumber
3. **DiscordNotifier** builds a clean embed with changelist, build ID, and patch notes link, then sends it to your Discord webhook
4. **State persistence** saves the last changenumber to `state.json` to avoid duplicate notifications on restart

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A Discord webhook URL ([how to create one](https://support.discord.com/hc/en-us/articles/228383668))

### Installation

```bash
git clone https://github.com/Anneardysa/dota-2-updater.git
cd dota-2-updater
npm install
```

Create a `.env` file:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN

# Optional — leave blank for anonymous login
STEAM_USERNAME=
STEAM_PASSWORD=
```

### Running

```bash
# Start monitoring (24/7 mode)
npm start

# Send a test embed with live Dota 2 data
npm test

# Development mode (auto-restart on file changes)
npm run dev
```

## Configuration

| Variable              | Required | Default       | Description            |
| --------------------- | -------- | ------------- | ---------------------- |
| `DISCORD_WEBHOOK_URL` | Yes      | —             | Discord webhook URL    |
| `STEAM_USERNAME`      | No       | _(anonymous)_ | Steam account username |
| `STEAM_PASSWORD`      | No       | _(anonymous)_ | Steam account password |

> Anonymous login is sufficient for PICS changelist monitoring. Credential-based login provides more detailed data.

## Embed Preview

The bot sends minimalist embeds with:

- **Author:** SteamDB with icon
- **Title:** Dota 2 — App Update (links to SteamDB)
- **Fields:** Changelist, Build ID, Patch Notes link
- **Color:** Monochrome white accent

## Deploy to Railway

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub Repo**
3. Select the `dota-2-updater` repo
4. Add environment variables in the **Variables** tab:
   - `DISCORD_WEBHOOK_URL`
   - `STEAM_USERNAME` (optional)
   - `STEAM_PASSWORD` (optional)
5. Railway runs `npm start` automatically — the bot stays alive 24/7

## Project Structure

```
├── config.js               # Environment config + validation
├── railway.json             # Railway deployment config
├── package.json
└── src/
    ├── index.js             # Entry point — wires up the pipeline
    ├── steam-monitor.js     # Steam PICS connection + event handling
    ├── update-processor.js  # Data extraction + deduplication + state
    ├── discord-notifier.js  # Embed builder + webhook delivery
    └── logger.js            # Console logger with level prefixes
```

## License

MIT
