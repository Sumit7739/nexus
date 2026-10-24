export const PASSWORD_KEY = 'nexus.local-password.v1';
export const SESSION_UNLOCKED = 'nexus.session-unlocked';
export const SESSION_SPLASH_SHOWN = 'nexus.session-splash.v1';

export const DEFAULT_PBKDF2_ITERATIONS = 180_000;
export const DEFAULT_SPLASH_MS = 900;

export interface PasscodeRecord {
  version?: 1;
  salt: string;
  hash: string;
  iterations?: number;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (n) => n.toString(16).padStart(2, '0')).join('');
}

export function makeSalt(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
}

export async function hashPasscode(
  password: string,
  saltHex: string,
  iterations = DEFAULT_PBKDF2_ITERATIONS
): Promise<string> {
  const pairs = saltHex.match(/.{1,2}/g);
  if (!pairs || pairs.length === 0) {
    throw new Error('Invalid salt');
  }
  const salt = new Uint8Array(pairs.map((h) => parseInt(h, 16)));
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    256
  );
  return toHex(bits);
}

export async function createPasscodeRecord(
  password: string,
  iterations = DEFAULT_PBKDF2_ITERATIONS
): Promise<PasscodeRecord> {
  const salt = makeSalt();
  const hash = await hashPasscode(password, salt, iterations);
  return {
    version: 1,
    salt,
    hash,
    iterations,
  };
}

export async function verifyPasscode(
  password: string,
  record: PasscodeRecord
): Promise<boolean> {
  if (!record || typeof record.salt !== 'string' || typeof record.hash !== 'string') {
    return false;
  }
  const iterations =
    typeof record.iterations === 'number' && record.iterations >= 1000
      ? record.iterations
      : DEFAULT_PBKDF2_ITERATIONS;
  const derived = await hashPasscode(password, record.salt, iterations);
  if (derived.length !== record.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i++) {
    diff |= derived.charCodeAt(i) ^ record.hash.charCodeAt(i);
  }
  return diff === 0;
}

export function isValidPasscodeRecord(value: unknown): value is PasscodeRecord {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PasscodeRecord>;
  return (
    typeof candidate.salt === 'string' &&
    /^[0-9a-f]{16,128}$/i.test(candidate.salt) &&
    candidate.salt.length % 2 === 0 &&
    typeof candidate.hash === 'string' &&
    /^[0-9a-f]{64}$/i.test(candidate.hash)
  );
}

export function readPasscodeRecord(): PasscodeRecord | null {
  try {
    const raw = localStorage.getItem(PASSWORD_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidPasscodeRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function savePasscodeRecord(record: PasscodeRecord): void {
  localStorage.setItem(PASSWORD_KEY, JSON.stringify(record));
}

export function clearPasscodeRecord(): void {
  try {
    localStorage.removeItem(PASSWORD_KEY);
  } catch {
    /* Ignore storage access errors */
  }
  try {
    sessionStorage.removeItem(SESSION_UNLOCKED);
  } catch {
    /* Ignore session storage access errors */
  }
}

export function computeSplashDurationMs(options: {
  prefersReducedMotion: boolean;
  alreadyShownInSession: boolean;
}): number {
  if (options.prefersReducedMotion || options.alreadyShownInSession) {
    return 0;
  }
  return DEFAULT_SPLASH_MS;
}
