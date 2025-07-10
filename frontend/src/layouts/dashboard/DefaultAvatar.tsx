// DEPRECATED: This component is no longer used.
// Replaced by gender-specific avatar images and getAvatarUrl utility function.
// This file can be safely deleted.

/*
interface DefaultAvatarProps {
  gender: "male" | "female";
  size?: number;
}

export default function DefaultAvatar({ gender, size = 32 }: DefaultAvatarProps) {
  const bgColor = gender === "male" ? "bg-blue-500" : "bg-pink-500";
  const initial = gender === "male" ? "M" : "F";

  return (
    <div
      className={`${bgColor} text-white rounded-full flex items-center justify-center font-bold`}
      style={{ width: size, height: size, fontSize: size / 2.5 }}
    >
      {initial}
    </div>
  );
}
*/
