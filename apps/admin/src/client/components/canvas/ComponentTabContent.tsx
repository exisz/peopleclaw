/**
 * PLANET-1468: Wrapper that renders ComponentDetail inside an IDE-style tab.
 * Pulled out of the old right-side sticky detail panel.
 */
import ComponentDetail from './ComponentDetail';
import type { RunState } from './useComponentRun';

interface Component {
  id: string;
  name: string;
  type: string;
  runtime?: string;
  isExported?: boolean;
}

interface Props {
  component: Component;
  runState: RunState;
  onRun: () => void;
  defaultTab?: 'flow' | 'preview';
}

export default function ComponentTabContent({ component, runState, onRun, defaultTab }: Props) {
  return (
    <div data-testid={`component-tab-content-${component.id}`} className="h-full">
      <ComponentDetail
        component={component}
        runState={runState}
        onRun={onRun}
        defaultTab={defaultTab}
      />
    </div>
  );
}
