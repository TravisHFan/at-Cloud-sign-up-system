export interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: "", color: "bg-gray-300" };
  }

  let score = 0;

  // Length check
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;

  // Character type checks
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[@$!%*?&]/.test(password)) score++;

  const labels = ["Very Weak", "Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"];

  return {
    score,
    label: labels[Math.min(score - 1, 4)] || "",
    color: colors[Math.min(score - 1, 4)] || "bg-gray-300",
  };
}

export function getPasswordStrengthWidth(score: number): string {
  return `${Math.min((score / 6) * 100, 100)}%`;
}
