const extractAuthPayloadFromUrl = require('../../services/supabase/AuthCallbackPayload').default;

describe('extractAuthPayloadFromUrl', () => {
  it('reads auth tokens from the URL fragment', () => {
    const payload = extractAuthPayloadFromUrl(
      'betweenus://auth-callback#access_token=token-1&refresh_token=refresh-1&type=magiclink'
    );

    expect(payload).toEqual({
      access_token: 'token-1',
      refresh_token: 'refresh-1',
      type: 'magiclink',
      mode: null,
      errorDescription: null,
    });
  });

  it('reads recovery data from query parameters', () => {
    const payload = extractAuthPayloadFromUrl(
      'betweenus://auth-callback?type=recovery&mode=reset&error_description=Expired%20link'
    );

    expect(payload).toEqual({
      access_token: null,
      refresh_token: null,
      type: 'recovery',
      mode: 'reset',
      errorDescription: 'Expired link',
    });
  });

  it('returns null when the callback URL has no auth payload', () => {
    expect(extractAuthPayloadFromUrl('betweenus://auth-callback')).toBeNull();
  });
});