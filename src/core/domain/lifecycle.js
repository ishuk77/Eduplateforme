export function createLifecycleRecord({ id, status, at, actor, reason = null }) {
  return {
    id,
    status,
    at,
    actor,
    reason
  };
}

export function appendLifecycleRecord(history, record) {
  return [...history, record];
}

export function closeLifecycleRecord(record, endedAt) {
  return {
    ...record,
    endedAt
  };
}
