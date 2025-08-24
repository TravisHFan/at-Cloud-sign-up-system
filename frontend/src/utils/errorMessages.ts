// Standardized user-facing error messages for common cases
export function friendlyGuestError(err: any): string {
  const status = err?.status || err?.response?.status;
  const message = err?.message || err?.response?.data?.message;
  if (status === 429) {
    return "You're submitting too fast. Please wait a bit before trying again.";
  }
  if (status === 409 || /duplicate|already registered/i.test(message)) {
    return "It looks like this guest is already registered for this event.";
  }
  if (status === 400 && /capacity|full/i.test(message)) {
    return "This role is full. Please choose another role.";
  }
  return message || "Something went wrong. Please try again.";
}

export function friendlyGenericError(err: any, fallback: string) {
  return err?.message || err?.response?.data?.message || fallback;
}
