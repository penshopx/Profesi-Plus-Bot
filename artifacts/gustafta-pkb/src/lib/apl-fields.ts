/**
 * APL 01 field list & completeness helpers.
 *
 * The actual definitions live in the shared workspace package
 * `@workspace/apl-fields` so web and mobile always compute the same
 * completeness percentage. This module just re-exports them.
 */

export {
  APL01_FIELDS,
  getMissingAplFields,
  getAplCompleteness,
  type Apl01Field,
  type AplProfileLike,
} from "@workspace/apl-fields";
