import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_VALUE = 'owner-canary-v03';

function secret() {
  return process.env.CHAT_STATE_SECRET || 'sibantu-v03-shadow-development-secret';
}

export function createOptInToken() {
  return createHmac('sha256', secret()).update(COOKIE_VALUE).digest('base64url');
}

export function verifyOptInToken(token?: string) {
  if (!token) return false;
  const expected = Buffer.from(createOptInToken());
  const provided = Buffer.from(token);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
