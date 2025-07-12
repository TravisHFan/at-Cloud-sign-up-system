import { getBadgeClass, cn } from "../../utils/uiUtils";

export interface BadgeProps {
  variant?: "success" | "error" | "warning" | "info" | "neutral" | "purple";
  children: React.ReactNode;
  className?: string;
}

export default function Badge({
  variant = "neutral",
  children,
  className,
}: BadgeProps) {
  return (
    <span className={cn(getBadgeClass(variant), className)}>{children}</span>
  );
}
