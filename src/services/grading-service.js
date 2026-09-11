export function registerGrade(service, input, actorId) {
  return service.recordGrade(input, actorId);
}

export function configureGrading(service, input, actorId) {
  return service.configureGradingSystem(input, actorId);
}
