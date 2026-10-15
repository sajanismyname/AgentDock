import dns from 'dns';
import http from 'http';
import https from 'https';
import net from 'net';
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
  static isPrivateIp(rawIp: string): boolean {
    let ip = rawIp.trim().toLowerCase();

    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:10.0.0.1)
    if (ip.startsWith('::ffff:')) {
      ip = ip.replace('::ffff:', '');
    }

    // IPv6 checks
    if (net.isIPv6(ip) || ip.includes(':')) {
      if (
        ip === '::1' ||
        ip === '::' ||
        ip.startsWith('fe80:') || // Link-local
        ip.startsWith('fc00:') || // Unique local
        ip.startsWith('fd00:') || // Unique local
        ip.startsWith('fec0:')    // Site-local (deprecated)
      ) {
        return true;
      }
      return false;
    }

    // IPv4 checks
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return false; // Not standard IPv4
    }

    const [a, b] = parts;

    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;

    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;

    // 10.0.0.0/8 (Private RFC 1918)
    if (a === 10) return true;

    // 172.16.0.0/12 (Private RFC 1918: 172.16.0.0 - 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16 (Private RFC 1918)
    if (a === 192 && b === 168) return true;

    // 169.254.0.0/16 (Link-local & AWS/GCP/Azure Cloud Metadata 169.254.169.254)
    if (a === 169 && b === 254) return true;

    // 100.64.0.0/10 (Carrier-Grade NAT RFC 6598: 100.64.0.0 - 100.127.255.255)
    if (a === 100 && b >= 64 && b <= 127) return true;

    // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET)
    if (a === 192 && b === 0 && parts[2] === 2) return true;
    if (a === 198 && b === 51 && parts[2] === 100) return true;
    if (a === 203 && b === 0 && parts[2] === 113) return true;

    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
    if (a >= 224) return true;

    return false;
  }

  /**
   * Validates target URL against SSRF and DNS rebinding attack vectors.
   */
  static async validateUrl(
    urlString: string,
    allowLocalhostForTest: boolean = process.env.NODE_ENV === 'test'
  ): Promise<void> {
    await this.resolveAndValidateUrl(urlString, allowLocalhostForTest);
  }

  /**
   * Resolves and validates target URL against SSRF and DNS rebinding attack vectors.
   * Returns the validated IP address to pin directly to the socket connection.
   */
  static async resolveAndValidateUrl(
    urlString: string,
    allowLocalhostForTest: boolean = process.env.NODE_ENV === 'test'
  ): Promise<{ parsedUrl: URL; validatedIp: string; ipFamily: 4 | 6 }> {
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

    // In automated testing with mock servers, allow localhost/127.0.0.1 if explicitly enabled
    if (allowLocalhostForTest && (hostname === 'localhost' || hostname === '127.0.0.1')) {
      return {
        parsedUrl: parsed,
        validatedIp: '127.0.0.1',
        ipFamily: 4,
      };
    }

    // Block common internal and cloud metadata hostnames directly
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

    // Check if hostname is an IP literal
    const ipType = net.isIP(hostname);
    if (ipType !== 0) {
      if (this.isPrivateIp(hostname)) {
        throw new BadRequestError(
          `Endpoint resolves to forbidden private or loopback IP address: ${hostname}`
        );
      }
      return {
        parsedUrl: parsed,
        validatedIp: hostname,
        ipFamily: ipType as 4 | 6,
      };
    }

    // Resolve domain name to IP addresses
    let records: dns.LookupAddress[];
    try {
      records = await dns.promises.lookup(hostname, { all: true });
    } catch (err) {
      throw new BadRequestError(`Failed to resolve host ${hostname}: ${(err as Error).message}`);
    }

    if (!records || records.length === 0) {
      throw new BadRequestError(`Host ${hostname} could not be resolved to any IP address`);
    }

    // Verify that ALL resolved IP addresses are safe public IPs (prevent split-horizon / multi-record SSRF)
    for (const record of records) {
      if (this.isPrivateIp(record.address)) {
        throw new BadRequestError(
          `Endpoint resolves to forbidden private or loopback IP address: ${record.address}`
        );
      }
    }

    // Select the first validated IP address to pin to the connection
    const primaryRecord = records[0];
    const ipFamily = (primaryRecord.family === 6 ? 6 : 4) as 4 | 6;

    return {
      parsedUrl: parsed,
      validatedIp: primaryRecord.address,
      ipFamily,
    };
  }

  /**
   * Send a safe POST request to the remote agent endpoint with SSRF protection,
   * DNS rebinding defense (IP pinning), connection timeouts, and response byte limits.
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

    // Resolve and validate destination IP (Anti-SSRF & DNS rebinding check)
    const { parsedUrl, validatedIp, ipFamily } = await this.resolveAndValidateUrl(url);

    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const dataString = JSON.stringify(payload);
    const requestHeaders: http.OutgoingHttpHeaders = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(dataString),
      'User-Agent': 'AgentDock-TestRunner/1.0',
      'Host': parsedUrl.host,
      ...headers,
    };

    // Custom DNS lookup handler that returns the pinned, pre-validated IP address
    // This prevents secondary DNS lookups (TOCTOU / DNS rebinding attacks)
    const pinnedLookup: https.RequestOptions['lookup'] = (
      _lookupHostname,
      opts,
      cb
    ) => {
      const callback = (typeof opts === 'function' ? opts : cb) as (
        err: NodeJS.ErrnoException | null,
        address: string | dns.LookupAddress[],
        family?: number
      ) => void;

      if (!callback) return;

      const isAll = typeof opts === 'object' && opts !== null && Boolean(opts.all);
      if (isAll) {
        callback(null, [{ address: validatedIp, family: ipFamily }]);
      } else {
        callback(null, validatedIp, ipFamily);
      }
    };

    const requestOptions: https.RequestOptions = {
      method: 'POST',
      headers: requestHeaders,
      timeout: this.TIMEOUT_MS,
      lookup: pinnedLookup,
      // For HTTPS connections, retain original hostname for TLS SNI and cert verification
      ...(isHttps
        ? {
            servername: parsedUrl.hostname,
          }
        : {}),
    };

    const startTime = Date.now();

    return new Promise<HttpResponse>((resolve, reject) => {
      let isSettled = false;

      const req = client.request(parsedUrl, requestOptions, (res) => {
        // Handle 3xx Redirects safely with independent SSRF/DNS rebinding validation per hop
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
              reject(
                new Error(
                  `Response exceeded maximum size limit of ${this.MAX_RESPONSE_BYTES} bytes`
                )
              );
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
      });

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
