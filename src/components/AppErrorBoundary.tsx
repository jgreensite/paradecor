import React, { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in AppErrorBoundary:', error, errorInfo)
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-cream p-4">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-stone/10 text-center animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">
              ⚠️
            </div>
            <h1 className="font-display text-2xl text-charcoal mb-4">Something went wrong</h1>
            <p className="text-stone text-sm mb-8 leading-relaxed">
              We've encountered an unexpected error. Don't worry, your progress might still be safe if you reload.
            </p>
            <div className="space-y-3">
              <button 
                onClick={this.handleReload}
                className="btn-primary w-full py-3"
              >
                Reload Application
              </button>
              <button 
                onClick={() => this.setState({ hasError: false, error: null })}
                className="w-full py-3 text-sm text-stone hover:text-charcoal transition-colors font-medium"
              >
                Try to resume
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-8 pt-6 border-t border-stone/10 text-left overflow-auto max-h-40">
                <p className="text-[10px] font-mono text-red-500 break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
