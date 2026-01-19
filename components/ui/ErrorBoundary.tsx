
import React, { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<Props, State> {
  public props!: Props;
  public state: State = {
    hasError: false,
    error: undefined,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> | null {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
            <h2 className="font-bold text-lg mb-2">Something went wrong.</h2>
            <p>We're sorry, but the application encountered an unexpected error. Please try refreshing the page.</p>
            {this.state.error && (
                <pre className="mt-4 p-2 bg-red-50 text-xs rounded overflow-auto">
                    {this.state.error.toString()}
                </pre>
            )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
