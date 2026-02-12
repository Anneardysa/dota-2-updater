/**
 * DiscordNotifier — Sends rich embed notifications to Discord via webhook.
 * Embeds replicate the SteamDB app update style.
 */

import { EmbedBuilder, WebhookClient } from 'discord.js';
import logger from './logger.js';
import { DISCORD_WEBHOOK_URL, DOTA2_APP_ID } from '../config.js';


/** Constants */
const STEAMDB_ICON = 'https://steamdb.info/static/logos/512px.png';
const DOTA2_ICON = 'https://cdn.ardysamods.my.id/image/ardysa.png';
const EMBED_COLOR = 0xF5F5F5; // Clean white accent — minimalist monochrome
const STEAMDB_APP_URL = `https://steamdb.info/app/${DOTA2_APP_ID}/`;
const STEAMDB_CHANGELIST_URL = (n) => `https://steamdb.info/changelist/${n}/`;
const STEAMDB_PATCHNOTES_URL = (buildId) => `https://steamdb.info/patchnotes/${buildId}/`;

export default class DiscordNotifier {
  /** @type {WebhookClient|null} */
  #webhook = null;

  /**
   * Initialize the webhook client.
   * Parses the webhook URL to extract id and token.
   */
  constructor() {
    if (!DISCORD_WEBHOOK_URL) {
      logger.warn('No Discord webhook URL configured — notifications disabled');
      return;
    }

    try {
      this.#webhook = new WebhookClient({ url: DISCORD_WEBHOOK_URL });
      logger.info('Discord webhook client initialized');
    } catch (err) {
      logger.error(`Failed to initialize webhook: ${err.message}`);
    }
  }

  /**
   * Send an update notification embed to Discord.
   *
   * @param {object} update - Processed update data from UpdateProcessor
   * @returns {Promise<boolean>} Whether the send succeeded
   */
  async sendUpdate(update) {
    if (!this.#webhook) {
      logger.warn('Webhook not configured — skipping notification');
      return false;
    }

    try {
      const embed = this.#buildEmbed(update);

      await this.#webhook.send({
        username: 'AMT Bot',
        avatarURL: DOTA2_ICON,
        embeds: [embed],
      });

      logger.info(`Discord notification sent for changelist #${update.changenumber}`);
      return true;
    } catch (err) {
      logger.error(`Failed to send Discord notification: ${err.message}`);
      return false;
    }
  }

  /**
   * Build a minimalist embed for Dota 2 app updates.
   *
   * Clean layout with no emojis, monochrome accent, and
   * description-based body for a streamlined look.
   *
   * @param {object} update - Processed update data
   * @returns {EmbedBuilder}
   */
  #buildEmbed(update) {
    const embed = new EmbedBuilder()
      .setAuthor({
        name: 'SteamDB',
        iconURL: STEAMDB_ICON,
        url: STEAMDB_APP_URL,
      })
      .setTitle(`${update.appName} — App Update`)
      .setURL(STEAMDB_APP_URL)
      .setThumbnail(DOTA2_ICON)
      .setColor(EMBED_COLOR)

      .setTimestamp(update.timestamp);

    // ── Changelist + Build ID (inline pair) ───────────────────────
    const changelistValue = update.changenumber !== 'Unknown'
      ? `[#${update.changenumber}](${STEAMDB_CHANGELIST_URL(update.changenumber)})`
      : 'Unknown';

    embed.addFields({
      name: 'Changelist',
      value: changelistValue,
      inline: true,
    });

    if (update.buildId) {
      embed.addFields({
        name: 'Build ID',
        value: `\`${update.buildId}\``,
        inline: true,
      });
    }

    // ── Patch Notes ───────────────────────────────────────────────
    if (update.buildId) {
      embed.addFields({
        name: 'Patch Notes',
        value: `[View on SteamDB](${STEAMDB_PATCHNOTES_URL(update.buildId)})`,
        inline: false,
      });
    }



    // ── Footer ────────────────────────────────────────────────────
    embed.setFooter({
      text: `App ${DOTA2_APP_ID} \u2022 Steam PICS`,
    });

    return embed;
  }

  /**
   * Send a test embed to the webhook to verify formatting.
   * Uses mock data that resembles a real Dota 2 update.
   * @returns {Promise<boolean>}
   */
  async sendTestEmbed() {
    const mockUpdate = {
      appId: DOTA2_APP_ID,
      appName: 'Dota 2',
      changenumber: 28_453_921,
      buildId: '16892451',
      timeUpdated: new Date(),
      timestamp: new Date(),
      branches: [
        { name: 'public', buildId: '16892451', timeUpdated: new Date() },
      ],
      changedDepots: [],
      depotCount: 0,
      raw: { missingToken: false },
    };

    logger.info('Sending test embed to Discord...');
    return this.sendUpdate(mockUpdate);
  }

  /**
   * Destroy the webhook client and clean up.
   */
  destroy() {
    if (this.#webhook) {
      this.#webhook.destroy();
      this.#webhook = null;
      logger.info('Discord webhook client destroyed');
    }
  }
}
