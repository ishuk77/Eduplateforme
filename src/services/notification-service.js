export function sendNotification(service, input, actorId) {
  const notification = service.createNotification(input, actorId);
  return service.markNotificationSent(notification.id, actorId);
}
