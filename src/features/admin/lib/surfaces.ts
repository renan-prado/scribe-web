/**
 * Shared surface treatments for admin pages: white card + soft blue shadow,
 * comfortable inner padding on tables. Kept as constants so /admin/users,
 * /admin/usage tables and the filter card stay visually identical.
 */

export const ADMIN_CARD_SURFACE =
  "rounded-2xl border bg-white [border-color:var(--scriba-hairline-soft)] [box-shadow:0_4px_14px_rgba(79,168,240,0.06)]";

export const ADMIN_TABLE_SURFACE = `admin-table overflow-hidden ${ADMIN_CARD_SURFACE}`;
