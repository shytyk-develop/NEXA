import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import './ui-kit.css';

const VARIANTS = {
    primary: 'start-btn start-btn--primary',
    ghost: 'start-btn start-btn--ghost',
    glass: 'nexa-ui-btn nexa-ui-btn--glass',
    nav: 'start-nav__btn',
    navPrimary: 'start-nav__btn start-nav__btn--primary',
} as const;

type Variant = keyof typeof VARIANTS;

type Common = {
    children: ReactNode;
    className?: string;
    variant?: Variant;
};

type ButtonAsButton = Common &
    ButtonHTMLAttributes<HTMLButtonElement> & {
        href?: undefined;
    };

type ButtonAsLink = Common &
    AnchorHTMLAttributes<HTMLAnchorElement> & {
        href: string;
    };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button({ children, className = '', variant = 'primary', ...rest }: ButtonProps) {
    const classes = `${VARIANTS[variant]} ${className}`.trim();
    if ('href' in rest && rest.href) {
        const { href, ...linkRest } = rest;
        return (
            <a href={href} className={classes} {...linkRest}>
                {children}
            </a>
        );
    }
    return (
        <button type="button" className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
            {children}
        </button>
    );
}
