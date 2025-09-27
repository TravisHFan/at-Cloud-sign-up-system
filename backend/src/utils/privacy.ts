import crypto from "crypto";

/** Hash email with sha256 after trimming & lowercasing (PII minimization). */
export function hashEmail(email: string): string {
  return crypto
    .createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex");
}

/**
 * Truncate an IP address to a coarse CIDR for privacy while allowing pattern detection.
 *  - IPv4: a.b.c.0/24
 *  - IPv6: first 3 hextets ::/48
 */
export function truncateIpToCidr(ip: string | undefined | null): string | null {
  if (!ip) return null;
  const v4Match = ip.match(/(?:(?:\d{1,3}\.){3}\d{1,3})/);
  if (v4Match) {
    const parts = v4Match[0].split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    }
  }
  if (ip.includes(":")) {
    const cleaned = ip.split("%")[0];
    const hextets = cleaned.split(":").filter(Boolean);
    if (hextets.length >= 3) {
      return `${hextets[0]}:${hextets[1]}:${hextets[2]}::/48`;
    }
  }
  return null;
}

export default { hashEmail, truncateIpToCidr };
