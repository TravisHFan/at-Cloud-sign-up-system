export interface PasswordStrength {
  strength: number;
  label: string;
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { strength: 0, label: "" };

  let strength = 0;
  if (password.length >= 8) strength += 1;
  if (/[a-z]/.test(password)) strength += 1;
  if (/[A-Z]/.test(password)) strength += 1;
  if (/\d/.test(password)) strength += 1;
  if (/[@$!%*?&]/.test(password)) strength += 1;

  const labels = ["Very Weak", "Weak", "Fair", "Good", "Strong"];
  return { strength, label: labels[Math.min(strength - 1, 4)] || "" };
}
