import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

export interface UsernameRequirement {
  id: string;
  label: string;
  met: boolean;
  required?: boolean;
}

function evaluateUsername(username: string): UsernameRequirement[] {
  const v = (username || "").trim();
  const isLower = v === v.toLowerCase();
  const startLetter = /^[a-z]/.test(v);
  const allowed = /^[a-z0-9_]*$/.test(v);
  const lenOk = v.length >= 3 && v.length <= 20;
  const noDoubleUnderscore = !/__/.test(v);
  const noEdgeUnderscore = !/^_|_$/.test(v);

  return [
    { id: "len", label: "3–20 characters", met: lenOk, required: true },
    {
      id: "charset",
      label: "lowercase letters, numbers, and underscore only",
      met: isLower && allowed,
      required: true,
    },
    {
      id: "start",
      label: "starts with a letter",
      met: startLetter,
      required: true,
    },
    {
      id: "noDouble",
      label: "no consecutive underscores",
      met: noDoubleUnderscore,
      required: true,
    },
    {
      id: "noEdge",
      label: "no underscore at start or end",
      met: noEdgeUnderscore,
      required: true,
    },
  ];
}

interface Props {
  username: string;
  showTitle?: boolean;
  title?: string;
  className?: string;
}

export default function UsernameRequirements({
  username,
  showTitle = true,
  title = "Username Requirements",
  className = "",
}: Props) {
  const reqs = evaluateUsername(username);

  return (
    <div
      className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${className}`}
    >
      {showTitle && (
        <h4 className="text-sm font-medium text-gray-900 mb-3">{title}</h4>
      )}

      <ul className="space-y-2">
        {reqs.map((r) => (
          <li key={r.id} className="flex items-center space-x-2">
            {r.met ? (
              <CheckIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
            ) : (
              <XMarkIcon
                className={`w-4 h-4 flex-shrink-0 ${
                  r.required ? "text-gray-400" : "text-blue-400"
                }`}
              />
            )}
            <span
              className={`text-sm ${
                r.met
                  ? "text-green-700"
                  : r.required
                  ? "text-gray-600"
                  : "text-blue-600"
              }`}
            >
              {r.label}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Usernames are case-insensitive and must meet all required rules.
        </p>
      </div>
    </div>
  );
}
