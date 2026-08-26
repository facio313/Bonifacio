export interface AccountNavigation {
  readonly href: string;
  readonly label: string;
  readonly ariaLabel: string;
}

export const SELF_SERVICE_ACCOUNT_NAVIGATION: Readonly<AccountNavigation>;
export function accountNavigationForRole(role: unknown): Readonly<AccountNavigation> | null;
export function accountNavigationFromSession(payload: unknown): Readonly<AccountNavigation> | null;
