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
  isActive?: boolean;
}

export default function ComponentTabContent({ component, runState, onRun, defaultTab, isActive = true }: Props) {
  // PLANET-1541: only mount ComponentDetail (and its sub-tab buttons / testids)
  // when this tab is active. Otherwise keepalive panels duplicate testids like
  // `detail-sub-tab-run` across multiple open component tabs and break Playwright
  // strict-mode locator queries. Run-state lives in the parent hook so it survives.
  return (
    <div data-testid={`component-tab-content-${component.id}`} className="h-full">
      {isActive ? (
        <ComponentDetail
          component={component}
          runState={runState}
          onRun={onRun}
          defaultTab={defaultTab}
        />
      ) : null}
    </div>
  );
}
