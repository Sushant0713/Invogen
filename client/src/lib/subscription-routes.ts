export const SUBSCRIPTION_CHECKOUT_PATHS = [
  '/admin/subscription',
  '/admin/subscription/plans',
  '/admin/subscription/cart',
  '/admin/subscription/payment',
] as const;

export function isSubscriptionCheckoutPath(pathname: string) {
  return (SUBSCRIPTION_CHECKOUT_PATHS as readonly string[]).includes(pathname);
}

export function isSubscriptionNavChildActive(childPath: string, pathname: string) {
  return pathname === childPath || pathname.startsWith(`${childPath}/`);
}
