export function extractAuthPayloadFromUrl(url) {
  if (!url) return null;

  const [basePart, fragment = ''] = String(url).split('#');
  const queryIndex = basePart.indexOf('?');
  const query = queryIndex >= 0 ? basePart.substring(queryIndex + 1) : '';
  const queryParams = new URLSearchParams(query);
  const fragmentParams = new URLSearchParams(fragment);

  const access_token = fragmentParams.get('access_token') || queryParams.get('access_token');
  const refresh_token = fragmentParams.get('refresh_token') || queryParams.get('refresh_token');
  const type = fragmentParams.get('type') || queryParams.get('type');
  const mode = fragmentParams.get('mode') || queryParams.get('mode');
  const errorDescription = fragmentParams.get('error_description') || queryParams.get('error_description');

  if (!access_token && !refresh_token && !type && !mode && !errorDescription) {
    return null;
  }

  return {
    access_token,
    refresh_token,
    type,
    mode,
    errorDescription,
  };
}

export default extractAuthPayloadFromUrl;