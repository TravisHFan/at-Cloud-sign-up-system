import GettingStartedStep from "./GettingStartedStep";
import { gettingStartedSteps } from "../../config/gettingStartedConfig";

export default function GettingStartedSection() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Getting Started with @Cloud
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {gettingStartedSteps.map((step) => (
          <GettingStartedStep
            key={step.stepNumber}
            stepNumber={step.stepNumber}
            title={step.title}
            description={step.description}
            color={step.color}
          />
        ))}
      </div>
    </div>
  );
}
