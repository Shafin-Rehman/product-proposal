/**
 * Intentionally broken sample for testing PR-Agent /review and /improve.
 * Do not import from app code.
 */

// Bug: `items` is never defined — will throw at runtime.
function totalAmount() {
  return items.reduce((sum, x) => sum + x.amount, 0)
}

// Bug: user-controlled string concatenated into a query-like string (injection footgun).
function buildUserFilter(userId) {
  return "SELECT * FROM orders WHERE user_id = " + userId
}

// Bug: async without await; caller may get a Promise when expecting a value.
export async function loadProfile(id) {
  return fetch("/api/profile/" + id).then((r) => r.json())
}

export { totalAmount, buildUserFilter }
