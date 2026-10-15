import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { SafeHttpClient } from '../src/utils/safeHttpClient';

describe('Priority 2: DNS Rebinding & SSRF Protection Tests', () => {
  let mockPublicServer: http.Server;
  let mockPublicPort: number;
  let redirectServer: http.Server;
  let redirectPort: number;

  beforeAll(async () => {
    // 1. Mock public server
    mockPublicServer = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(
        JSON.stringify({
          status: 'ok',
          receivedHostHeader: req.headers.host,
        })
      );
    });

    await new Promise<void>((resolve) => {
      mockPublicServer.listen(0, '127.0.0.1', () => {
        const addr = mockPublicServer.address() as { port: number };
        mockPublicPort = addr.port;
        resolve();
      });
    });

    // 2. Mock redirect server attempting SSRF via 302 redirect to metadata
    redirectServer = http.createServer((req, res) => {
      if (req.url === '/redirect-to-metadata') {
        res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' });
        res.end();
      } else if (req.url === '/redirect-to-private') {
        res.writeHead(302, { Location: 'http://192.168.1.1/admin' });
        res.end();
      } else {
        res.writeHead(200);
        res.end(JSON.stringify({ message: 'initial endpoint' }));
      }
    });

    await new Promise<void>((resolve) => {
      redirectServer.listen(0, '127.0.0.1', () => {
        const addr = redirectServer.address() as { port: number };
        redirectPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (mockPublicServer) mockPublicServer.close();
    if (redirectServer) redirectServer.close();
  });

  describe('1. Comprehensive Private / Restricted IP Classification', () => {
    it('should identify all loopback IP ranges as private', () => {
      expect(SafeHttpClient.isPrivateIp('127.0.0.1')).toBe(true);
      expect(SafeHttpClient.isPrivateIp('127.0.0.254')).toBe(true);
      expect(SafeHttpClient.isPrivateIp('127.255.255.255')).toBe(true);
      expect(SafeHttpClient.isPrivateIp('::1')).toBe(true);
      expect(SafeHttpClient.isPrivateIp('0.0.0.0')).toBe(true);
    });

    it('should identify RFC 1918 private IPv4 ranges as private', () => {
      // 10.0.0.0/8
      expect(SafeHttpClient.isPrivateIp('10.0.0.1')).toBe(true);
      expect(SafeHttpClient.isPrivateIp('10.255.255.255')).toBe(true);

      // 172.16.0.0/12
      expect(SafeHttpClient.isPrivateIp('172.16.0.1')).toBe(true);
      expect(SafeHttpClient.isPrivateIp('172.24.10.5')).toBe(true);
      expect(SafeHttpClient.isPrivateIp('172.31.255.255')).toBe(true);
      // 172.32.0.1 is public
      expect(SafeHttpClient.isPrivateIp('172.32.0.1')).toBe(false);

      // 192.168.0.0/16
      expect(SafeHttpClient.isPrivateIp('192.168.0.1')).toBe(true);
      expect(SafeHttpClient.isPrivateIp('192.168.254.254')).toBe(true);
    });

    it('should identify cloud metadata and link-local addresses as private', () => {
      expect(SafeHttpClient.isPrivateIp('169.254.169.254')).toBe(true);
      expect(SafeHttpClient.isPrivateIp('169.254.1.1')).toBe(true);
      expect(SafeHttpClient.isPrivateIp('fe80::1')).toBe(true);
    });

    it('should identify carrier-grade NAT (100.64.0.0/10) as private', () => {
      expect(SafeHttpClient.isPrivateIp('100.64.0.1')).toBe(true);
      expect(SafeHttpClient.isPrivateIp('100.100.50.1')).toBe(true);
      expect(SafeHttpClient.isPrivateIp('100.127.255.255')).toBe(true);
      // 100.128.0.1 is public
      expect(SafeHttpClient.isPrivateIp('100.128.0.1')).toBe(false);
    });

    it('should identify IPv4-mapped IPv6 addresses as private', () => {
      expect(SafeHttpClient.isPrivateIp('::ffff:127.0.0.1')).toBe(true);
      expect(SafeHttpClient.isPrivateIp('::ffff:10.0.0.5')).toBe(true);
      expect(SafeHttpClient.isPrivateIp('::ffff:169.254.169.254')).toBe(true);
    });

    it('should identify public IP addresses as safe', () => {
      expect(SafeHttpClient.isPrivateIp('8.8.8.8')).toBe(false);
      expect(SafeHttpClient.isPrivateIp('1.1.1.1')).toBe(false);
      expect(SafeHttpClient.isPrivateIp('93.184.216.34')).toBe(false);
      expect(SafeHttpClient.isPrivateIp('104.244.42.1')).toBe(false);
    });
  });

  describe('2. URL Resolution & Anti-SSRF Validation', () => {
    it('should reject non-HTTP/HTTPS protocols', async () => {
      await expect(SafeHttpClient.resolveAndValidateUrl('ftp://example.com/agent')).rejects.toThrow(
        'Only HTTP and HTTPS endpoints are permitted'
      );
      await expect(SafeHttpClient.resolveAndValidateUrl('file:///etc/passwd')).rejects.toThrow(
        'Only HTTP and HTTPS endpoints are permitted'
      );
      await expect(SafeHttpClient.resolveAndValidateUrl('gopher://127.0.0.1:70/')).rejects.toThrow(
        'Only HTTP and HTTPS endpoints are permitted'
      );
    });

    it('should reject internal cloud metadata hostnames directly', async () => {
      await expect(
        SafeHttpClient.resolveAndValidateUrl('http://metadata.google.internal/computeMetadata/v1/', false)
      ).rejects.toThrow('Requests to internal host');

      await expect(
        SafeHttpClient.resolveAndValidateUrl('http://instance-data/latest/meta-data/', false)
      ).rejects.toThrow('Requests to internal host');

      await expect(
        SafeHttpClient.resolveAndValidateUrl('http://internal.local/', false)
      ).rejects.toThrow('Requests to internal host');
    });

    it('should reject private IP literals directly without DNS lookup', async () => {
      await expect(
        SafeHttpClient.resolveAndValidateUrl('http://169.254.169.254/latest/meta-data/', false)
      ).rejects.toThrow('Endpoint resolves to forbidden private or loopback IP address');

      await expect(
        SafeHttpClient.resolveAndValidateUrl('http://10.0.0.1:8080/agent', false)
      ).rejects.toThrow('Endpoint resolves to forbidden private or loopback IP address');

      await expect(
        SafeHttpClient.resolveAndValidateUrl('http://192.168.1.1:3000/agent', false)
      ).rejects.toThrow('Endpoint resolves to forbidden private or loopback IP address');
    });

    it('should successfully resolve and pin valid public hostnames', async () => {
      const result = await SafeHttpClient.resolveAndValidateUrl('http://example.com/api');
      expect(result.parsedUrl.hostname).toBe('example.com');
      expect(result.validatedIp).toBeDefined();
      expect(SafeHttpClient.isPrivateIp(result.validatedIp)).toBe(false);
      expect([4, 6]).toContain(result.ipFamily);
    });
  });

  describe('3. DNS Rebinding Defense (IP Pinning & Host Header Preservation)', () => {
    it('should pin the validated IP to the socket and preserve Host header', async () => {
      const response = await SafeHttpClient.post(
        `http://127.0.0.1:${mockPublicPort}/test`,
        { test: 'ping' },
        {},
        0
      );

      expect(response.status).toBe(200);
      const data = response.data as { status: string; receivedHostHeader: string };
      expect(data.status).toBe('ok');
      expect(data.receivedHostHeader).toBe(`127.0.0.1:${mockPublicPort}`);
    });

    it('should reject redirect attempts to cloud metadata endpoints', async () => {
      await expect(
        SafeHttpClient.post(`http://127.0.0.1:${redirectPort}/redirect-to-metadata`, { data: 'test' })
      ).rejects.toThrow(/forbidden private or loopback IP address/);
    });

    it('should reject redirect attempts to private subnet IP addresses', async () => {
      await expect(
        SafeHttpClient.post(`http://127.0.0.1:${redirectPort}/redirect-to-private`, { data: 'test' })
      ).rejects.toThrow(/forbidden private or loopback IP address/);
    });
  });
});
