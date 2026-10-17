# Tadaa — 30-second App Store preview storyboard

**Format:** 886×1920 portrait (iPhone 6.7″ preview spec), 30 s max, H.264, 30 fps.
**Sound is the hero.** Apple autoplays previews muted, so every beat reads visually first and
the audio rewards the tap-to-unmute. Use the real in-app sounds (Web Audio recipe in the README),
captured straight from a screen recording of the app — no stock music.
**Palette:** ink `#111`, yellow `#FFD23F`, cream `#FFFBF0`, coffee `#E8D9C0`.

| # | Time | Visual | On-screen text | Sound |
|---|------|--------|----------------|-------|
| 1 | 0:00–0:03 | Black screen. A single yellow circle pops in; a checkmark draws itself inside it. Confetti bursts. | **Finish it. Feel it.** | The full *tadaa* fanfare (tick + rising chord) |
| 2 | 0:03–0:07 | Hand types in the quick-add bar: "Call mom tomorrow 5pm !high". Task flies in with date, priority and time already parsed. | *Just type it.* | Soft blip on add |
| 3 | 0:07–0:12 | Thumb taps the checkbox. Box fills yellow, confetti erupts from the exact box. Slow-mo 0.5× for the burst. | *Every tick is a party.* | **The tick** — punch, click, sparkle (hold a beat of silence after) |
| 4 | 0:12–0:16 | Rapid montage: 4 taps in a row, each with a tick, progress bar fills, counter flips "3 of 4 celebrated". | *Stack your wins.* | Ticks at 4 pitches rising |
| 5 | 0:16–0:20 | Daily plan: morning briefing card, 🔥 streak counter increments 6 → 7. | *Build a streak.* | Chime |
| 6 | 0:20–0:23 | Last task of the day checked → whole screen confetti, giant **Tadaa!** text pops. | **Tadaa!** | Fanfare, full volume |
| 7 | 0:23–0:27 | Cut to coffee-brown card: ☕ = ✓. "Your coffee $5 every day" vs "Tadaa $4.50 once. forever." | **One coffee. Forever.** | Cash-register-soft *ding* |
| 8 | 0:27–0:30 | Icon on black. Button: **Get Tadaa · $4.50**. | *Skip one coffee. Celebrate every task.* | Final single tick |

## Production notes
- Record in the Expo build on a real device (screen recording with audio) or the web app at 886×1920.
- Cut on the sound: align every visual hit to the tick's first 10 ms (the click edge).
- Keep captions ≥ 64 px so they read at thumbnail size; no more than 6 words per beat.
- Export a muted-first cut: if beats 3 and 6 don't land with sound off, add a 3-frame screen shake.
- App Store review: don't show any device frame other than the real device; no third-party logos.
