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

  let label = "";
  let color = "";

  switch (score) {
    case 0:
    case 1:
      label = "Very Weak";
      color = "bg-red-500";
      break;
    case 2:
      label = "Weak";
      color = "bg-orange-500";
      break;
    case 3:
      label = "Fair";
      color = "bg-yellow-500";
      break;
    case 4:
      label = "Good";
      color = "bg-blue-500";
      break;
    case 5:
    case 6:
      label = "Strong";
      color = "bg-green-500";
      break;
    default:
      label = "";
      color = "bg-gray-300";
  }

  return { score, label, color };
}

export function getPasswordStrengthWidth(score: number): string {
  return `${Math.min((score / 6) * 100, 100)}%`;
}
