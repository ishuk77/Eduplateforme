import { makeCrudHandlers } from './_helpers.js';

export function registerVirtualSchoolRoutes(router, { service }) {
  const schoolHandlers = makeCrudHandlers({
    service, resource: 'virtualSchools',
    create: (body, actorId) => service.createVirtualSchool(body, actorId),
    readPermission: 'virtual-schools.read', writePermission: 'virtual-schools.write'
  });
  const trainingHandlers = makeCrudHandlers({
    service, resource: 'paidTrainings',
    create: (body, actorId) => service.createPaidTraining(body, actorId),
    readPermission: 'virtual-schools.read', writePermission: 'virtual-schools.write'
  });
  for (const [path, handlers] of [['/virtual-schools/trainings', trainingHandlers], ['/virtual-schools', schoolHandlers]]) {
    router.add('POST', path, handlers.create);
    router.add('GET', path, handlers.list);
    router.add('GET', `${path}/:id`, handlers.get);
    router.add('PUT', `${path}/:id`, handlers.update);
    router.add('DELETE', `${path}/:id`, handlers.remove);
    router.add('GET', `${path}/:id/history`, handlers.history);
  }
}
