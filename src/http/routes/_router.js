function matchRoute(routePath, pathname) {
  const routeSegments = routePath.split('/').filter(Boolean);
  const pathSegments = pathname.split('/').filter(Boolean);
  if (routeSegments.length !== pathSegments.length) {
    return null;
  }

  const params = {};
  for (let index = 0; index < routeSegments.length; index += 1) {
    const routeSegment = routeSegments[index];
    const pathSegment = pathSegments[index];
    if (routeSegment.startsWith(':')) {
      params[routeSegment.slice(1)] = decodeURIComponent(pathSegment);
      continue;
    }
    if (routeSegment !== pathSegment) {
      return null;
    }
  }

  return params;
}

export function createRouter() {
  const routes = [];

  return {
    add(method, path, handler) {
      routes.push({ method, path, handler });
    },
    async dispatch(request) {
      const url = new URL(request.url);
      for (const route of routes) {
        if (route.method !== request.method) {
          continue;
        }
        const params = matchRoute(route.path, url.pathname);
        if (params) {
          return route.handler(request, url, params);
        }
      }
      return null;
    }
  };
}
