import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  declare props: { children: React.ReactNode };
  declare setState: (state: Partial<ErrorBoundaryState>) => void;
  state: ErrorBoundaryState = { hasError: false, errorMessage: '' };

  constructor(props: { children: React.ReactNode }) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  handleGoDashboard = () => {
    window.location.hash = '#/dashboard';
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F9F6] dark:bg-[#0D1A15] text-[#163D32] dark:text-[#EDF4EF] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#13241D] border border-[#163D32]/15 dark:border-[#264638] rounded-2xl p-6 space-y-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#163D32] dark:text-[#EDF4EF]">
                  Something went wrong
                </h2>
                <p className="text-xs text-[#163D32]/65 dark:text-[#9FC6B0]">
                  NeatSpace AI recovered safely without losing saved cloud data.
                </p>
              </div>
            </div>

            {this.state.errorMessage && (
              <div className="p-3 rounded-xl bg-[#F7F9F6] dark:bg-[#182C24] border border-[#163D32]/10 dark:border-[#264638] text-xs font-mono text-[#163D32]/80 dark:text-[#B9D1C3] break-words">
                {this.state.errorMessage}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={this.handleGoDashboard}
                className="flex-1 py-2.5 px-4 bg-[#DDF3E5] hover:bg-[#cdebd8] text-[#163D32] font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <Home className="w-4 h-4" />
                <span>Go to Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 px-4 bg-[#163D32] hover:bg-[#102E25] text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4 text-[#E9B95B]" />
                <span>Reload App</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
