import https from 'https';
import dns from 'dns';
import net from 'net';

/**
 * SSRF-safe image downloader.
 * - https only, default port only
 * - host must be on the allow list (our own Cloudinary cloud / S3 bucket / backend host)
 * - every resolved IP is checked (private, loopback, link-local, etc. are blocked),
 *   and the check happens inside the socket lookup so DNS rebinding cannot bypass it
 * - redirects are never followed
 * - hard size cap and timeout
 */

export class SafeFetchError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('::ffff:')) return isPrivateIp(lower.slice(7));
    return (
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe8') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb') ||
      lower.startsWith('ff')
    );
  }
  return true; // not a valid IP: treat as unsafe
}

/** Hosts we are willing to download user-supplied image URLs from. */
export function getAllowedImageHosts(): { hosts: Set<string>; cloudinaryPrefix: string | null } {
  const hosts = new Set<string>();
  let cloudinaryPrefix: string | null = null;
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (cloud) {
    hosts.add('res.cloudinary.com');
    cloudinaryPrefix = `/${cloud}/`;
  }
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  const region = process.env.AWS_REGION;
  if (bucket) {
    if (region) hosts.add(`${bucket}.s3.${region}.amazonaws.com`);
    hosts.add(`${bucket}.s3.amazonaws.com`);
  }
  if (process.env.BACKEND_URL) {
    try {
      const u = new URL(process.env.BACKEND_URL);
      if (u.protocol === 'https:') hosts.add(u.hostname.toLowerCase());
    } catch {
      /* ignore */
    }
  }
  return { hosts, cloudinaryPrefix };
}

export function assertAllowedImageUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError('BAD_URL', 'Invalid image URL');
  }
  if (url.protocol !== 'https:') throw new SafeFetchError('BAD_URL', 'Image URL must use https');
  if (url.username || url.password) throw new SafeFetchError('BAD_URL', 'Image URL must not contain credentials');
  if (url.port && url.port !== '443') throw new SafeFetchError('BAD_URL', 'Image URL port not allowed');
  const host = url.hostname.toLowerCase();
  if (net.isIP(host)) throw new SafeFetchError('BAD_URL', 'IP address hosts are not allowed');
  const { hosts, cloudinaryPrefix } = getAllowedImageHosts();
  if (!hosts.has(host)) throw new SafeFetchError('HOST_NOT_ALLOWED', 'Image host is not allowed');
  if (host === 'res.cloudinary.com' && cloudinaryPrefix && !url.pathname.startsWith(cloudinaryPrefix)) {
    throw new SafeFetchError('HOST_NOT_ALLOWED', 'Image host is not allowed');
  }
  return url;
}

const safeLookup: any = (hostname: string, options: any, callback: any) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses: any) => {
    if (err) return callback(err);
    const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: 4 }];
    for (const a of list) {
      if (isPrivateIp(a.address)) {
        return callback(new SafeFetchError('PRIVATE_IP', 'Blocked address'));
      }
    }
    if (options && options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
};

export async function fetchImageSafely(
  rawUrl: string,
  opts: { maxBytes?: number; timeoutMs?: number } = {}
): Promise<Buffer> {
  const maxBytes = opts.maxBytes ?? 10 * 1024 * 1024;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const url = assertAllowedImageUrl(rawUrl);

  return new Promise<Buffer>((resolve, reject) => {
    const req = https.get(
      url,
      { lookup: safeLookup, timeout: timeoutMs, headers: { Accept: 'image/*', 'User-Agent': 'kaphor-backend' } },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return reject(new SafeFetchError('REDIRECT', 'Redirects are not allowed'));
        }
        if (status !== 200) {
          res.resume();
          return reject(new SafeFetchError('UPSTREAM', `Image fetch failed (${status})`));
        }
        const type = String(res.headers['content-type'] || '').toLowerCase();
        if (!type.startsWith('image/')) {
          res.resume();
          return reject(new SafeFetchError('NOT_IMAGE', 'URL did not return an image'));
        }
        const declared = Number(res.headers['content-length'] || 0);
        if (declared > maxBytes) {
          res.resume();
          return reject(new SafeFetchError('TOO_LARGE', 'Image is too large'));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size > maxBytes) {
            req.destroy(new SafeFetchError('TOO_LARGE', 'Image is too large'));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(new SafeFetchError('TIMEOUT', 'Image fetch timed out')));
    req.on('error', (e) =>
      reject(e instanceof SafeFetchError ? e : new SafeFetchError('FETCH_FAILED', 'Image fetch failed'))
    );
  });
}
