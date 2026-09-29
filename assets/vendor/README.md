# Three.js

Pinned version: **0.180.0**. MIT license, retained in `three-LICENSE.txt`.

The unmodified production modules were obtained from the published npm package via:

- https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js
- https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.core.min.js

The website serves these files locally. The locomotive loads them only on a supported desktop viewport when its route comes into view, and uses an SVG fallback if loading or WebGL fails. Rendering runs during movement and stops when the train settles or the page is hidden.
