# Magic Beyond Himalaya

Single-page website for Magic Beyond Himalaya, a Nepal-based guided trekking
company run by Sandip. Built as one self-contained HTML file so it can be
deployed by dragging the folder onto Netlify, with no build step.

## Files

- `index.html` — the complete site (HTML, CSS and JS inline)
- `magic_beyond_himalaya_prompt.md` — the original design brief and trek data
- `images/` — photography referenced by the site

## Photography

The six trek photos live in `images/`. They were resized to a longest edge of
1920 pixels and re-encoded as progressive JPEG at quality 78, taking the set
from 10.3 MB to 2.6 MB. Full-resolution originals are held by the client.

| File | Used for |
|---|---|
| `sunrise-peak.jpeg` | hero background |
| `manaslu-village.jpeg` | section background |
| `forest-ridge.jpeg` | trek card |
| `prayer-flags.jpeg` | trek card |
| `trail-village.jpeg` | trek card |
| `summit-pose.jpeg` | testimonials and about |

The guide card in the about section still shows a drawn avatar placeholder
rather than a photograph. To use a real portrait, add `images/sandip.jpg` and
replace that placeholder markup with an `img` element.

## Deploying

Drag the repository folder onto Netlify, or point any static host at the
repository root. `index.html` is the entry point.
