import { rewriteCodersUrl } from './routing';
import type { IncomingMessage } from 'node:http';

describe('Coders fixed endpoint routing', () => {
  const original = process.env.CODERS_MODE;
  beforeEach(() => {
    process.env.CODERS_MODE = 'true';
  });
  afterAll(() => {
    if (original === undefined) delete process.env.CODERS_MODE;
    else process.env.CODERS_MODE = original;
  });
  const rewrite = (url: string) => rewriteCodersUrl({ url } as IncomingMessage);

  it('preserves a document route and its encoded query', () => {
    expect(
      rewrite(
        '/bridge?target=' +
          encodeURIComponent('/api/files/123/한글.txt?download=true'),
      ),
    ).toBe('/api/files/123/%ED%95%9C%EA%B8%80.txt?download=true');
  });
  it.each([
    'https://evil.example/api/users/me',
    '//evil.example/api/users/me',
    '/api/../../admin',
    '/api/..\\admin',
    '/api/users/me#fragment',
  ])('refuses a target outside the API: %s', (target) => {
    expect(rewrite('/bridge?target=' + encodeURIComponent(target))).toBe(
      '/api/coders-invalid-route',
    );
  });
  it('refuses ambiguous targets', () => {
    expect(rewrite('/bridge?target=/api/users/me&target=/api/pages/info')).toBe(
      '/api/coders-invalid-route',
    );
  });
  it('leaves native routes unchanged outside Coders mode', () => {
    process.env.CODERS_MODE = 'false';
    expect(rewrite('/bridge?target=/api/users/me')).toBe(
      '/bridge?target=/api/users/me',
    );
  });
});
