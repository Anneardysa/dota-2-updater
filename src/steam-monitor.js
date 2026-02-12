/**
 * SteamMonitor — Connects to the Steam network via PICS protocol and
 * emits events when Dota 2 (AppID 570) receives an update.
 *
 * Uses steam-user with enablePicsCache for real-time changelist monitoring.
 * Supports both anonymous and credential-based login.
 */

import { EventEmitter } from 'node:events';
import SteamUser from 'steam-user';
import logger from './logger.js';
import {
  DOTA2_APP_ID,
  STEAM_ANONYMOUS,
  STEAM_USERNAME,
  STEAM_PASSWORD,
  CHANGELIST_UPDATE_INTERVAL,
} from '../config.js';

export default class SteamMonitor extends EventEmitter {
  /** @type {SteamUser} */
  #client;

  /** Whether the monitor is currently connected */
  #connected = false;

  /** Reconnect attempt counter for exponential backoff */
  #reconnectAttempts = 0;

  /** Maximum reconnect delay in ms (5 minutes) */
  static MAX_RECONNECT_DELAY = 300_000;

  /** Base reconnect delay in ms */
  static BASE_RECONNECT_DELAY = 5_000;

  constructor() {
    super();
    this.#client = new SteamUser({
      enablePicsCache: true,
      changelistUpdateInterval: CHANGELIST_UPDATE_INTERVAL,
      autoRelogin: true,
    });

    this.#setupEventHandlers();
  }

  /**
   * Wire up all Steam client event handlers.
   */
  #setupEventHandlers() {
    // ── Connection lifecycle ────────────────────────────────────────

    this.#client.on('loggedOn', () => {
      this.#connected = true;
      this.#reconnectAttempts = 0;
      logger.steam('Logged into Steam successfully');
      logger.steam(
        STEAM_ANONYMOUS
          ? 'Running in anonymous mode'
          : `Logged in as: ${STEAM_USERNAME}`
      );

      // Prime the PICS cache by requesting Dota 2 info on every login
      logger.steam('Priming PICS cache with Dota 2 app info...');
      this.#client.getProductInfo([DOTA2_APP_ID], [], true).then(() => {
        logger.steam(`PICS cache primed — monitoring Dota 2 (AppID ${DOTA2_APP_ID}) for updates`);
        this.emit('ready');
      }).catch((err) => {
        logger.error(`Failed to prime PICS cache: ${err.message}`);
        // Still emit ready — we can monitor without a primed cache
        this.emit('ready');
      });
    });

    this.#client.on('error', (err) => {
      this.#connected = false;
      logger.error(`Steam client error: ${err.message}`);
      this.#scheduleReconnect();
    });

    this.#client.on('disconnected', (eresult, msg) => {
      this.#connected = false;
      logger.warn(`Disconnected from Steam (EResult ${eresult}): ${msg || 'unknown reason'}`);
      this.#scheduleReconnect();
    });

    // ── PICS events ────────────────────────────────────────────────

    /**
     * Fired when an app already in the PICS cache changes.
     * We filter for Dota 2 and emit our own event with structured data.
     */
    this.#client.on('appUpdate', (appid, data) => {
      if (appid !== DOTA2_APP_ID) return;

      logger.info(`Dota 2 app update detected (AppID ${appid})`);
      this.emit('dota2Update', {
        appid,
        data,
        changenumber: data.changenumber ?? null,
        timestamp: new Date(),
      });
    });

    /**
     * Fired when a new changelist is received.
     * We check if Dota 2 is in the changed apps list.
     */
    this.#client.on('changelist', (changenumber, apps, packages) => {
      if (!apps.includes(DOTA2_APP_ID)) return;

      logger.info(`Changelist #${changenumber} includes Dota 2`);

      // The appUpdate event will fire separately with full data,
      // but we can also request fresh product info immediately.
      this.#fetchProductInfo(changenumber);
    });
  }

  /**
   * Fetch full product info for Dota 2 from Steam.
   * Called when a changelist includes our app but appUpdate hasn't
   * fired yet, or to enrich data from the changelist event.
   * @param {number} changenumber
   */
  async #fetchProductInfo(changenumber) {
    try {
      const result = await this.#client.getProductInfo([DOTA2_APP_ID], [], true);
      const appData = result.apps[DOTA2_APP_ID];

      if (appData) {
        logger.debug(`Got product info for Dota 2 (changenumber: ${appData.changenumber})`);
        this.emit('dota2Update', {
          appid: DOTA2_APP_ID,
          data: appData,
          changenumber: appData.changenumber ?? changenumber,
          timestamp: new Date(),
        });
      }
    } catch (err) {
      logger.error(`Failed to fetch product info: ${err.message}`);
    }
  }

  /**
   * Schedule a reconnection with exponential backoff.
   */
  #scheduleReconnect() {
    const delay = Math.min(
      SteamMonitor.BASE_RECONNECT_DELAY * Math.pow(2, this.#reconnectAttempts),
      SteamMonitor.MAX_RECONNECT_DELAY
    );
    this.#reconnectAttempts++;

    logger.warn(`Reconnecting in ${(delay / 1000).toFixed(0)}s (attempt ${this.#reconnectAttempts})...`);

    setTimeout(() => {
      if (!this.#connected) {
        logger.steam('Attempting reconnection...');
        this.connect();
      }
    }, delay);
  }

  /**
   * Connect to the Steam network.
   * Uses anonymous login unless credentials are provided.
   */
  connect() {
    logger.steam('Connecting to Steam network...');

    if (STEAM_ANONYMOUS) {
      this.#client.logOn({ anonymous: true });
    } else {
      this.#client.logOn({
        accountName: STEAM_USERNAME,
        password: STEAM_PASSWORD,
      });
    }
  }

  /**
   * Gracefully disconnect from Steam.
   */
  disconnect() {
    logger.steam('Disconnecting from Steam...');
    this.#client.logOff();
    this.#connected = false;
  }

  /** Whether we're currently connected to Steam */
  get isConnected() {
    return this.#connected;
  }

  /** Access the underlying PICS cache */
  get picsCache() {
    return this.#client.picsCache;
  }
}
