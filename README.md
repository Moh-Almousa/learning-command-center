# Learning Command Center

> النسخة العربية: [README.ar.md](README.ar.md) · دليل الاستخدام بالعربية: [GUIDE.ar.md](GUIDE.ar.md)

A personal **learning roadmap + progress history + project workspace** that runs entirely in the browser.
No backend, no database, no login — static files you can host on GitHub Pages. Bilingual: English / العربية.

**Everyday use happens in the website** (Open → Click → Add → Write → Save). You never need to edit code to
add or change courses, lessons, tasks, projects, skills, technologies, milestones, links, notes or lists.

## What it does

- **Roadmap** — interactive map (zoom, pan, pinch, fit, expand/collapse, prerequisite arrows, locked states) + outline view.
- **Hierarchy with its own progress at every level** — Learning path → Track → Course → Module → Lesson → Task.
  Finishing a task instantly recalculates lesson → module → course → track → path → overall.
- **History that is never overwritten**
  - every progress change is stored as a snapshot (chart + table on each item page, overall chart on Statistics);
  - start / complete / reopen events for every level, each with its effect ("Django 68% → 72%");
  - completed courses stay complete with all their content, dates, notes and resources (Courses → Completed courses);
  - **Reopen** a finished item to review it (keeps what you did) or start over (keeps the history).
- **Item page** for every level (`#/learn/<id>`): current position inside it, *What did I complete?* (completed /
  in progress / remaining, generated from your data), contents, progress history, activity, completion history.
- **Dashboard** — where you are (overall → path → course → module → lesson → task), Resume Learning, Today's Learning,
  next step, completed courses, active projects.
- **Projects** — checklist & kanban, groups, priorities, dependencies, milestones, *What I Applied*, learning links,
  notes, timeline, statistics, templates. Tasks can be grouped by group, milestone, priority or status.
- **Customize** page — quick-add anything, edit/move/reorder the whole learning plan, projects, skills,
  technologies (rename updates every project), templates and lists.
- **Certificates** — a gallery linked to courses: thumbnail, course, platform, date, credential ID, status
  (earned / pending / expired from the expiry date), search + filters, preview with *View certificate*,
  *Open original* and *Edit*. Add one from any completed course. Optional — never affects course completion.
- **Public page (read-only)** — publish a trimmed copy for friends or employers: learning plan with progress
  and dates, projects with tasks and *What I applied*, skills, earned certificates. Notes, resources, sessions,
  history, reviews, lists and pending certificates are never included, not even in the file. Visitors can't edit.
- **Lists** — your own collections: reading list, certifications, interview prep, books, practice problems…
- **Activity / History** (filter by level and event, sort newest/oldest), **Weekly Review**, **Statistics**,
  **Search**, **Focus Mode**, study **timer**, **Export / Import / Reset**.
- **Settings** — theme (dark / light / system), accent colour, custom colours, density, animations, default
  status, progress calculation, default project view, task grouping, name, learning goal, pinned focus, language.

## Project structure

```
index.html                 App shell + script tags (in load order)
.nojekyll                  Serve files as-is on GitHub Pages
assets/favicon.svg

data/                      STARTER CONTENT — plain, readable data, no logic
  initial-roadmap.js       paths → tracks → courses → modules → lessons → tasks, dependencies, start position
  initial-projects.js      projects, groups, tasks, milestones, "What I Applied"
  initial-skills.js        skills, technology registry, project templates, lists
  public-state.js          the published read-only copy (empty until you publish from Settings → Public page)

css/
  variables.css            DESIGN TOKENS — every colour, font, radius, spacing; dark + light themes; density
  base.css                 reset, typography, utilities, right-to-left rules
  layout.css               app shell: sidebar, top bar, main area
  components.css           buttons, cards, badges, progress bars, forms, dialogs, toasts, detail panel
  roadmap.css              roadmap map + outline + dashboard track preview
  pages.css                page layouts (dashboard, item page, projects, history, settings, manage, lists…)
  responsive.css           tablet / phone breakpoints

js/
  utils.js                 small helpers (escaping, ids, dates, download)
  i18n.js                  translation engine + English strings
  i18n-ar.js               Arabic strings (same keys)
  theme.js                 applies Appearance settings to the design tokens
  store.js                 STATE + localStorage + every data operation + migrations + history recording
  seed.js                  turns /data files into app state on first run
  model.js                 derived data: progress, status, locks, next step, streaks, history queries, search
  ui.js                    icons, progress bars, status controls, forms, dialogs, toasts, click dispatcher
  charts.js                tiny SVG charts (columns, progress line, ring) + tooltip
  public.js                public read-only page: mode (owner / visitor / preview), trimmed copy, read-only UI
  detail.js                side detail panel + add / edit / move / reopen / delete learning items
  roadmap.js               roadmap map (layout, zoom/pan) + outline view
  activity.js              study sessions, activity feed, Activity + History page
  dashboard.js             Dashboard + Today's Learning
  learn.js                 item page for any level (#/learn/<id>)
  courses.js               course library + completed courses
  certificates.js          certificate gallery, preview, course section (files resolved in asset())
  tasks.js                 all learning + project tasks
  skills.js                skills
  projects.js              projects, templates, project workspace
  lists.js                 user-defined lists
  statistics.js            statistics page
  review.js                weekly review
  focus.js                 focus mode
  manage.js                Customize page
  settings.js              settings + data management
  search.js                global search
  app.js                   boot, router, sidebar (built from registered pages), timer, shared actions
```

Plain HTML/CSS/vanilla JavaScript, no build step. Each JS file is a small module on the `window.App` namespace,
loaded with classic `<script defer>` tags, so double-clicking `index.html` also works.

### How data is organised (current state vs. history)

`localStorage['lcc.state.v1']` holds one object (also exactly what Export downloads):

| Part | What it is |
|---|---|
| `nodes` | entity + current state of every learning item: title, type, parentId, children, status, dates, notes, resources, prerequisites, `completions` (every completion and reopening) |
| `progress` | current calculated percentage/status of every container (used to detect changes) |
| `progressLog` | **history**: every progress change `{ ts, id, from, to, fromStatus, toStatus }` — append-only |
| `activity` | **history**: every event (started, completed, reopened, session, project events…) with `effects` |
| `projects`, `ptasks` | projects and their tasks |
| `certificates` | certificate metadata + links only (see below) |
| `skills`, `technologies`, `templates`, `lists` | the rest of your content |
| `sessions`, `today`, `reviews` | study sessions, daily plans, weekly review notes |
| `settings` | preferences, theme, language |

**Certificates and storage.** A certificate is stored as a few short fields — `title, provider, issueDate, expiryDate,
credentialId, status, certificateUrl, imageUrl, thumbnailUrl, notes, nodeId` — never as a Base64 image or PDF
(`data:` links are rejected). Gallery cards load only the thumbnail with `loading="lazy"`; the full image loads
only in the preview. Every place that needs a file calls `asset(cert, kind)` in `certificates.js`, and each record
has a reserved `file` field (`{ storage, key, mime, size }`), so adding uploads to a backend later means filling
that field and changing `asset()` — nothing else in the section.

**Public page.** Settings → Public page → *Download public file* produces `public-state.js`; upload it to `data/`
(replacing the empty one) and every browser that isn't the owner's sees that copy read-only. `build()` in
`public.js` is an allow-list — anything not named there never leaves the browser. The owner's browser is marked
with `localStorage['lcc.owner']` (on the first edit, or if it already held used data before anything was published);
*Is this your site?* in the banner marks another browser. Visitors never write app data; non-public pages redirect
to the dashboard; every action not in `ALLOW` is hidden and refused by the dispatcher; `data-private` sections are hidden.
When you re-upload the site files, don't overwrite your published `data/public-state.js` with the empty one.

Percentages are never typed by hand — they are always calculated from the items inside.
History is never trimmed automatically. Older saved data is migrated in place on load (see `normalize()` in `store.js`).

## Run locally

Open `index.html` in Chrome/Edge/Firefox, or serve the folder:

```bash
cd learning-command-center
python3 -m http.server 8000     # then open http://localhost:8000
```

> Data is stored per address: `file://…`, `localhost` and your GitHub Pages URL each keep their own copy.
> Use **Data → Export / Import** to move it.

## Publish on GitHub Pages

1. Create a repository named **`<your-username>.github.io`** (or any name → `https://<your-username>.github.io/<repo>/`).
2. Put the files at the root of the repository (so `index.html` is at the top level) and push:
   ```bash
   git init && git add . && git commit -m "Learning Command Center"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-username>.github.io.git
   git push -u origin main
   ```
   (Or on github.com: **Add file → Upload files**.)
3. **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save.**

Updating later: upload the new files over the old ones. Your progress lives in your browser, not in the repo,
so it is not affected.

## Customising

| I want to… | Where |
|---|---|
| Add / edit / move / reorder anything | **Customize** page, or the ✎ buttons everywhere |
| Change colours, theme, density, animations | **Settings → Appearance** |
| Change the design tokens in code | `css/variables.css` (one file) |
| Change what a fresh install starts with | `data/*.js` |
| Change or add UI text / a language | `js/i18n.js`, `js/i18n-ar.js` |

### Adding a feature (for developers)

Pages register themselves; the sidebar is built from them. A new page is one file + one `<script>` tag:

```js
(function (App) {
  App.Pages.books = {
    render(el, params, sub) { el.innerHTML = '<h1>Books</h1>'; },
    title: () => App.i18n.t('nav.books'),
    nav: { icon: 'book', order: 75 },          // omit `nav` to keep it out of the sidebar
  };
})(window.App = window.App || {});
```

Store new data under a new key in `Store.emptyState()` and give it a default in `normalize()` so old backups still load.
For many "track a list of things" ideas (books, certifications, interview prep) you don't need code at all — use **Lists**.

## Languages

Switch with the **ع / EN** button in the top bar, or **Settings → Language**. Arabic switches the layout to
right-to-left, including the roadmap map. Your own content (course names, notes…) stays as you typed it.
