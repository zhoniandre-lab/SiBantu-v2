import { createHash } from 'node:crypto';

export function canaryBucket(sessionId: string) {
  const digest = createHash('sha256').update(sessionId || 'anonymous').digest();
  return digest.readUInt32BE(0) % 100;
}

export function shouldUseCanary(sessionId: string, percentage: number) {
  const safePercentage = Math.max(0, Math.min(100, Math.floor(percentage)));
  return canaryBucket(sessionId) < safePercentage;
}
