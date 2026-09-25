/**
 * Presence arc for `.avatar-status` wrappers: a ~90° stroke hugging the
 * avatar's left edge (7:30 → 10:30) with round caps. Colour and visibility
 * come from the wrapper's data-status (public/css/app-layout.css).
 */
export function StatusArc() {
    return (
        <svg className="avatar-status__arc" viewBox="0 0 100 100" aria-hidden="true">
            {/* r 47.5 around (50, 50): from 135° (lower left) through 180° to 225° (upper left) */}
            <path d="M16.41 83.59 A47.5 47.5 0 0 1 16.41 16.41" />
        </svg>
    );
}
