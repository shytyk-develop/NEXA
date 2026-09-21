import './ui-kit.css';

type AvatarProps = {
    src?: string | null;
    alt?: string;
    initials?: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
};

export function Avatar({ src, alt = '', initials = '?', size = 'md', className = '' }: AvatarProps) {
    return (
        <span className={`nexa-ui-avatar nexa-ui-avatar--${size} ${className}`.trim()}>
            {src ? <img src={src} alt={alt} /> : <span>{initials}</span>}
        </span>
    );
}
