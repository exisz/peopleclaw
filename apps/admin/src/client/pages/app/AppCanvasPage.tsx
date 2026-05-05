/**
 * PLANET-1407: Living SaaS — Canvas page.
 *
 * For this first slice, the Canvas page embeds the legacy `AppPlaceholder`
 * dual-pane experience so the rich xyflow + IDE-tab functionality (and all
 * existing E2E test ids) keep working unchanged. Future tickets can split
 * the canvas surface from chat.
 */
import AppPlaceholder from '../AppPlaceholder';

export default function AppCanvasPage() {
  return (
    <div data-testid="page-app-canvas" className="h-full">
      <AppPlaceholder />
    </div>
  );
}
