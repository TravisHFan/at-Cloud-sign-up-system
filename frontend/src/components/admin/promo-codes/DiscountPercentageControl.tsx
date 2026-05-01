import { useId } from "react";

interface DiscountPercentageControlProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  accent?: "purple" | "blue";
}

const accentStyles = {
  purple: {
    text: "text-purple-600",
    rgb: "147, 51, 234",
  },
  blue: {
    text: "text-blue-600",
    rgb: "37, 99, 235",
  },
};

export default function DiscountPercentageControl({
  value,
  onChange,
  min = 10,
  max = 100,
  step = 5,
  accent = "purple",
}: DiscountPercentageControlProps) {
  const inputId = useId();
  const styles = accentStyles[accent];
  const progress = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-base font-medium text-gray-700 mb-2"
      >
        Discount Percentage <span className="text-red-500">*</span>
      </label>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className={`text-2xl font-bold ${styles.text}`}>{value}%</span>
          <span className="text-sm text-gray-500">
            User will pay {100 - value}%
          </span>
        </div>
        <input
          id={inputId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, rgb(${styles.rgb}) 0%, rgb(${styles.rgb}) ${progress}%, rgb(229, 231, 235) ${progress}%, rgb(229, 231, 235) 100%)`,
          }}
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>{min}% (Minimum)</span>
          <span>{max}% (Maximum)</span>
        </div>
      </div>
    </div>
  );
}
