interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
}

export default function StepIndicator({
  currentStep,
  totalSteps,
  labels,
}: StepIndicatorProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <div className="flex items-center justify-center w-full max-w-2xl mx-auto">
      {steps.map((step, index) => {
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;

        return (
          <div key={step} className="flex items-center">
            {/* 步骤圆点 */}
            <div className="flex flex-col items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold border-2 transition-colors ${
                  isCompleted
                    ? "bg-lw-accent border-lw-accent text-white"
                    : isCurrent
                    ? "bg-lw-accent border-lw-accent text-white"
                    : "bg-white border-gray-300 text-gray-400"
                }`}
              >
                {isCompleted ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  step
                )}
              </div>
              {/* 步骤标签 */}
              {labels && labels[step - 1] && (
                <span
                  className={`mt-2 text-xs whitespace-nowrap ${
                    isCurrent || isCompleted
                      ? "text-lw-accent font-medium"
                      : "text-gray-400"
                  }`}
                >
                  {labels[step - 1]}
                </span>
              )}
            </div>
            {/* 连接线 */}
            {index < steps.length - 1 && (
              <div
                className={`w-16 sm:w-24 h-0.5 mx-1 transition-colors ${
                  step < currentStep ? "bg-lw-accent" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
