# VeCo — VEgetable COmpare

A web remake of the original VeCo for Windows (2019). Two grids of food icons —
the shopping list (basket) and your cart. Decide as fast as you can whether they
match: **swipe right / ✓ = same**, **swipe left / ✗ = different**.

Installable as a PWA: open the site in Safari on iPhone → Share → **Add to Home
Screen**. It then runs fullscreen and works offline.

## Modes

- **Endless** — the original score attack. Correct answers raise the level
  (more items, less time), mistakes and timeouts lower it. Points = remaining
  milliseconds at the moment you answer.
- **Time Attack** — same rules, but you have 60 seconds total to score as many
  points as possible.
- **10 Lives** — every wrong answer or timeout costs a life; the run ends when
  all 10 are gone.
- **Shuffle** (modifier for all modes) — the cart may be re-ordered; compare
  the *content*, not the positions.

Best scores are kept per mode, lifetime statistics across all of them
(stored locally on the device).

Keyboard on desktop: **A** = different (left, like ✗), **D** = same (right, like ✓), **P** = pause.

## Development

No build step — plain HTML/CSS/JS (ES modules). Serve the folder with any
static server, e.g.:

```
python -m http.server 8080
```

Service worker + offline behavior need `localhost` or HTTPS. When releasing an
update, bump the `CACHE` version in `sw.js`.

Tip: open with `#debug` in the URL to get a `window.veco` console handle
(jump levels, soak-test round generation).

## Notes

- Music plays after the first tap on Play (browser autoplay policy) and follows
  the iPhone hardware silent switch — flip the ring switch on to hear it.

## Credits

- Food & UI icons by **bqlqn**, **Freepik**, **xnimrodx**, **Kiranshastry**,
  **Roundicons** ([flaticon.com](https://www.flaticon.com))
- Music: "Casual Theme Loop #3" from the original VeCo (2019)
- Sound effects: synthesized (Web Audio)
