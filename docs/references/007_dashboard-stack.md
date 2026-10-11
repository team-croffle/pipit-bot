# 007 — Dashboard: Vue, Vite, shadcn-vue, Tailwind

- **Vue 3** — https://vuejs.org/guide · **Vue Router** — https://router.vuejs.org
- **Vite** — https://vite.dev/guide
- **shadcn-vue** — https://www.shadcn-vue.com · **reka-ui** — https://reka-ui.com
- **Tailwind CSS** v4 — https://tailwindcss.com/docs
- **lucide** icons (`lucide-vue-next`) — https://lucide.dev/icons · **VueUse** — https://vueuse.org
- **Emojibase** — https://emojibase.dev (the emoji picker's data)

## How Pipit uses it

- A single-page app in `dashboard/` (a Yarn workspace), built to `dashboard/dist` and served by the bot.
- shadcn-vue components are vendored under `dashboard/src/components/ui/` and added with the shadcn-vue CLI; they keep
  upstream's PascalCase file names, everything else is kebab-case.
- Design tokens are CSS variables; light and dark follow `prefers-color-scheme` with a manual override (VueUse
  `useColorMode`).
- Data comes from `/api/*` only; live views poll (a composable per view shares one interval).

## Worth knowing

- reka-ui's `Select` carries values as strings and treats `''` as "nothing selected" — pickers use sentinel values and
  map them back (`lib/picker.ts`).
- reka-ui's dropdown menu opens on a real pointer event; a synthetic `pointerdown` does not open it (relevant to
  headless tests).
- A CSS grid without explicit columns sizes its track to its widest content — narrow layouts need `grid-cols-1`.
