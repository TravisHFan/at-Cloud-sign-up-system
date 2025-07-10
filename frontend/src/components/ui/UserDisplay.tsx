import React from "react";

interface StatusBadgeProps {
  status: "success" | "warning" | "error" | "info" | "neutral";
  children: React.ReactNode;
  size?: "sm" | "md";
}

const statusClasses = {
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  error: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
  neutral: "bg-gray-100 text-gray-800",
};

const sizeClasses = {
  sm: "px-2 py-1 text-xs",
  md: "px-2.5 py-1.5 text-sm",
};

export function StatusBadge({
  status,
  children,
  size = "sm",
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${statusClasses[status]} ${sizeClasses[size]}`}
    >
      {children}
    </span>
  );
}

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg" | "xl";
  fallback?: string;
  className?: string;
}

const avatarSizes = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-12 w-12",
};

export function Avatar({
  src,
  alt,
  size = "md",
  fallback,
  className = "",
}: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`rounded-full object-cover ${avatarSizes[size]} ${className}`}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-gray-300 flex items-center justify-center ${avatarSizes[size]} ${className}`}
    >
      <span className="text-gray-600 font-medium text-sm">
        {fallback || alt.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

interface UserInfoProps {
  avatar?: string | null;
  name: string;
  subtitle?: string;
  gender?: "male" | "female";
  avatarSize?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function UserInfo({
  avatar,
  name,
  subtitle,
  gender,
  avatarSize = "md",
  className = "",
}: UserInfoProps) {
  // This would use the avatar utility function
  const avatarSrc =
    avatar ||
    (gender === "male"
      ? "/default-avatar-male.jpg"
      : "/default-avatar-female.jpg");

  return (
    <div className={`flex items-center ${className}`}>
      <Avatar src={avatarSrc} alt={name} size={avatarSize} />
      <div className="ml-3">
        <p className="text-sm font-medium text-gray-900">{name}</p>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}
