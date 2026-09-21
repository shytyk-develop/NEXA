import type { HTMLAttributes, ReactNode } from 'react';
import '../ui/ui-kit.css';

type GridContainerProps = HTMLAttributes<HTMLDivElement> & {
    children: ReactNode;
};

export function GridContainer({ children, className = '', ...rest }: GridContainerProps) {
    return (
        <div className={`nexa-grid-container ${className}`.trim()} {...rest}>
            <div className="nexa-grid">{children}</div>
        </div>
    );
}
