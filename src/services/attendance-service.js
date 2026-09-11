export function registerAttendance(service, input, actorId) {
  return service.recordAttendance(input, actorId);
}

export function attendanceRate(service, input) {
  return service.getAttendanceRate(input);
}
