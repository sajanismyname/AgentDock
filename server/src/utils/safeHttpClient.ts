import dns from 'dns';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import { BadRequestError } from '../errors/AppError';

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  data: unknown;
  durationMs: number;
}

export class SafeHttpClient {
  private static readonly TIMEOUT_MS = 30000; // 30 seconds limit
  private static readonly MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB limit
  private static readonly MAX_REDIRECTS = 3;

  /**
   * Check if an IPv4 or IPv6 address is private, loopback, link-local, or cloud metadata.
   */
  static isPrivateIp(ip: string): boolean {
    // IPv6 loopback and link-local/private
    if (ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:')) {
      return true;
    }

    // IPv4-mapped IPv6
    if (ip.startsWith('::ffff:')) {
      ip = ip.replace('::ffff:', '');
    }

    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return false; // Not a standard IPv4
    }

    const [a, b] = parts;

    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;

    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;

    // 10.0.0.0/8 (Private)
    if (a === 10) return true;

    // 172.16.0.0/12 (Private)
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16 (Private)
    if (a === 192 && b === 168) return true;

    // 169.254.0.0/16 (Link-local & AWS/GCP/Azure Cloud metadata)
    if (a === 169 && b === 254) return true;

    // 100.64.0.0/10 (Carrier-grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;

    return false;
  }

  /**
   * Validates target URL against SSRF attack vectors.
   * Resolves hostname and verifies that IP address is not private or loopback.
   */
  static async validateUrl(urlString: string, allowLocalhostForTest: boolean = process.env.NODE_ENV === 'test'): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(urlString);
    } catch {
      throw new BadRequestError('Invalid URL format');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestError('Only HTTP and HTTPS endpoints are permitted');
    }

    const hostname = parsed.hostname.toLowerCase();

    // In automated testing with mock servers, allow localhost
    if (allowLocalhostForTest && (hostname === 'localhost' || hostname === '127.0.0.1')) {
      return;
    }

    // Block common internal/cloud metadata hostnames directly
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname === 'metadata.google.internal' ||
      hostname === 'instance-data'
    ) {
      throw new BadRequestError(`Requests to internal host ${hostname} are forbidden`);
    }

    // Resolve hostname to IP
    try {
      const records = await dns.promises.lookup(hostname, { all: true });
      for (const record of records) {
        if (this.isPrivateIp(record.address)) {
          throw new BadRequestError(
            `Endpoint resolves to forbidden private or loopback IP address: ${record.address}`
          );
        }
      }
    } catch (err) {
      if (err instanceof BadRequestError) throw err;
      throw new BadRequestError(`Failed to resolve host ${hostname}: ${(err as Error).message}`);
    }
  }

  /**
   * Send a safe POST request to the remote agent endpoint with SSRF check, timeouts, and byte limits.
   */
  static async post(
    url: string,
    payload: unknown,
    headers: Record<string, string> = {},
    redirectCount: number = 0
  ): Promise<HttpResponse> {
    if (redirectCount > this.MAX_REDIRECTS) {
      throw new Error('Maximum redirect limit reached');
    }

    // SSRF validation before request (and before following each redirect)
    await this.validateUrl(url);

    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const dataString = JSON.stringify(payload);
    const requestHeaders: http.OutgoingHttpHeaders = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(dataString),
      'User-Agent': 'AgentDock-TestRunner/1.0',
      ...headers,
    };

    const startTime = Date.now();

    return new Promise<HttpResponse>((resolve, reject) => {
      let isSettled = false;

      const req = client.request(
        parsedUrl,
        {
          method: 'POST',
          headers: requestHeaders,
          timeout: this.TIMEOUT_MS,
        },
        (res) => {
          // Handle 3xx Redirects safely
          if (
            res.statusCode &&
            [301, 302, 307, 308].includes(res.statusCode) &&
            res.headers.location
          ) {
            req.destroy();
            const redirectUrl = new URL(res.headers.location, url).toString();
            resolve(this.post(redirectUrl, payload, headers, redirectCount + 1));
            return;
          }

          let responseData = '';
          let byteCount = 0;

          res.setEncoding('utf8');

          res.on('data', (chunk: string) => {
            byteCount += Buffer.byteLength(chunk);
            if (byteCount > this.MAX_RESPONSE_BYTES) {
              req.destroy();
              if (!isSettled) {
                isSettled = true;
                reject(new Error(`Response exceeded maximum size limit of ${this.MAX_RESPONSE_BYTES} bytes`));
              }
              return;
            }
            responseData += chunk;
          });

          res.on('end', () => {
            if (isSettled) return;
            isSettled = true;

            let parsedBody: unknown;
            try {
              parsedBody = JSON.parse(responseData);
            } catch {
              parsedBody = responseData;
            }

            const durationMs = Date.now() - startTime;
            const resHeaders: Record<string, string> = {};
            for (const [k, v] of Object.entries(res.headers)) {
              if (v) resHeaders[k] = Array.isArray(v) ? v.join(', ') : v;
            }

            resolve({
              status: res.statusCode || 200,
              headers: resHeaders,
              data: parsedBody,
              durationMs,
            });
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        if (!isSettled) {
          isSettled = true;
          reject(new Error(`Request timed out after ${this.TIMEOUT_MS}ms`));
        }
      });

      req.on('error', (err) => {
        if (!isSettled) {
          isSettled = true;
          reject(new Error(`Agent request failed: ${err.message}`));
        }
      });

      req.write(dataString);
      req.end();
    });
  }
}
