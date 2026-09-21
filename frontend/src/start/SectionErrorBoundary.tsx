import { Component, type ReactNode } from 'react';

type Props = { id: string; children: ReactNode };
type State = { message: string | null };

export class SectionErrorBoundary extends Component<Props, State> {
    state: State = { message: null };

    static getDerivedStateFromError(error: Error) {
        return { message: error.message };
    }

    render() {
        if (this.state.message) {
            return (
                <div data-section-error={this.props.id} className="start-section">
                    Section `{this.props.id}` failed: {this.state.message}
                </div>
            );
        }
        return this.props.children;
    }
}
