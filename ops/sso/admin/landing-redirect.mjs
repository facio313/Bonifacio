import {
  APPLICATIONS,
  CHIEF_ADMIN_ROLE,
  assignmentFromWireGroups,
} from './lib.mjs';

const APPLICATION_PATHS = new Map(
  APPLICATIONS.map(({ id }) => [id, `/${id}/`]),
);

export function singleApplicationRedirect(rawGroups) {
  if (typeof rawGroups !== 'string' || rawGroups.length === 0) return null;

  let assignment;
  try {
    assignment = assignmentFromWireGroups(rawGroups.split(','));
  } catch {
    return null;
  }

  if (
    assignment.role === CHIEF_ADMIN_ROLE
    || assignment.applications.length !== 1
  ) {
    return null;
  }
  return APPLICATION_PATHS.get(assignment.applications[0]) ?? null;
}

export function landingRedirect(method, pathname, rawGroups) {
  if (method !== 'GET' && method !== 'HEAD') return null;
  if (pathname !== '/' && pathname !== '/index.html') return null;
  return singleApplicationRedirect(rawGroups);
}
