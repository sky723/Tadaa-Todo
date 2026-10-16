# Todo Tadaa ✓🎉

The to-do list that celebrates every finished task — **$4.50, the price of a coffee.**

- `tadaa_app_with_sound.html` — working app: landing page, local account, tasks, confetti and the
  satisfying tick sound. Open it in a browser; no build step. Data is stored in `localStorage`.
- `tadaa_screenshots_coffee.html` — six App Store screenshots (6.7″ proportions) with the coffee pricing.

## The tick sound (Web Audio, ~0 KB)
Three layers in ~0.3 s: **punch** (1200→800 Hz sine), **click edge** (2400 Hz triangle),
**sparkle rise** (1800→3200 Hz sine). Softer 1800 Hz blip on add/undo; full fanfare on the landing CTA
and when every task is done. A Sound on/off toggle persists across sessions.

## Next steps
App icon (1024×1024 SVG) · 30 s App Store preview storyboard · Next.js + Supabase sync · React Native / Expo wrapper
