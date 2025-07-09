import { useCurrentTime } from "../hooks/useCurrentTime";

export default function WelcomeHeader() {
  const { greeting, formattedDate } = useCurrentTime();

  return (
    <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
      <h1 className="text-3xl font-bold mb-2">
        {greeting}, Welcome to @Cloud Events!
      </h1>
      <p className="text-blue-100 mb-4">{formattedDate}</p>
      <p className="text-lg">
        Welcome to @Cloud Marketplace Ministry Events Management System. Here
        you can create or join events, connect with the community, and grow your
        ministry and career.
      </p>
    </div>
  );
}
