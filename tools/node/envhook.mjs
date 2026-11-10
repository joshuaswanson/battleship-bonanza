export async function load(url, context, next) {
  const r = await next(url, context);
  if (url.includes('/src/') && r.source) {
    const src = r.source.toString();
    if (src.includes('import.meta.env')) return { ...r, source: src.replaceAll('import.meta.env', "({ BASE_URL: 'http://local/', DEV: false })") };
  }
  return r;
}
