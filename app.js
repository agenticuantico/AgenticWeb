const frame = document.getElementById('domain-frame');
const fallback = document.getElementById('frame-fallback');

// The public domain remains the source of truth for public content.
// The iframe is intentionally fixed to that origin: no arbitrary URL input is accepted.
frame.addEventListener('load', () => {
  // A load event means the browser accepted the navigation. Some frame-blocking
  // policies cannot be detected reliably from the parent due to same-origin rules.
  fallback.hidden = true;
});

// Give the user a useful fallback if navigation is blocked before a load event.
window.setTimeout(() => {
  if (!frame.contentWindow) fallback.hidden = false;
}, 5000);
