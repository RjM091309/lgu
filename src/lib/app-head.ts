import { useEffect } from 'react';

// Each part of LIMS can be added to the home screen (or installed from Chrome) as its own app: the public site and
// Staff Portal (/), E-Session (/es) and LIMS Mobile (/m). index.html carries the details for /; while /es or /m
// is open, they are swapped for its own, since a page may only have one manifest.

const setAttr = (selector: string, attr: string, value: string) => {
  const element = document.head.querySelector<HTMLElement>(selector);
  if (!element) return () => undefined;
  const previous = element.getAttribute(attr) ?? '';
  element.setAttribute(attr, value);
  return () => element.setAttribute(attr, previous);
};

/** Points the page's manifest, home-screen name and title at one part of LIMS while it is open. */
export function useAppHead({ manifest, homeScreenName, title }: { manifest: string; homeScreenName: string; title: string }) {
  useEffect(() => {
    const restore = [
      setAttr('link[rel="manifest"]', 'href', manifest),
      setAttr('meta[name="apple-mobile-web-app-title"]', 'content', homeScreenName),
      setAttr('meta[name="application-name"]', 'content', homeScreenName),
    ];
    const previousTitle = document.title;
    document.title = title;
    return () => {
      restore.forEach((undo) => undo());
      document.title = previousTitle;
    };
  }, [manifest, homeScreenName, title]);
}
