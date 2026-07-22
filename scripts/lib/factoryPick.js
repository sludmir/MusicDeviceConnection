/**
 * Pick up to N open backlog items for a weekly factory run.
 * Balances personas when possible.
 */

const { STATUS } = require('./catalogGapAnalysis');

const DEFAULT_PERSONAS = ['guitar-rig', 'studio-producer', 'accessible-dj'];

/**
 * @param {object[]} items - backlog items from latest.json
 * @param {object} opts
 * @param {number} [opts.limit=15]
 * @param {string[]} [opts.personas]
 * @param {Set<string>} [opts.excludeIds]
 */
function pickWeeklyBatch(items, {
  limit = 15,
  personas = DEFAULT_PERSONAS,
  excludeIds = new Set(),
} = {}) {
  const open = (items || [])
    .filter((i) => i && i.status !== STATUS.LIVE && i.status !== 'rejected')
    .filter((i) => !excludeIds.has(i.id))
    .filter((i) => i.status !== 'staged_pending_approval')
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0) || a.name.localeCompare(b.name));

  const picked = [];
  const used = new Set();

  // Round-robin one from each persona first
  let progress = true;
  while (picked.length < limit && progress) {
    progress = false;
    for (const persona of personas) {
      if (picked.length >= limit) break;
      const next = open.find(
        (i) => !used.has(i.id) && (i.personas || []).includes(persona)
      );
      if (next) {
        picked.push(next);
        used.add(next.id);
        progress = true;
      }
    }
  }

  // Fill remaining by score
  for (const item of open) {
    if (picked.length >= limit) break;
    if (used.has(item.id)) continue;
    picked.push(item);
    used.add(item.id);
  }

  return picked;
}

module.exports = {
  DEFAULT_PERSONAS,
  pickWeeklyBatch,
};
