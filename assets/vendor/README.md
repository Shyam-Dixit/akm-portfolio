# Three.js

Pinned version: **0.180.0**. MIT license, retained in `three-LICENSE.txt`.

The unmodified production modules were obtained from the published npm package via:

- https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js
- https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.core.min.js

The website serves these files locally. The locomotive loads them only on a supported desktop viewport when its route comes into view, and uses an SVG fallback if loading or WebGL fails. Rendering runs during movement and stops when the train settles or the page is hidden.


GSAP 3.12.5 and ScrollTrigger 3.12.5 are served locally so career content and interactions do not depend on a third-party script CDN. These are the unchanged versions previously loaded by the site from https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/. Original distribution headers are retained; see gsap-NOTICE.txt for the upstream package license references.
