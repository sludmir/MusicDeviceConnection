/** Shared commerce / affiliate constants for Node scripts. */

const ZZOUNDS_AFFILIATE_ID = process.env.ZZOUNDS_AFFILIATE_ID || '3998299';

const MONETIZED_RETAILERS = new Set(['amazon', 'cj', 'awin', 'thomann', 'impact']);

const ALLOWED_PURCHASE_HOSTS = [
  /(^|\.)amazon\.[a-z.]{2,}$/i,
  /(^|\.)(zzounds|guitarcenter|musiciansfriend)\.com$/i,
  /(^|\.)reverb\.com$/i,
  /(^|\.)thomann\.[a-z.]{2,}$/i,
  /(^|\.)sweetwater\.com$/i,
  /(^|\.)teile\.life$/i,
  /(^|\.)telepathicinstruments\.com$/i,
];

const PROPOSAL_ALLOWED_UPDATE_FIELDS = new Set([
  'purchaseUrl',
  'affiliateUrl',
  'commerceStatus',
  'commerceRetailer',
  'commerceAvailability',
  'commerceValidatedAt',
  'commerceValidationReason',
]);

const COMMERCE_STATUSES = new Set(['monetized', 'non_monetized', 'unknown']);
const COMMERCE_AVAILABILITY = new Set(['in_stock', 'out_of_stock', 'discontinued', 'unknown']);

module.exports = {
  ZZOUNDS_AFFILIATE_ID,
  MONETIZED_RETAILERS,
  ALLOWED_PURCHASE_HOSTS,
  PROPOSAL_ALLOWED_UPDATE_FIELDS,
  COMMERCE_STATUSES,
  COMMERCE_AVAILABILITY,
};
