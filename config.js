/**
 * Centralized configuration from environment variables.
 * All config is validated at startup — fail fast on missing required values.
 */

/** Dota 2 App ID on Steam */
export const DOTA2_APP_ID = 570;

/** Discord webhook URL (required) */
export const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";

/** Steam credentials (optional — blank = anonymous login) */
export const STEAM_USERNAME = process.env.STEAM_USERNAME || "";
export const STEAM_PASSWORD = process.env.STEAM_PASSWORD || "";

/** Whether to use anonymous Steam login */
export const STEAM_ANONYMOUS = !STEAM_USERNAME;

/** Path to persist last known changenumber */
export const STATE_FILE = "state.json";

/** PICS cache update interval in ms (steam-user default is 60s) */
export const CHANGELIST_UPDATE_INTERVAL = 60_000;

/**
 * Validate required configuration at startup.
 * @param {object} options
 * @param {boolean} options.isTest - Skip webhook validation in test mode
 */
export function validateConfig({ isTest = false } = {}) {
   const errors = [];

   if (!isTest && !DISCORD_WEBHOOK_URL) {
      errors.push("DISCORD_WEBHOOK_URL is required. Set it in your .env file.");
   }

   if (errors.length > 0) {
      throw new Error(`Configuration errors:\n  - ${errors.join("\n  - ")}`);
   }
}
