const {
  PROPOSAL_ALLOWED_UPDATE_FIELDS,
  COMMERCE_STATUSES,
  COMMERCE_AVAILABILITY,
} = require('./commerceConstants');
const { isAllowedPurchaseHost } = require('./commerceUrl');

const PROPOSAL_VERSION = 1;

function validateProposal(proposal) {
  const errors = [];
  if (!proposal || typeof proposal !== 'object') {
    return { valid: false, errors: ['Proposal must be an object'] };
  }
  if (proposal.version !== PROPOSAL_VERSION) {
    errors.push(`Unsupported proposal version: ${proposal.version}`);
  }
  if (!proposal.generatedAt || typeof proposal.generatedAt !== 'string') {
    errors.push('generatedAt is required (ISO string)');
  }
  if (!proposal.runId || typeof proposal.runId !== 'string') {
    errors.push('runId is required');
  }
  if (!Array.isArray(proposal.changes)) {
    errors.push('changes must be an array');
    return { valid: false, errors };
  }

  proposal.changes.forEach((change, index) => {
    const prefix = `changes[${index}]`;
    if (!change?.productId || typeof change.productId !== 'string') {
      errors.push(`${prefix}.productId is required`);
    }
    if (!change?.updates || typeof change.updates !== 'object') {
      errors.push(`${prefix}.updates is required`);
      return;
    }
    for (const key of Object.keys(change.updates)) {
      if (!PROPOSAL_ALLOWED_UPDATE_FIELDS.has(key)) {
        errors.push(`${prefix}.updates.${key} is not an allowed field`);
      }
    }
    const { updates } = change;
    if (updates.commerceStatus && !COMMERCE_STATUSES.has(updates.commerceStatus)) {
      errors.push(`${prefix}.updates.commerceStatus is invalid`);
    }
    if (updates.commerceAvailability && !COMMERCE_AVAILABILITY.has(updates.commerceAvailability)) {
      errors.push(`${prefix}.updates.commerceAvailability is invalid`);
    }
    for (const urlField of ['purchaseUrl', 'affiliateUrl']) {
      if (!updates[urlField]) continue;
      try {
        const host = new URL(updates[urlField]).hostname;
        if (!isAllowedPurchaseHost(host)) {
          errors.push(`${prefix}.updates.${urlField} host not allowed: ${host}`);
        }
      } catch {
        errors.push(`${prefix}.updates.${urlField} is not a valid URL`);
      }
    }
  });

  return { valid: errors.length === 0, errors };
}

module.exports = {
  PROPOSAL_VERSION,
  validateProposal,
};
