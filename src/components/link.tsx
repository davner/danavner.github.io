import {
  Link as RouterLink,
  type LinkProps,
  NavLink as RouterNavLink,
  type NavLinkProps,
} from "react-router";

/**
 * The router's `Link` and `NavLink` with `viewTransition` on by default - the
 * only place the prop is spelled, so no future link forgets it. A caller that
 * wants a snap instead passes `viewTransition={false}`; `setSearchParams`
 * navigations never come through here, so filters stay a snap on their own.
 */
export function Link(props: LinkProps) {
  return <RouterLink viewTransition {...props} />;
}

export function NavLink(props: NavLinkProps) {
  return <RouterNavLink viewTransition {...props} />;
}
