export function taskStop(reason, details = {}) {
  throw { taskBoundary: true, reason, ...details };
}
