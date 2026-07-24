/** Scroll the document to the top — used on landing tab navigation and route changes. */
export function scrollPageToTop(behavior: ScrollBehavior = "instant") {
  window.scrollTo({ top: 0, left: 0, behavior });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}
