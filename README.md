# Dota 2 Update Monitor

Discord bot that monitors **Dota 2** (AppID 570) for real-time updates via the **Steam PICS protocol** and sends rich embed notifications to a Discord webhook — styled like SteamDB changelist alerts.

## How It Works

```
Steam Network (PICS) → SteamMonitor → UpdateProcessor → DiscordNotifier → Discord Channel
```

1. **SteamMonitor** connects to Steam anonymously, enables PICS cache, and listens for `appUpdate` / `changelist` events
2. **UpdateProcessor** filters for Dota 2, extracts changelist number, build ID, depots/branches, and deduplicates by changenumber
3. **DiscordNotifier** builds a rich embed and sends it to your Discord webhook
4. **State persistence** saves the last changenumber to `state.json` to avoid duplicate notifications on restart

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A Discord webhook URL ([how to create one](https://support.discord.com/hc/en-us/articles/228383668))

### Installation

```bash
git clone https://github.com/YourUser/dota-2-updater.git
cd dota-2-updater
npm install
cp .env.example .env
```

Edit `.env` and add your Discord webhook URL:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN
```

### Running

```bash
# Start monitoring
npm start

# Send a test embed to verify formatting
npm test

# Development mode (auto-restart on file changes)
npm run dev
```

## Configuration

| Variable              | Required | Default       | Description            |
| --------------------- | -------- | ------------- | ---------------------- |
| `DISCORD_WEBHOOK_URL` | ✅       | —             | Discord webhook URL    |
| `STEAM_USERNAME`      | ❌       | _(anonymous)_ | Steam account username |
| `STEAM_PASSWORD`      | ❌       | _(anonymous)_ | Steam account password |

> **Note:** Anonymous login is sufficient for PICS changelist monitoring. Credential-based login provides more detailed depot info.

## Embed Preview

The bot sends rich embeds styled like SteamDB app-update notifications:

- **Author:** SteamDB with icon
- **Title:** Dota 2 — App Update (links to SteamDB)
- **Fields:** Changelist number, Build ID, Changed depots, Branches
- **Thumbnail:** Dota 2 capsule image
- **Color:** Steam dark blue (#1B2838)

## License

MIT
