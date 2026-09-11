export function createInvoice(service, input, actorId) {
  return service.createInvoice(input, actorId);
}

export function recordPayment(service, input, actorId) {
  return service.recordPayment(input, actorId);
}
