const CARD_ASPECT = 3 / 4;

/**
 * Smallest share of a photo a 3:4 crop may keep before the pipeline letterboxes
 * it instead. Shared by the server pipeline and the photo studio so both make
 * the same call.
 */
export const MIN_COVER_KEEP = 0.85;

/** The pipeline's rule: a 3:4 crop is fine when it keeps at least MIN_COVER_KEEP of the photo. */
export function keepsEnoughForCover(width: number, height: number): boolean {
  const ratio = width / height;
  return Math.min(ratio / CARD_ASPECT, CARD_ASPECT / ratio) >= MIN_COVER_KEEP;
}
