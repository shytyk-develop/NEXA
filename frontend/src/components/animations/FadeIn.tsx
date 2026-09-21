import { useEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';

type FadeInProps = {
    children: ReactNode;
    delay?: number;
    className?: string;
};

export function FadeIn({ children, delay = 0, className }: FadeInProps) {
    const el = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const node = el.current;
        if (!node) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            gsap.set(node, { opacity: 1, y: 0 });
            return;
        }
        const tween = gsap.fromTo(
            node,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.6, delay, ease: 'power2.out' },
        );
        return () => {
            tween.kill();
        };
    }, [delay]);

    return (
        <div ref={el} className={className}>
            {children}
        </div>
    );
}
