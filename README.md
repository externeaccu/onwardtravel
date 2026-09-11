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
| `sandip.jpg` | guide card portrait in the about section |

The portrait is square-cropped to 600 pixels around the face, because the
guide card renders it in an 88 pixel circle. Re-crop from the original if the
framing ever needs to change.

## Deploying

`index.html` is the entry point and every asset path is relative, so the site
works at a domain root or under a subpath with no changes.

Published with GitHub Pages, serving from the repository root. `CNAME` holds
the custom domain, so enabling Pages picks it up automatically. Any static
host works equally well: drag the folder onto Netlify and it runs as-is.
