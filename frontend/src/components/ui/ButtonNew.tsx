import { forwardRef, type ButtonHTMLAttributes } from "react";
import { getButtonClass, cn } from "../../utils/uiUtils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "success"
    | "danger"
    | "warning"
    | "link"
    | "outline";
  size?: "small" | "medium" | "large";
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "medium",
      loading = false,
      leftIcon,
      rightIcon,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={cn(
          getButtonClass(variant, size),
          loading && "opacity-50 cursor-not-allowed",
          isDisabled && "opacity-50 cursor-not-allowed",
          className
        )}
        disabled={isDisabled}
        {...props}
      >
        {loading ? (
          <div className="flex items-center justify-center space-x-2">
            <svg
              className="animate-spin h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Loading...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center space-x-2">
            {leftIcon && <span>{leftIcon}</span>}
            {children && <span>{children}</span>}
            {rightIcon && <span>{rightIcon}</span>}
          </div>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
