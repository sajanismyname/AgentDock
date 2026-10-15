export class SecretRedactor {
  private static readonly PATTERNS = [
    // OpenAI, Anthropic, generic API keys
    /sk-[a-zA-Z0-9_-]{20,}/g,
    /key-[a-zA-Z0-9_-]{20,}/g,
    /api[_-]?key[\s:=]+["']?([a-zA-Z0-9_.-]{16,})["']?/gi,
    // Bearer / JWT tokens
    /Bearer\s+([a-zA-Z0-9-_.]+\.[a-zA-Z0-9-_.]+\.[a-zA-Z0-9-_.]+)/gi,
    /Bearer\s+([a-zA-Z0-9-_.]{20,})/gi,
    // AWS credentials
    /AKIA[0-9A-Z]{16}/g,
    // Generic passwords in JSON/key-value pairs
    /("?password"?\s*:\s*)"([^"]+)"/gi,
    /("?secret"?\s*:\s*)"([^"]+)"/gi,
  ];

  /**
   * Redacts sensitive secrets from a string.
   */
  static redact(text: string): string {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let result = text;
    for (const pattern of this.PATTERNS) {
      result = result.replace(pattern, (match) => {
        if (match.toLowerCase().startsWith('bearer ')) {
          return 'Bearer [REDACTED]';
        }
        return '[REDACTED]';
      });
    }

    return result;
  }

  /**
   * Recursively redacts secrets in arbitrary objects/arrays before passing to external evaluators.
   */
  static redactObject<T>(input: T): T {
    if (typeof input === 'string') {
      return this.redact(input) as unknown as T;
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.redactObject(item)) as unknown as T;
    }

    if (input !== null && typeof input === 'object') {
      const copy: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        if (['password', 'secret', 'credential', 'token', 'authorization'].includes(key.toLowerCase())) {
          copy[key] = '[REDACTED]';
        } else {
          copy[key] = this.redactObject(value);
        }
      }
      return copy as unknown as T;
    }

    return input;
  }
}
