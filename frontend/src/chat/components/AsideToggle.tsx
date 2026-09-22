import { memo } from 'react';
import { Icon } from './Icon';

type AsideToggleProps = {
    id: string;
    side: 'start' | 'end';
    controls: string;
    label: string;
    title?: string;
};

export const AsideToggle = memo(function AsideToggle({
    id,
    side,
    controls,
    label,
    title,
}: AsideToggleProps) {
    return (
        <button
            id={id}
            className={`aside-toggle aside-toggle--${side}`}
            type="button"
            title={title ?? label}
            aria-expanded="true"
            aria-controls={controls}
            aria-label={label}
        >
            <Icon href="#icon-chevron-right" />
        </button>
    );
});
