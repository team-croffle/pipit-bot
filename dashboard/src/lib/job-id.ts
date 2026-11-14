/**
 * A fresh id for a music job, as a version 4 UUID.
 *
 * WHY not `crypto.randomUUID()` alone: browsers offer it only in a secure context
 * (HTTPS or localhost). A dashboard opened as plain HTTP on a private address — a
 * test server reached over a VPN — has no such function, and adding a track failed
 * with "crypto.randomUUID is not a function". `getRandomValues` exists everywhere.
 */
export function newJobId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // Version 4 in the high nibble of byte 6, the RFC 4122 variant in the top bits of byte 8.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
