import React, { useState } from "react";
import GuestApi, { type GuestSignupPayload } from "../../services/guestApi";

interface Props {
  eventId: string;
  roleId: string;
  onSuccess?: (data: any) => void;
}

export const GuestRegistrationForm: React.FC<Props> = ({
  eventId,
  roleId,
  onSuccess,
}) => {
  const [form, setForm] = useState<GuestSignupPayload>({
    roleId,
    fullName: "",
    email: "",
    gender: undefined,
    phone: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update =
    (k: keyof GuestSignupPayload) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [k]: e.target.value as any }));
    };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await GuestApi.signup(eventId, form);
      onSuccess?.(data);
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      if (status === 429) {
        setError(
          "You're submitting too fast. Please wait a bit before trying again."
        );
      } else if (
        status === 409 ||
        /duplicate|already registered/i.test(err?.message)
      ) {
        setError(
          "It looks like this guest is already registered for this event."
        );
      } else if (status === 400 && /capacity|full/i.test(err?.message)) {
        setError("This role is full. Please choose another role.");
      } else {
        setError(err?.message || "Registration failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div>
        <label className="block text-sm" htmlFor="guest-fullname">
          Full name
        </label>
        <input
          id="guest-fullname"
          className="input"
          value={form.fullName}
          onChange={update("fullName")}
          required
        />
      </div>
      <div>
        <label className="block text-sm" htmlFor="guest-gender">
          Gender
        </label>
        <select
          id="guest-gender"
          className="input"
          value={form.gender || ""}
          onChange={update("gender")}
        >
          <option value="">Prefer not to say</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </div>
      <div>
        <label className="block text-sm" htmlFor="guest-email">
          Email
        </label>
        <input
          id="guest-email"
          type="email"
          className="input"
          value={form.email}
          onChange={update("email")}
          required
        />
      </div>
      <div>
        <label className="block text-sm" htmlFor="guest-phone">
          Phone
        </label>
        <input
          id="guest-phone"
          className="input"
          value={form.phone || ""}
          onChange={update("phone")}
        />
      </div>
      <div>
        <label className="block text-sm" htmlFor="guest-notes">
          Notes
        </label>
        <input
          id="guest-notes"
          className="input"
          value={form.notes || ""}
          onChange={update("notes")}
        />
      </div>
      <button type="submit" className="btn" disabled={submitting}>
        {submitting ? "Submitting..." : "Join as Guest"}
      </button>
    </form>
  );
};

export default GuestRegistrationForm;
