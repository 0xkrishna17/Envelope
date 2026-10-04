import React from 'react';
import { AlertTriangle, Clipboard, Home, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  appVersion: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  copied: boolean;
}

export function getErrorBoundaryDisplayMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return 'The app hit an unexpected problem.';
}

function buildErrorReport(params: { error: Error | null; appVersion: string; occurredAt: string }): string {
  return [
    'Envelope error report',
    `Version: ${params.appVersion}`,
    `Time: ${params.occurredAt}`,
    `Message: ${getErrorBoundaryDisplayMessage(params.error)}`,
    params.error?.stack ? `Stack:\n${params.error.stack}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
    copied: false,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, copied: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Envelope render failure:', error, errorInfo.componentStack);
  }

  private handleTryAgain = (): void => {
    this.setState({ error: null, copied: false });
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleCopyReport = async (): Promise<void> => {
    if (!navigator.clipboard) return;

    await navigator.clipboard.writeText(
      buildErrorReport({
        error: this.state.error,
        appVersion: this.props.appVersion,
        occurredAt: new Date().toISOString(),
      })
    );
    this.setState({ copied: true });
  };

  render(): React.ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    const message = getErrorBoundaryDisplayMessage(this.state.error);

    return (
      <main className="min-h-screen bg-[#F4EFE6] dark:bg-[#141210] flex items-center justify-center p-4">
        <section className="w-full max-w-md bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-3xl p-6 sm:p-8 shadow-xl text-center">
          <div className="flex items-center justify-center mb-5">
            <div className="w-16 h-16 rounded-2xl bg-[#B85D43]/10 text-[#B85D43] border border-[#B85D43]/20 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>
          </div>

          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B85D43] dark:text-[#F3B3A2] mb-2">
              App recovery
            </p>
            <h1 className="text-xl font-bold text-[#1F1B16] dark:text-[#EDE8E1]">
              Something went wrong
            </h1>
            <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-2 leading-relaxed">
              Your budget data is kept separately from this screen. Try reopening the app view, or reload if the problem continues.
            </p>
          </div>

          <div className="mb-6 p-4 rounded-2xl bg-[#EFEAE1]/70 dark:bg-[#241F1B]/70 border border-[#E8E3DA] dark:border-[#2D2823] text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] mb-1">
              Error message
            </p>
            <p className="text-xs text-[#1F1B16] dark:text-[#EDE8E1] leading-relaxed break-words">
              {message}
            </p>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={this.handleTryAgain}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-[#4E785E] text-white font-medium text-sm hover:bg-[#436851] transition-colors shadow-sm cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Try opening app again</span>
            </button>

            <button
              type="button"
              onClick={this.handleReload}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#EFEAE1] dark:bg-[#28221D] text-[#1F1B16] dark:text-[#EDE8E1] border border-[#E8E3DA] dark:border-[#2D2823] font-medium text-xs hover:bg-[#E5DFD5] dark:hover:bg-[#332C26] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#78716C]" />
              <span>Reload app</span>
            </button>

            <button
              type="button"
              onClick={this.handleCopyReport}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-[#78716C] dark:text-[#A8A29E] text-[11px] font-medium hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] transition-colors cursor-pointer"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>{this.state.copied ? 'Error details copied' : 'Copy error details'}</span>
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-[#E8E3DA] dark:border-[#2D2823]">
            <p className="text-[10px] text-[#A8A29E] dark:text-[#78716C]">
              Envelope {this.props.appVersion}
            </p>
          </div>
        </section>
      </main>
    );
  }
}
