import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** When true, shows a compact inline error instead of full-page overlay */
  inline?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
  resetKey: number;
}

const MAX_AUTO_RETRIES = 3;
const AUTO_RETRY_DELAY_MS = 500;

/**
 * PLANET-1051 + PLANET-1260: ErrorBoundary with auto-recovery and scoped rendering.
 * - Auto-retries any error up to MAX_AUTO_RETRIES times
 * - Logs full error details for debugging
 * - Tracks error fingerprint to avoid infinite retry loops
 * - Uses resetKey to force remount children on recovery
 */
export class ErrorBoundary extends Component<Props, State> {
  private _lastErrorFingerprint = '';
  private _retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary] FULL ERROR:', error.message, error.stack);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);

    const fingerprint = `${error.message}::${error.stack?.slice(0, 200) ?? ''}`;
    const isSameError = fingerprint === this._lastErrorFingerprint;
    const retryCount = isSameError ? this.state.retryCount + 1 : 1;
    this._lastErrorFingerprint = fingerprint;

    if (retryCount <= MAX_AUTO_RETRIES) {
      console.warn(`[ErrorBoundary] Auto-recovering (attempt ${retryCount}/${MAX_AUTO_RETRIES})...`);
      if (this._retryTimer) clearTimeout(this._retryTimer);
      this._retryTimer = setTimeout(() => {
        this.setState(prev => ({
          hasError: false,
          error: null,
          retryCount,
          resetKey: prev.resetKey + 1,
        }));
      }, AUTO_RETRY_DELAY_MS);
    } else {
      console.error(`[ErrorBoundary] Max auto-retries (${MAX_AUTO_RETRIES}) exceeded, showing error UI`);
      this.setState({ retryCount });
    }
  }

  componentWillUnmount() {
    if (this._retryTimer) clearTimeout(this._retryTimer);
  }

  private handleManualRetry = () => {
    this._lastErrorFingerprint = '';
    this.setState(prev => ({
      hasError: false,
      error: null,
      retryCount: 0,
      resetKey: prev.resetKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      // Inline (scoped) error — compact, does not take over the whole page
      if (this.props.inline) {
        return (
          <div className="flex flex-col items-center justify-center p-4 text-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-xs text-muted-foreground max-w-xs break-words">
              {this.state.error?.message ?? '未知错误'}
            </p>
            <Button variant="outline" size="sm" onClick={this.handleManualRetry}>
              重试
            </Button>
          </div>
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <Card className="w-full max-w-lg border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                页面加载出错
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground break-words">
                {this.state.error?.message ?? '未知错误'}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground/60 break-all max-h-20 overflow-auto">
                {this.state.error?.stack?.split('\n').slice(0, 3).join('\n')}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.handleManualRetry}
                >
                  重试
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.history.back()}
                >
                  返回
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { window.location.href = '/workflows'; }}
                >
                  回到工作流列表
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    return <div key={this.state.resetKey} className="h-full">{this.props.children}</div>;
  }
}
