export type ActivityUserRef =
  | { firstName?: string; lastName?: string; email?: string; role?: string }
  | string
  | null
  | undefined;

export function formatActivityAccount(user: ActivityUserRef): string | null {
  if (!user || typeof user === 'string') return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (name && user.email) return `${name} (${user.email})`;
  return user.email || name || null;
}
