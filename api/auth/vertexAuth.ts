/**
 * Vertex AI Authentication Module for Cloudflare Workers
 *
 * Implements custom JWT-based authentication using Web Crypto API
 * since standard Google auth libraries don't work in Workers environment.
 */

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

// Token cache (in-memory, will reset on Worker restart)
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Get access token for Vertex AI API
 * Implements token caching with 58-minute TTL
 */
export async function getAccessToken(env: { GOOGLE_SERVICE_ACCOUNT_JSON: string }): Promise<string> {
  // Check if we have a valid cached token
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && tokenExpiry > now + 120) { // 2-minute buffer
    return cachedToken;
  }

  // Parse service account
  const serviceAccount: ServiceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);

  // Generate JWT
  const jwt = await createJWT(serviceAccount);

  // Exchange JWT for access token
  const tokenResponse = await exchangeJWTForToken(jwt);

  // Cache the token (expires_in is in seconds, usually 3600)
  cachedToken = tokenResponse.access_token;
  tokenExpiry = now + tokenResponse.expires_in - 120; // Cache for 58 minutes

  return cachedToken;
}

/**
 * Create a signed JWT for Google OAuth 2.0
 */
async function createJWT(serviceAccount: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // JWT header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  // JWT payload (claims)
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600, // 1 hour
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  };

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Sign the token
  const signature = await signRS256(unsignedToken, serviceAccount.private_key);
  const encodedSignature = base64UrlEncode(signature);

  return `${unsignedToken}.${encodedSignature}`;
}

/**
 * Sign data using RS256 algorithm with Web Crypto API
 */
async function signRS256(data: string, privateKeyPem: string): Promise<ArrayBuffer> {
  // Extract the key content from PEM format
  const pemContents = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  // Decode base64 to binary
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  // Import the private key
  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  // Sign the data
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    dataBuffer
  );

  return signature;
}

/**
 * Exchange JWT for OAuth access token
 */
async function exchangeJWTForToken(jwt: string): Promise<TokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange JWT for token: ${response.status} ${error}`);
  }

  const tokenData: TokenResponse = await response.json();
  return tokenData;
}

/**
 * Base64 URL encode (without padding)
 */
function base64UrlEncode(data: string | ArrayBuffer): string {
  let base64: string;

  if (typeof data === 'string') {
    base64 = btoa(data);
  } else {
    // Convert ArrayBuffer to base64
    const bytes = new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }

  // Convert to URL-safe base64
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
