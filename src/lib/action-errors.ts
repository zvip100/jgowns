/** What a seller sees for any error they cannot fix by changing their input. */
export const GENERIC_ACTION_ERROR = "Something went wrong. Please try again.";

export type PostgrestLikeError = { message: string; code?: string };

/**
 * Postgres codes carry the meaning; the raised text is written for a developer
 * reading logs, so an unmapped code never reaches the seller's screen verbatim.
 */
export function rpcError(
  scope: string,
  error: PostgrestLikeError,
  codeMessages?: Record<string, string>,
): { error: string } {
  const mapped = codeMessages && error.code ? codeMessages[error.code] : undefined;
  if (mapped) return { error: mapped };
  console.error(`[${scope}] database error`, error);
  return { error: GENERIC_ACTION_ERROR };
}
