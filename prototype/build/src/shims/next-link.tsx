import { forwardRef } from "react";
import { nav } from "../loc";

/* A stand-in for next/link: a plain link that moves to the page after the "#" */
type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string | { pathname?: string }; prefetch?: boolean; replace?: boolean; scroll?: boolean };

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, prefetch, replace, scroll, onClick, ...rest }, ref) {
  void prefetch;
  void scroll;
  const to = typeof href === "string" ? href : href.pathname ?? "/";
  return (
    <a
      ref={ref}
      href={to.startsWith("/") ? `#${to}` : to}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.ctrlKey || e.metaKey || rest.target === "_blank") return;
        if (to.startsWith("/")) {
          e.preventDefault();
          nav(to, replace);
        }
      }}
      {...rest}
    />
  );
});
export default Link;
