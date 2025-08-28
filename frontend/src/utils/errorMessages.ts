// Standardized user-facing error messages for common cases
export function friendlyGuestError(err: unknown): string {
  const e = err as {
    status?: number;
    response?: { status?: number; data?: { message?: string } };
    message?: string;
  } | null;
  const status = e?.status || e?.response?.status;
  const message = e?.message || e?.response?.data?.message;
  if (status === 429) {
    return "You're submitting too fast. Please wait a bit before trying again.";
  }
  if (status === 409 || /duplicate|already registered/i.test(message || "")) {
    return "It looks like this guest is already registered for this event.";
  }
  if (status === 400 && /capacity|full/i.test(message || "")) {
    return "This role is full. Please choose another role.";
  }
  return message || "Something went wrong. Please try again.";
}

export function friendlyGenericError(err: unknown, fallback: string): string {
  const e = err as {
    message?: string;
    response?: { data?: { message?: string } };
  } | null;
  return e?.message || e?.response?.data?.message || fallback;
}
