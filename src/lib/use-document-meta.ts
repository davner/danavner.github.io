import { useEffect } from "react";

const SITE_NAME = "Dan Avner";

function setMeta(selector: string, attribute: string, value: string) {
  const tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (tag) tag.setAttribute(attribute, value);
}

/** Keeps the tab title, description, and OG tags in step with the active route. */
export function useDocumentMeta(title: string, description: string) {
  useEffect(() => {
    const fullTitle = title === SITE_NAME ? SITE_NAME : `${title} · ${SITE_NAME}`;
    document.title = fullTitle;

    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", fullTitle);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:url"]', "content", window.location.href);
  }, [title, description]);
}
