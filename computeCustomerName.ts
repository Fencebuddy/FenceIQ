/**
 * computeCustomerName.js — Single source of truth for customer name resolution
 * Deterministic fallback chain ensures no null/empty customerName values
 */

export function safeText(v) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
}

export function isPlaceholderCustomerName(v) {
  const s = safeText(v);
  if (!s) return false;
  // "Customer for J-2026-0002" legacy placeholder pattern
  if (/^customer\s+for\s+j-/i.test(s)) return true;
  return false;
}

export function computeCustomerName(payloadOrRecord) {
  // Tier 1: Direct customerName (ignore placeholders as if missing)
  const direct = safeText(payloadOrRecord?.customerName);
  if (direct && !isPlaceholderCustomerName(direct)) return direct;

  // Tier 2: firstName + lastName
  const first = safeText(payloadOrRecord?.firstName);
  const last = safeText(payloadOrRecord?.lastName);
  const fullName = safeText([first, last].filter(Boolean).join(" "));
  if (fullName) return fullName;

  // Tier 3: Email
  const email = safeText(payloadOrRecord?.email);
  if (email) return email;

  // Tier 4: Phone
  const phone = safeText(payloadOrRecord?.phone);
  if (phone) return phone;

  // Tier 5: Fallback (never null, enables safe downstream logic)
  return "Unknown Customer";
}