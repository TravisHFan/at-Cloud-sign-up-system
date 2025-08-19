import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import GuestApi from "../services/guestApi";

export default function GuestManage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guest, setGuest] = useState<any | null>(null);
  const [form, setForm] = useState<{
    fullName?: string;
    phone?: string;
    notes?: string;
  }>({});
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      setError(null);
      setLoading(true);
      try {
        const data = await GuestApi.getByToken(token);
        setGuest(data?.guest || null);
        setForm({
          fullName: data?.guest?.fullName || "",
          phone: data?.guest?.phone || "",
          notes: data?.guest?.notes || "",
        });
      } catch (e: any) {
        setError(e?.message || "Invalid or expired link");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const update = (k: keyof typeof form) => (e: any) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e: any) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const data = await GuestApi.updateByToken(token, form);
      setGuest(data);
    } catch (e: any) {
      setError(e?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    if (!token) return;
    if (!confirm("Are you sure you want to cancel your registration?")) return;
    setCancelling(true);
    setError(null);
    try {
      await GuestApi.cancelByToken(token);
      navigate("/guest/confirmation", { replace: true });
    } catch (e: any) {
      setError(e?.message || "Cancellation failed");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!guest) return <div className="p-6">Registration not found.</div>;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6">
        <h1 className="text-2xl font-bold">Manage Your Registration</h1>
        <div className="bg-gray-50 p-4 rounded border">
          <div className="text-sm text-gray-700">
            <div>
              <span className="font-medium">Event:</span>{" "}
              {guest?.eventSnapshot?.title}
            </div>
            <div>
              <span className="font-medium">Role:</span>{" "}
              {guest?.eventSnapshot?.roleName}
            </div>
            <div>
              <span className="font-medium">Status:</span> {guest?.status}
            </div>
          </div>
        </div>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="block text-sm">Full name</label>
            <input
              className="input"
              value={form.fullName || ""}
              onChange={update("fullName")}
            />
          </div>
          <div>
            <label className="block text-sm">Phone</label>
            <input
              className="input"
              value={form.phone || ""}
              onChange={update("phone")}
            />
          </div>
          <div>
            <label className="block text-sm">Notes</label>
            <input
              className="input"
              value={form.notes || ""}
              onChange={update("notes")}
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn">
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={cancelling}
              className="btn btn-danger"
            >
              {cancelling ? "Cancelling…" : "Cancel Registration"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
