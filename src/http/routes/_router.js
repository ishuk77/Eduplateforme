export function createRouter() {
  const routes = [];

  return {
    add(method, path, handler) {
      routes.push({ method, path, handler });
    },
    async dispatch(request) {
      const url = new URL(request.url);
      const match = routes.find((route) => route.method === request.method && route.path === url.pathname);
      if (!match) {
        return null;
      }

      return match.handler(request, url);
    }
  };
}
