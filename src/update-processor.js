/**
 * UpdateProcessor — Extracts meaningful fields from raw PICS update data,
 * manages state persistence, and deduplicates notifications.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import logger from './logger.js';
import { STATE_FILE, DOTA2_APP_ID } from '../config.js';

export default class UpdateProcessor {
  /** @type {number|null} Last processed changenumber */
  #lastChangenumber = null;

  constructor() {
    this.#loadState();
  }

  // ── State Persistence ──────────────────────────────────────────────

  /**
   * Load the last known changenumber from state.json.
   */
  #loadState() {
    try {
      if (existsSync(STATE_FILE)) {
        const raw = readFileSync(STATE_FILE, 'utf-8');
        const state = JSON.parse(raw);
        this.#lastChangenumber = state.lastChangenumber ?? null;
        logger.info(`Loaded state: last changenumber = ${this.#lastChangenumber}`);
      } else {
        logger.info('No previous state found — will process all incoming updates');
      }
    } catch (err) {
      logger.warn(`Failed to load state file: ${err.message}`);
      this.#lastChangenumber = null;
    }
  }

  /**
   * Save the current changenumber to state.json.
   * @param {number} changenumber
   */
  #saveState(changenumber) {
    try {
      const state = {
        lastChangenumber: changenumber,
        lastUpdated: new Date().toISOString(),
        appId: DOTA2_APP_ID,
      };
      writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
      logger.debug(`State saved: changenumber = ${changenumber}`);
    } catch (err) {
      logger.error(`Failed to save state: ${err.message}`);
    }
  }

  // ── Update Processing ──────────────────────────────────────────────

  /**
   * Process a raw PICS update event. Returns null if the update
   * is a duplicate (already processed).
   *
   * @param {object} updateEvent - The raw event from SteamMonitor
   * @param {number} updateEvent.appid
   * @param {object} updateEvent.data - PICS product info
   * @param {number|null} updateEvent.changenumber
   * @param {Date} updateEvent.timestamp
   * @returns {object|null} Processed update data, or null if duplicate
   */
  process(updateEvent) {
    const { data, changenumber, timestamp } = updateEvent;

    // ── Deduplication ────────────────────────────────────────────
    if (changenumber && this.#lastChangenumber !== null) {
      if (changenumber <= this.#lastChangenumber) {
        logger.debug(`Skipping duplicate changenumber ${changenumber} (last: ${this.#lastChangenumber})`);
        return null;
      }
    }

    // ── Extract app info ─────────────────────────────────────────
    const appinfo = data?.appinfo ?? data ?? {};
    const common = appinfo?.common ?? {};
    const depots = appinfo?.depots ?? {};

    // Build ID and branch info
    const branches = depots?.branches ?? {};
    const publicBranch = branches?.public ?? {};
    const buildId = publicBranch?.buildid ?? null;
    const timeUpdated = publicBranch?.timeupdated ?? null;

    // Changed depots (depot IDs that have manifests)
    const changedDepots = this.#extractChangedDepots(depots);

    // App name
    const appName = common?.name ?? 'Dota 2';

    // Construct the processed update
    const processed = {
      appId: DOTA2_APP_ID,
      appName,
      changenumber: changenumber ?? data?.changenumber ?? 'Unknown',
      buildId,
      timeUpdated: timeUpdated ? new Date(timeUpdated * 1000) : timestamp,
      timestamp,
      branches: this.#extractBranches(branches),
      changedDepots,
      depotCount: changedDepots.length,
      raw: {
        missingToken: data?.missingToken ?? false,
      },
    };

    // ── Persist state ────────────────────────────────────────────
    if (changenumber) {
      this.#lastChangenumber = changenumber;
      this.#saveState(changenumber);
    }

    logger.info(`Processed update: changelist #${processed.changenumber}, build ${processed.buildId ?? 'unknown'}, ${processed.depotCount} depot(s)`);

    return processed;
  }

  /**
   * Extract changed depot IDs from the depots object.
   * Filters out non-depot keys (branches, maxsize, etc.)
   * @param {object} depots
   * @returns {Array<{id: string, name: string|null, maxsize: string|null}>}
   */
  #extractChangedDepots(depots) {
    const nonDepotKeys = new Set(['branches', 'maxsize', 'depotfromapp', 'baselanguages']);
    const result = [];

    for (const [key, value] of Object.entries(depots)) {
      if (nonDepotKeys.has(key) || typeof value !== 'object') continue;

      // Depot IDs are numeric strings
      if (/^\d+$/.test(key)) {
        result.push({
          id: key,
          name: value?.name ?? null,
          maxsize: value?.maxsize ?? null,
        });
      }
    }

    return result;
  }

  /**
   * Extract branch info (name, buildid, timeupdated).
   * @param {object} branches
   * @returns {Array<{name: string, buildId: string|null, timeUpdated: Date|null}>}
   */
  #extractBranches(branches) {
    return Object.entries(branches).map(([name, info]) => ({
      name,
      buildId: info?.buildid ?? null,
      timeUpdated: info?.timeupdated
        ? new Date(info.timeupdated * 1000)
        : null,
    }));
  }

  /**
   * Build a formatted "Changed" summary string for the embed.
   * @param {object} update - Processed update from process()
   * @returns {string}
   */
  static formatChangeSummary(update) {
    const parts = [];

    if (update.depotCount > 0) {
      const depotIds = update.changedDepots
        .map((d) => d.id)
        .join(', ');
      parts.push(`Depots (${depotIds})`);
    }

    const publicBranch = update.branches.find((b) => b.name === 'public');
    if (publicBranch?.buildId) {
      parts.push(`public, build ${publicBranch.buildId}`);
    }

    if (parts.length === 0) {
      parts.push('App info updated');
    }

    return parts.join(' — ');
  }

  /** Get the last processed changenumber */
  get lastChangenumber() {
    return this.#lastChangenumber;
  }
}
