import { Link } from "react-router-dom";

interface GettingStartedStepProps {
  stepNumber: number;
  title: string;
  description: string;
  color: "blue" | "green" | "purple" | "orange";
  to?: string; // optional link target
}

const colorClasses = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
};

export default function GettingStartedStep({
  stepNumber,
  title,
  description,
  color,
  to,
}: GettingStartedStepProps) {
  const content = (
    <div className="flex items-start space-x-3 h-full">
      <div
        className={`w-6 h-6 ${colorClasses[color]} rounded-full flex items-center justify-center flex-shrink-0 mt-1`}
      >
        <span className="text-white text-xs font-bold">{stepNumber}</span>
      </div>
      <div>
        <h4 className="font-medium text-gray-900">{title}</h4>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </div>
  );

  return to ? (
    <Link
      to={to}
      className="block rounded-md p-2 -m-2 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {content}
    </Link>
  ) : (
    content
  );
}
