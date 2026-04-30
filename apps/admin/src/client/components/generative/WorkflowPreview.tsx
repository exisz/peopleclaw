/**
 * PLANET-1385: Workflow Preview — generative UI component.
 * Visual pipeline of workflow steps.
 */

interface WorkflowStep {
  name: string;
  type: string; // human | agent
  description: string;
  tools?: string[];
}

interface WorkflowPreviewProps {
  name: string;
  description: string;
  steps: WorkflowStep[];
}

export function WorkflowPreview({ name, description, steps }: WorkflowPreviewProps) {
  return (
    <div className="p-6 h-full overflow-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold">{name}</h2>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>

      {/* Pipeline */}
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            {/* Connector line */}
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                  step.type === 'human'
                    ? 'bg-blue-500'
                    : 'bg-green-500'
                }`}
              >
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className="w-px h-6 bg-border mt-1" />
              )}
            </div>

            {/* Step card */}
            <div className="flex-1 rounded-lg border p-3 bg-card">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">{step.name}</h4>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    step.type === 'human'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-green-500/20 text-green-400'
                  }`}
                >
                  {step.type}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
              {step.tools && step.tools.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {step.tools.map((tool) => (
                    <span key={tool} className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">
                      {tool}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 flex gap-4 text-xs text-muted-foreground">
        <span>📋 {steps.length} steps</span>
        <span>🤖 {steps.filter((s) => s.type === 'agent').length} agent</span>
        <span>👤 {steps.filter((s) => s.type === 'human').length} human</span>
      </div>
    </div>
  );
}
