/**
 * Monetisation model: pay-per-Exum credits (one-time purchase, no subscription).
 * Each Executive Summary generation consumes one credit. New accounts get a small
 * free trial so they can experience the output before buying.
 */

/** Free Executive Summary generations per account (lifetime trial, not per month). */
export const FREE_EXUM_LIFETIME = 1;

/** Exum credits granted per paid order when the payload doesn't specify a quantity. */
export const DEFAULT_CREDITS_PER_ORDER = 1;
