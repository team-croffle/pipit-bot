import type { OidcConfig } from '../env-auth.js';

/**
 * The OIDC provider's discovery document, fetched by the bot before Better Auth is built
 * with the provider.
 *
 * WHY here and not left to Better Auth: its OIDC plugin discovers once, when the
 * instance is built, and leaves the provider out if that fails — sign-in through it would
 * then stay broken until a restart. The bot discovers first, answers a sign-in with 502
 * while the provider cannot be reached (as it always has), and builds the instance with
 * the provider once discovery works.
 */

export interface DiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  end_session_endpoint?: string;
}

/** The provider could not be reached or gave no usable document. */
export class OidcDiscoveryError extends Error {
  public constructor(issuer: string, cause: unknown) {
    super(`OIDC discovery failed for ${issuer}`, { cause });
    this.name = 'OidcDiscoveryError';
  }
}

/** The innermost message of an error chain, e.g. `getaddrinfo ENOTFOUND host`. */
export function describeErrorCause(error: unknown): string {
  let current: unknown = error;
  let message = current instanceof Error ? current.message : String(current);
  while (current instanceof Error && current.cause !== undefined) {
    current = current.cause;
    message = current instanceof Error ? current.message : String(current);
  }

  return message;
}

let cached: DiscoveryDocument | undefined;

export function discoveryUrl(oidc: OidcConfig): string {
  return new URL('.well-known/openid-configuration', oidc.issuer).href;
}

/** A failed discovery is not cached, so the next sign-in tries the provider again. */
export async function discover(oidc: OidcConfig): Promise<DiscoveryDocument> {
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(discoveryUrl(oidc), { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const document = (await response.json()) as DiscoveryDocument;
    if (!document.authorization_endpoint || !document.token_endpoint) {
      throw new Error('the document has no authorization or token endpoint');
    }

    cached = document;
    return document;
  } catch (error) {
    throw new OidcDiscoveryError(oidc.issuer, error);
  }
}

export function getDiscovered(): DiscoveryDocument | undefined {
  return cached;
}

/** Forgets the document — for local checks only. */
export function resetDiscoveryForChecks(): void {
  cached = undefined;
}
