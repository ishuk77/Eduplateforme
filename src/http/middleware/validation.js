export function parsePagination(url) {
  return {
    limit: Number(url.searchParams.get('limit') ?? 25),
    offset: Number(url.searchParams.get('offset') ?? 0)
  };
}

export async function parseJson(request) {
  const text = await request.text();
  if (!text) {
    return {};
  }

  return JSON.parse(text);
}
