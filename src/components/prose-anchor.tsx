import type { AnchorHTMLAttributes } from "react";
import type { ExtraProps } from "react-markdown";

/**
 * The anchor every markdown surface hands react-markdown.
 *
 * One override, because its job is a policy: an external link (an `http`
 * scheme) opens in a new tab with the opener cut, and an internal one stays
 * in the app's own tab. Three surfaces render markdown prose - blog posts,
 * now entries, album reviews - and this is the third, which is the repo's
 * own threshold for extraction (the `readout-link` rule in `index.css`).
 *
 * `node` is the mdast node react-markdown hands every override. Dropped here
 * so the spread cannot land it on the element.
 */
export function ProseAnchor({
  node: _node,
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & ExtraProps) {
  const external = href?.startsWith("http");
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      {...props}
    >
      {children}
    </a>
  );
}
