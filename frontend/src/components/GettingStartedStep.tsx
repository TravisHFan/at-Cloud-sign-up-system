interface GettingStartedStepProps {
  stepNumber: number;
  title: string;
  description: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

const colorClasses = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
};

export default function GettingStartedStep({ 
  stepNumber, 
  title, 
  description, 
  color 
}: GettingStartedStepProps) {
  return (
    <div className="flex items-start space-x-3 h-full">
      <div className={`w-6 h-6 ${colorClasses[color]} rounded-full flex items-center justify-center flex-shrink-0 mt-1`}>
        <span className="text-white text-xs font-bold">{stepNumber}</span>
      </div>
      <div>
        <h4 className="font-medium text-gray-900">{title}</h4>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </div>
  );
}