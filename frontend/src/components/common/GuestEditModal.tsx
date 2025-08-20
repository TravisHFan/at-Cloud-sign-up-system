import { useEffect, useState } from "react";

interface GuestEditModalProps {
  isOpen: boolean;
  title?: string;
  initialName?: string;
  initialPhone?: string;
  onClose: () => void;
  onSave: (values: {
    fullName?: string;
    phone?: string;
  }) => void | Promise<void>;
  isSaving?: boolean;
}

export default function GuestEditModal({
  isOpen,
  title = "Edit Guest",
  initialName = "",
  initialPhone = "",
  onClose,
  onSave,
  isSaving = false,
}: GuestEditModalProps) {
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);

  useEffect(() => {
    if (isOpen) {
      setFullName(initialName ?? "");
      setPhone(initialPhone ?? "");
    }
  }, [isOpen, initialName, initialPhone]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      fullName: fullName.trim() || undefined,
      phone: phone.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">{title}</h2>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="guest-fullname"
                className="block text-sm font-medium text-gray-700"
              >
                Full name
              </label>
              <input
                id="guest-fullname"
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Leave blank to keep"
              />
            </div>

            <div>
              <label
                htmlFor="guest-phone"
                className="block text-sm font-medium text-gray-700"
              >
                Phone
              </label>
              <input
                id="guest-phone"
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Leave blank to keep"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
