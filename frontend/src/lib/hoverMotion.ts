// Shared hover motion for the sidebar lists. Reference: the Inbox rows
// (Unread / All chats / Muted) — their sliding hover highlight rides this
// spring, and the folder tree, chat list and bottom dock use the same one.
// Rows' own background / colour changes use the matching CSS timing
// (--sidebar-hover-transition in public/css/themes.css), which settles in
// about the same time as the spring.

/** Sliding hover highlight: soft glide, no overshoot (ζ ≈ 0.95). */
export const listHoverTransition = { type: 'spring', stiffness: 380, damping: 37 } as const;

export const instantHoverTransition = { duration: 0 };
