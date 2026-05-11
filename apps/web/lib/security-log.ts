type SecurityEventType =
  | "auth_fail"
  | "auth_success"
  | "ownership_violation"
  | "rate_limit_hit"
  | "validation_fail";

interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  resource?: string;
  details?: Record<string, unknown>;
}

export function logSecurityEvent(event: SecurityEvent) {
  const payload = { ...event, ts: new Date().toISOString() };
  console.warn(JSON.stringify(payload));
}
