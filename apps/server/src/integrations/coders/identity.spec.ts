import { codersIdentity } from './identity.service';

describe('verified Coders identity', () => {
  it('requires both injected identifiers', () => {
    expect(() => codersIdentity({ 'coders-user-id': 'u1' })).toThrow();
    expect(() =>
      codersIdentity({
        'coders-resource-id': 'r1',
        'coders-resource-role': 'owner',
      }),
    ).toThrow();
    expect(() => codersIdentity({ cookie: 'authToken=old-session' })).toThrow();
  });
  it('refuses duplicate or malformed identity headers', () => {
    expect(() =>
      codersIdentity({
        'coders-user-id': ['u1', 'u2'],
        'coders-resource-id': 'r1',
        'coders-resource-role': 'owner',
      }),
    ).toThrow();
    expect(() =>
      codersIdentity({
        'coders-user-id': 'u1\r\nX-Test: spoofed',
        'coders-resource-id': 'r1',
        'coders-resource-role': 'owner',
      }),
    ).toThrow();
  });
  it('refuses missing and noncanonical roles', () => {
    for (const role of [undefined, 'admin', 'OWNER', ['owner', 'member']]) {
      expect(() =>
        codersIdentity({
          'coders-user-id': 'u1',
          'coders-resource-id': 'r1',
          'coders-resource-role': role,
        }),
      ).toThrow();
    }
  });
  it('accepts opaque Core identifiers without deriving identity from email', () => {
    expect(
      codersIdentity({
        'coders-user-id': 'oidc:user-1',
        'coders-resource-id': 'resource-2',
        'coders-resource-role': 'member',
      }),
    ).toEqual({
      userId: 'oidc:user-1',
      resourceId: 'resource-2',
      role: 'member',
    });
  });
});
