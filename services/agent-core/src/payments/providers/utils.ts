export function encodeBase64(value: string): string {
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(value);
  }

  const nodeBuffer = (globalThis as Record<string, any>).Buffer;
  if (nodeBuffer) {
    return nodeBuffer.from(value, 'utf-8').toString('base64');
  }

  throw new Error('Base64 encoding is not supported in this runtime');
}
