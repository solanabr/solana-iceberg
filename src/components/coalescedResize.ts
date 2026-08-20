/**
 * Resize coalescing.
 *
 * Every listener this app attaches to `resize` ends in either a setState or a
 * canvas reallocation, and both are frame-scoped work: doing them twice inside
 * one frame paints exactly the same pixels as doing them once. Browsers do not
 * guarantee one resize per frame — desktop Chrome coalesces to the frame, but
 * iOS Safari fires a burst as the toolbar collapses during scroll, and an
 * orientation change delivers several in a row. Without a gate each event in
 * that burst pays the full cost.
 *
 * `requestAnimationFrame` is the correct gate rather than a timer, because the
 * HTML rendering steps run the resize steps BEFORE the animation frame
 * callbacks of the same frame. A handler deferred to rAF therefore still runs
 * before that frame paints: nothing is ever displayed at a stale size. A
 * `setTimeout`/debounce would miss the frame and show one at the wrong size.
 */
export function onCoalescedResize(handler: () => void): () => void {
  let frame = 0;
  const run = () => {
    frame = 0;
    handler();
  };
  const onResize = () => {
    if (frame) return;
    frame = requestAnimationFrame(run);
  };
  window.addEventListener("resize", onResize);
  return () => {
    window.removeEventListener("resize", onResize);
    if (frame) cancelAnimationFrame(frame);
  };
}
