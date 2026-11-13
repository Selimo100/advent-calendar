/**
 * Locks page scrolling while a modal is open without the scroll jump that
 * `overflow: hidden` causes on iOS Safari: the body is fixed at the current
 * offset and restored afterwards.
 */
let lockCount = 0;
let savedY = 0;

export function lockScroll(): () => void {
  if (lockCount++ === 0) {
    savedY = window.scrollY;
    const body = document.body;
    body.style.position = 'fixed';
    body.style.top = `-${savedY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--lockCount === 0) {
      const body = document.body;
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
      window.scrollTo({ top: savedY, behavior: 'instant' as ScrollBehavior });
    }
  };
}
