/**
 * Dota 2 Update Monitor — Entry Point
 *
 * Wires up SteamMonitor → UpdateProcessor → DiscordNotifier.
 * Supports a --test flag to send a test embed without connecting to Steam.
 *
 * Usage:
 *   npm start          # Start monitoring
 *   npm test           # Send a test embed and exit
 *   node src/index.js --test   # Same as npm test
 */

import 'dotenv/config';
import logger from './logger.js';
import { validateConfig, DOTA2_APP_ID } from '../config.js';
import SteamMonitor from './steam-monitor.js';
import UpdateProcessor from './update-processor.js';
import DiscordNotifier from './discord-notifier.js';

// ── CLI flags ──────────────────────────────────────────────────────
const isTestMode = process.argv.includes('--test');

// ── Banner ─────────────────────────────────────────────────────────
logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
logger.info('  Dota 2 Update Monitor');
logger.info(`  Monitoring AppID: ${DOTA2_APP_ID}`);
logger.info(`  Mode: ${isTestMode ? 'TEST (send test embed)' : 'LIVE (monitoring Steam PICS)'}`);
logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ── Test mode ──────────────────────────────────────────────────────
if (isTestMode) {
  await runTestMode();
} else {
  await runLiveMode();
}

/**
 * Fetch the latest Dota 2 update from Steam and send it to Discord.
 */
async function runTestMode() {
  try {
    validateConfig({ isTest: false });

    logger.info('Connecting to Steam to fetch latest Dota 2 data...');
    const monitor = new SteamMonitor();
    const processor = new UpdateProcessor();
    const notifier = new DiscordNotifier();

    // Wait for Steam connection + PICS cache to be ready
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Steam connection timed out (30s)')), 30_000);
      monitor.on('ready', () => {
        clearTimeout(timeout);
        resolve();
      });
      monitor.connect();
    });

    // Fetch latest product info for Dota 2
    logger.info('Fetching latest Dota 2 product info...');
    const cache = monitor.picsCache;
    const appData = cache?.apps?.[DOTA2_APP_ID];

    if (!appData) {
      throw new Error('Could not retrieve Dota 2 data from PICS cache');
    }

    // Process through the real pipeline
    const update = processor.process({
      appid: DOTA2_APP_ID,
      data: appData,
      changenumber: appData.changenumber ?? 0,
      timestamp: new Date(),
    });

    if (!update) {
      // Force send even if deduplicated — this is a test
      logger.warn('Update was deduplicated — sending with mock changenumber for test');
      const forced = processor.process({
        appid: DOTA2_APP_ID,
        data: appData,
        changenumber: (appData.changenumber ?? 0) + 1,
        timestamp: new Date(),
      });
      if (forced) {
        await notifier.sendUpdate(forced);
      }
    } else {
      await notifier.sendUpdate(update);
    }

    logger.info('✅ Test embed sent with latest Dota 2 data! Check your Discord channel.');
    monitor.disconnect();
    notifier.destroy();
    process.exit(0);
  } catch (err) {
    logger.error(`Test mode failed: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Connect to Steam and monitor for Dota 2 updates.
 */
async function runLiveMode() {
  try {
    validateConfig();
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }

  const monitor = new SteamMonitor();
  const processor = new UpdateProcessor();
  const notifier = new DiscordNotifier();

  // ── Wire up the pipeline ───────────────────────────────────────

  monitor.on('ready', () => {
    logger.info('🎮 Bot is ready — listening for Dota 2 updates...');
    if (processor.lastChangenumber) {
      logger.info(`Last known changenumber: ${processor.lastChangenumber}`);
    }
  });

  monitor.on('dota2Update', async (event) => {
    logger.info(`Received update event (changenumber: ${event.changenumber})`);

    // Process and deduplicate
    const update = processor.process(event);
    if (!update) {
      logger.debug('Update was a duplicate — skipping notification');
      return;
    }

    // Send to Discord
    const sent = await notifier.sendUpdate(update);
    if (!sent) {
      logger.warn('Failed to deliver update to Discord — will retry on next update');
    }
  });

  // ── Graceful shutdown ──────────────────────────────────────────

  const shutdown = (signal) => {
    logger.info(`\nReceived ${signal} — shutting down gracefully...`);
    monitor.disconnect();
    notifier.destroy();
    logger.info('Goodbye! 👋');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught errors gracefully
  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught exception: ${err.message}`);
    logger.error(err.stack);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled rejection: ${reason}`);
  });

  // ── Connect to Steam ──────────────────────────────────────────
  monitor.connect();
}
