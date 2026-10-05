/**
 * Turn any error into one short, friendly sentence for the user.
 *
 * Only uses the server's message when it looks like a plain sentence.
 * Technical text (like "Request failed with status code 500", error codes,
 * JSON or stack traces) is replaced by the fallback.
 */
const TECHNICAL = /(status code|axios|network error|timeout of|econn|enotfound|undefined|\[object|<html|^\s*[\[{]|[A-Z_]{6,}$|stack|exception|prisma|sql|at \S+\.(ts|js):)/i;

function looksFriendly(text: unknown): text is string {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  if (t.length < 3 || t.length > 160) return false;
  return !TECHNICAL.test(t);
}

export function getErrorMessage(err: any, fallback = 'Something went wrong. Please try again.'): string {
  const status = err?.response?.status;
  if (!err?.response && (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error')) {
    return 'No internet connection. Please check it and try again.';
  }
  if (err?.code === 'ECONNABORTED') {
    return 'This is taking too long. Please try again.';
  }

  const data = err?.response?.data;
  const fromServer = data?.message ?? (typeof data?.error === 'string' ? data.error : undefined);
  if (looksFriendly(fromServer)) return fromServer.trim();

  if (status === 401) return 'Please sign in again.';
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find that.";
  if (status === 429) return 'Too many tries. Please wait a moment and try again.';

  // Errors thrown by our own code with a friendly message
  if (!err?.response && looksFriendly(err?.message)) return err.message.trim();

  return fallback;
}
