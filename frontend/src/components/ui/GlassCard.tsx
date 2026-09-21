import type { HTMLAttributes, ReactNode } from 'react';
import './ui-kit.css';

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
    children: ReactNode;
};

export function GlassCard({ children, className = '', ...rest }: GlassCardProps) {
    return (
        <div className={`nexa-glass-card ${className}`.trim()} {...rest}>
            {children}
        </div>
    );
}
