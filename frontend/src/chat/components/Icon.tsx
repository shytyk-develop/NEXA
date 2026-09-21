type IconProps = {
    href: string;
    className?: string;
};

export function Icon({ href, className = 'ui-icon' }: IconProps) {
    return (
        <svg className={className} aria-hidden="true">
            <use href={href} />
        </svg>
    );
}
