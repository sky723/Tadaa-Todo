# Tadaa ✓🎉

The to-do list that celebrates every finished task — **$4.50, the price of a coffee.**

| Path | What it is |
|------|------------|
| `tadaa_app_with_sound.html` | Standalone app — open in any browser, no build, data in `localStorage`. Landing page, sign-up, tasks, confetti, the tick sound. |
| `tadaa_screenshots_coffee.html` | Six App Store screenshots (6.7″ proportions) with the coffee pricing. |
| `assets/app-icon.svg`, `app-icon-1024.png` | 1024×1024 App Store icon (square, full-bleed, no alpha). |
| `docs/app-store-preview-storyboard.md` | 30-second App Store preview storyboard, sound-first. |
| `web/` | **Next.js 14 + Supabase** app: magic-link auth, cloud sync, realtime, RLS. Runs local-only with no keys. |
| `mobile/` | **Expo** wrapper: WebView around the web app, bundled offline fallback, native haptics on every tick. |

## Features
- **Celebration:** synthesized tick sound (punch · click edge · sparkle rise, ~0.3 s, ~0 KB), confetti from the box you tap, full *Tadaa!* fanfare when the day is done. Sound toggle persists.
- **Quick add** in plain English: `Call mom tomorrow 5pm !high #family every week remind me 15 min before`
- **Daily plan:** briefing, overdue / today / no-date / coming-up groups, progress bar, 🔥 streak, all-time count.
- **Tasks:** priorities, tags, due date + time, subtasks (finishing the last one completes the parent), recurring (daily · weekdays · weekly · monthly · yearly — completing one schedules the next), reminders (browser notifications + chime), focus timer (25/5), dark mode.
- **Standalone extras:** JSON export/import.

## The tick sound
Three layers, built with the Web Audio API: **punch** 1200→800 Hz sine · **click edge** 2400→2000 Hz triangle ·
**sparkle rise** 1800→3200 Hz sine. A softer 1800 Hz blip on add/undo; a rising chord for the fanfare.
See `web/lib/sound.ts`.

## Run it
**Standalone:** open `tadaa_app_with_sound.html`.

**Web (local mode):**
```bash
cd web && npm install && npm run dev      # http://localhost:3000
npm test                                  # parser unit tests
```

**Web with cloud sync (Supabase):**
1. Create a Supabase project → SQL editor → run `web/supabase/schema.sql`.
2. Auth → URL configuration: add your site URL (e.g. `http://localhost:3000`) as a redirect.
3. `cp web/.env.example web/.env.local` and fill `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Tasks made in local mode are migrated into your account on first sign-in.

**Mobile:**
```bash
cd mobile && npm install
EXPO_PUBLIC_WEB_URL=https://your-deployed-web-app npx expo start   # omit to run the bundled offline app
```
Build for the stores with EAS (`npx eas build`). Bundle id: `com.sky723.tadaa`.

## Status
- `web/`: typechecks, builds, parser unit-tested, driven end-to-end in a headless browser in local mode.
- Supabase mode is written to the schema above but **not tested against a live project**.
- `mobile/`: typechecks and bundles with Metro (`expo export`); **not run on a device/simulator yet**.
- Payments ($4.50 one-time) are not wired up — use StoreKit / RevenueCat in the native build.
