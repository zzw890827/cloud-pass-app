interface JwksKey {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg: string;
}

interface JwksResponse {
  keys: JwksKey[];
  public_cert: { kid: string; cert: string };
  public_certs: { kid: string; cert: string }[];
}

let cachedKeys: Map<string, CryptoKey> = new Map();
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function fetchPublicKeys(teamDomain: string): Promise<Map<string, CryptoKey>> {
  const now = Date.now();
  if (cachedKeys.size > 0 && now - cacheTimestamp < CACHE_TTL) {
    return cachedKeys;
  }

  const url = `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch CF Access public keys: ${res.status}`);
  }

  const jwks: JwksResponse = await res.json();
  const keys = new Map<string, CryptoKey>();

  for (const key of jwks.keys) {
    if (key.kty !== "RSA") continue;
    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      { kty: key.kty, n: key.n, e: key.e, alg: key.alg },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    keys.set(key.kid, cryptoKey);
  }

  cachedKeys = keys;
  cacheTimestamp = now;
  return keys;
}

function decodeJwtParts(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const header = JSON.parse(new TextDecoder().decode(base64UrlToArrayBuffer(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(base64UrlToArrayBuffer(parts[1])));

  return { header, payload, signatureInput: parts[0] + "." + parts[1], signature: parts[2] };
}

export async function verifyCfAccessJwt(
  token: string,
  teamDomain: string
): Promise<{ email: string }> {
  const { header, payload, signatureInput, signature } = decodeJwtParts(token);

  // Verify expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error("Token expired");
  }

  // Verify issuer
  const expectedIssuer = `https://${teamDomain}.cloudflareaccess.com`;
  if (payload.iss !== expectedIssuer) {
    throw new Error("Invalid issuer");
  }

  // Verify signature
  const keys = await fetchPublicKeys(teamDomain);
  const key = keys.get(header.kid);
  if (!key) {
    // Refresh keys and retry once (key rotation)
    cacheTimestamp = 0;
    const refreshedKeys = await fetchPublicKeys(teamDomain);
    const retryKey = refreshedKeys.get(header.kid);
    if (!retryKey) throw new Error("Unknown signing key");
    await verifySignature(retryKey, signatureInput, signature);
  } else {
    await verifySignature(key, signatureInput, signature);
  }

  if (!payload.email) {
    throw new Error("No email in token");
  }

  return { email: payload.email };
}

async function verifySignature(key: CryptoKey, input: string, signature: string) {
  const data = new TextEncoder().encode(input);
  const sig = base64UrlToArrayBuffer(signature);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, data);
  if (!valid) throw new Error("Invalid signature");
}
