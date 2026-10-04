import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const jsonForScript = value => JSON.stringify(value).replace(/</g, '\\u003c');
const number = i => String(i + 1).padStart(2, '0');
const compare = (a, b) => a.order - b.order || a.id.localeCompare(b.id);
const animatedIllustrations = ['observation', 'learning', 'home-first-school', 'information-and-thinking', 'habits-take-root', 'time-to-learn', 'discipline-and-service', 'beyond-the-rank', 'effort-and-recognition'].map(name => `/assets/illustrations/${name}.svg`);
export const photoCollections = [
  { id: 'people', label: 'Key People' },
  { id: 'life', label: 'Beyond the Rails' },
  { id: 'western', label: 'Western Railway' },
  { id: 'jhansi', label: 'Jhansi years' },
  { id: 'northeastern', label: 'North Eastern Railway' },
  { id: 'eastcentral', label: 'East Central Railway' },
  { id: 'other', label: 'Other moments' },
];

function required(value, field, id) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${id}: ${field} is required.`);
  return value.trim();
}

function checkOrder(value, id) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${id}: display order must be a non-negative number.`);
}

async function imagePath(value, source, id) {
  if (!value) return '';
  if (typeof value !== 'string' || !/^\/assets\/[a-zA-Z0-9_./ -]+\.(avif|gif|jpe?g|png|svg|webp)$/i.test(value) || value.split('/').includes('..')) {
    throw new Error(`${id}: select an uploaded image in assets.`);
  }
  await fs.access(path.join(source, value.slice(1))).catch(() => { throw new Error(`${id}: image does not exist: ${value}`); });
  return value;
}

async function entries(source, folder, extension) {
  const files = await fs.readdir(path.join(source, folder));
  return Promise.all(files.filter(f => f.endsWith(extension)).sort().map(async file => {
    const id = path.basename(file, extension);
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) throw new Error(`Use lowercase words and hyphens in filename: ${file}`);
    const text = await fs.readFile(path.join(source, folder, file), 'utf8');
    if (extension === '.json') {
      const record = JSON.parse(text);
      if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error(`${file}: photo details must be an object.`);
      return { ...record, id };
    }
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
    if (!match) throw new Error(`${file}: missing article frontmatter.`);
    return { ...parse(match[1]), body: match[2].trim(), id };
  }));
}

export async function loadContent(source = root) {
  const gallery = JSON.parse(await fs.readFile(path.join(source, 'content/gallery-order.json'), 'utf8'));
  // Pages CMS serializes an empty multiple-image field as null.
  const imageOrder = gallery.images ?? [];
  if (!Array.isArray(imageOrder) || imageOrder.some(image => typeof image !== 'string' || !image.trim())) throw new Error('Gallery order must be a list of image paths.');
  if (new Set(imageOrder).size !== imageOrder.length) throw new Error('Gallery order contains the same photo more than once.');
  const rank = new Map(imageOrder.map((image, index) => [image, index]));
  const photos = (await entries(source, 'content/photos', '.json')).filter(p => p.published === true);
  const articles = (await entries(source, 'content/articles', '.md')).filter(a => a.published === true);
  for (const p of photos) {
    required(p.title, 'title', p.id); required(p.caption, 'caption', p.id);
    p.image = await imagePath(required(p.image, 'image', p.id), source, p.id);
    if (!photoCollections.some(c => c.id === p.collection)) throw new Error(`${p.id}: choose a photo collection.`);
    const tags = p.tags ?? [];
    if (!Array.isArray(tags) || tags.some(tag => !photoCollections.some(c => c.id === tag))) throw new Error(`${p.id}: choose valid gallery tags.`);
    p.tags = [...new Set([p.collection, ...tags])];
    const additional = p.additional_images ?? [];
    if (!Array.isArray(additional)) throw new Error(`${p.id}: additional photos must be a list of images.`);
    p.additional_images = await Promise.all(additional.map(image => imagePath(required(image, 'additional image', p.id), source, p.id)));
    if (new Set([p.image, ...p.additional_images]).size !== p.additional_images.length + 1) throw new Error(`${p.id}: an event contains the same photo more than once.`);
    if (p.position && !/^(center|top|bottom|left|right|center \d{1,3}%)$/.test(p.position)) throw new Error(`${p.id}: invalid image focus.`);
  }
  const allImages = photos.flatMap(p => [p.image, ...p.additional_images]);
  if (new Set(allImages).size !== allImages.length) throw new Error('Two published gallery entries use the same image. Keep each photo in one event; use tags to show it in multiple collections.');
  // Ignore old grid references after deletion or unpublishing. New photographs
  // remain visible at the end until the editor positions them in the grid.
  photos.sort((a, b) => (rank.get(a.image) ?? Infinity) - (rank.get(b.image) ?? Infinity) || a.id.localeCompare(b.id));
  for (const a of articles) {
    required(a.title, 'title', a.id); required(a.excerpt, 'summary', a.id); required(a.body, 'article text', a.id); checkOrder(a.order, a.id);
    a.cover = await imagePath(a.cover, source, a.id);
    a.html = markdown.render(a.body);
    const wordCount = a.html.replace(/<[^>]*>/g, ' ').trim().split(/\s+/u).length;
    a.minutes = Number.isInteger(a.reading_minutes) && a.reading_minutes > 0 ? a.reading_minutes : Math.max(1, Math.ceil(wordCount / 250));
    a.url = `/thoughts/${a.id}.html`;
  }
  return { photos, articles: articles.sort(compare) };
}

function homeCard(a, i) {
  const art = a.cover ? `<div class="home-thought-art">${coverImage(a, '', true)}</div>` : '';
  return `<a class="thought-card home-thought" href="${a.url}">${art}<div class="home-thought-copy"><div class="thought-meta"><span>${escapeHTML(a.category || 'Reflection')} · ${a.minutes} min read</span><span class="thought-number">${number(i)}</span></div><h3>${escapeHTML(a.title)}</h3><p>${escapeHTML(a.excerpt)}</p><div class="thought-read"><span>Read the reflection</span><i aria-hidden="true">↗</i></div></div></a>`;
}

function collectionCard(a, i) {
  const image = a.cover ? `<div class="collection-art-frame">${coverImage(a, 'collection-art', true)}</div>` : '';
  return `<a class="thought-card collection-card" data-article-category="${escapeHTML(a.category || 'Reflection')}" href="${a.url}">${image}<div class="collection-copy"><div class="thought-meta"><span>${number(i)} · ${escapeHTML(a.category || 'Reflection')}</span><span>${a.minutes} min read</span></div><h2>${escapeHTML(a.title)}</h2><span class="collection-author">By Ashok Kumar Misra</span><p>${escapeHTML(a.listing_excerpt || a.excerpt)}</p><div class="thought-read"><span>Read the reflection</span><i aria-hidden="true">↗</i></div></div></a>`;
}

function coverImage(a, className = '', lazy = false) {
  const animatedIllustration = animatedIllustrations.includes(a.cover);
  const motion = a.cover_motion === true;
  // A distinct static asset reliably stops CSS animation inside an SVG image.
  // Fragment-only URL changes do not consistently update :target in browsers.
  const still = animatedIllustration ? a.cover.replace(/\.svg$/, '-still.svg') : a.cover;
  return `<img class="${className}${motion && !animatedIllustration ? ' cover-drift' : ''}" src="${escapeHTML(still)}"${motion ? ` data-cover-motion="${animatedIllustration ? 'illustration' : 'image'}" data-cover-src="${escapeHTML(a.cover)}" data-cover-still="${escapeHTML(still)}"` : ''} width="600" height="260" alt="${escapeHTML(a.cover_alt)}"${lazy ? ' loading="lazy"' : ''}>`;
}

function fitnessSection(fitness, photos) {
  if (!fitness) return '';
  for (const key of ['cycling_event', 'cycling_detail', 'retirement_date']) required(fitness[key], key, 'Beyond the Rails');
  for (const key of ['cycling_distance', 'retirement_distance']) if (!Number.isFinite(fitness[key]) || fitness[key] <= 0) throw new Error(`Beyond the Rails: ${key} must be positive.`);
  if (!Array.isArray(fitness.runs) || !fitness.runs.length) throw new Error('Beyond the Rails: add at least one run.');
  const results = fitness.runs.map(run => {
    required(run.event, 'event', 'Beyond the Rails');
    if (!Number.isInteger(run.year) || run.year < 1900 || run.year > 2100) throw new Error('Beyond the Rails: use a four-digit run year.');
    return `<li><time datetime="${run.year}">${run.year}</time><span>${escapeHTML(run.event)}</span></li>`;
  }).join('');
  const years = fitness.runs.map(run => run.year);
  const yearRange = Math.min(...years) === Math.max(...years) ? String(years[0]) : `${Math.min(...years)}–${Math.max(...years)}`;
  // Related pictures remain owned by the gallery. Unpublishing a picture also
  // removes its feature here, without leaving a second unmanaged copy.
  const cyclingImages = fitness.cycling_photos || (fitness.photos || []).slice(0, 2);
  const runningImages = fitness.running_photos || (fitness.photos || []).slice(2);
  const relatedPhotos = images => images.map(image => photos.find(p => p.image === image)).filter(Boolean).slice(0, 2);
  const cyclingPhotos = relatedPhotos(cyclingImages), runningPhotos = relatedPhotos(runningImages);
  const photoPair = (items, label) => items.length ? `<div class="fitness-photos" aria-label="${label}">${items.map(p => `<a class="fitness-photo" href="${escapeHTML(p.image)}" data-fitness-photo="${escapeHTML(p.image)}" aria-label="Open photograph: ${escapeHTML(p.title)}"><img src="${escapeHTML(p.image)}" width="360" height="300" loading="lazy" alt="${escapeHTML(p.caption)}" style="object-position:${escapeHTML(p.position === 'center' || !p.position ? 'center 65%' : p.position)}"><span>${escapeHTML(p.title)}<small>${escapeHTML(p.date_label || '')}</small></span></a>`).join('')}</div>` : '';
  return `<section id="beyond-rails" aria-labelledby="fitness-title"><div class="wrap">
  <header class="fitness-heading"><div><div class="kicker">Beyond the Rails</div><h2 id="fitness-title">A different kind of journey.</h2></div><p>Running, cycling, and a commitment to fitness.</p></header>
  <div class="fitness-grid">
    <article class="fitness-card fitness-cycle"><div class="fitness-card-heading"><h3>Cycling</h3><span>On two wheels</span></div>${photoPair(cyclingPhotos, 'Cycling photographs')}<div class="fitness-copy"><span class="fitness-label">Cyclothon · Finisher</span><div class="fitness-cycle-summary"><div class="fitness-distance">${fitness.cycling_distance}<small>km</small></div><div><h4>${escapeHTML(fitness.cycling_event)}</h4><p class="fitness-event-detail">${escapeHTML(fitness.cycling_detail)}</p></div></div><div class="fitness-retirement"><strong>${fitness.retirement_distance} <small>km</small></strong><div><b>A ride to mark retirement</b><p>${escapeHTML(fitness.retirement_date)} · A morning ride on his retirement day.</p></div></div></div></article>
    <article class="fitness-card fitness-run"><div class="fitness-card-heading"><h3>Running</h3><span>One stride at a time</span></div>${photoPair(runningPhotos, 'Running photographs')}<div class="fitness-copy"><div class="fitness-run-heading"><div><span class="fitness-label">10 km finishes</span><h4>${fitness.runs.length} finish lines</h4></div><span>${yearRange}</span></div><ol class="fitness-results">${results}</ol></div></article>
  </div>
  ${cyclingPhotos.length + runningPhotos.length ? `<div class="fitness-journal"><a href="#gallery" data-fitness-gallery>Explore the photo journal <span aria-hidden="true">↗</span></a></div>` : ''}
  <a class="next-chapter" href="#thoughts"><span><small>Next stop · Thoughts</small><strong>A different perspective, in his own words.</strong></span><span aria-hidden="true">→</span></a>
  </div></section>`;
}

function render(template, values) {
  return template.replace(/<!-- CMS:([A-Z_]+) -->|\/\* CMS:([A-Z_]+) \*\//g, (_, htmlKey, scriptKey) => {
    const key = htmlKey || scriptKey;
    if (!(key in values)) throw new Error(`Missing template value: ${key}`);
    return values[key];
  });
}

export async function buildSite(source = root, destination = path.join(root, 'dist')) {
  const { photos, articles } = await loadContent(source);
  const fitness = await fs.readFile(path.join(source, 'content/fitness.json'), 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  const photographCount = photos.reduce((total, photo) => total + 1 + photo.additional_images.length, 0);
  const filters = [{ id: 'all', label: 'All moments' }, ...photoCollections.filter(c => photos.some(p => p.tags.includes(c.id)))];
  const templates = Object.fromEntries(await Promise.all(['index', 'thoughts', 'article'].map(async name => [name, await fs.readFile(path.join(source, 'templates', name + '.html'), 'utf8')])));
  const pages = new Map();
  const empty = '<p class="content-empty">More reflections will be shared here soon.</p>';
  pages.set('index.html', render(templates.index, {
    FITNESS_SECTION: fitnessSection(fitness, photos),
    HOME_ARTICLES: articles.map(homeCard).join('') || empty,
    GALLERY: jsonForScript(photos.map(p => ({ title: p.title, img: p.image, cap: p.caption, tag: p.date_label || '', collection: p.collection, tags: p.tags, images: [p.image, ...p.additional_images], position: p.position || 'center' }))),
    GALLERY_FILTERS: filters.map(c => `<button type="button" data-gallery-filter="${c.id}" aria-pressed="${c.id === 'all'}">${c.label}</button>`).join(''),
    GALLERY_COUNT: photographCount,
    GALLERY_SUMMARY: photographCount === photos.length ? `Showing ${Math.min(6, photos.length)} of ${photos.length} photographs` : `${photographCount} photographs across ${photos.length} moments`,
  }));
  pages.set('thoughts/index.html', render(templates.thoughts, {
    ARTICLE_COUNT: `${articles.length} ${articles.length === 1 ? 'reflection' : 'reflections'}`,
    ARTICLE_CARDS: articles.map(collectionCard).join('') || empty,
  }));
  articles.forEach((a, i) => {
    const next = articles.length > 1 ? articles[(i + 1) % articles.length] : null;
    pages.set(a.url.slice(1), render(templates.article, {
      TITLE: escapeHTML(a.title), NUMBER: number(i), READ_TIME: `${a.minutes} min read`, BODY: a.html,
      COVER: a.cover ? `<figure class="reading-art"><div class="reading-art-frame">${coverImage(a)}</div>${a.cover_caption ? `<figcaption>${escapeHTML(a.cover_caption)}</figcaption>` : ''}</figure>` : '',
      NEXT_ARTICLE: next ? `<footer class="reading-next"><small>Another thought along the way</small><a href="${next.url}">${escapeHTML(next.title)} →</a></footer>` : '<footer class="reading-next"><a href="/thoughts/">All thoughts →</a></footer>',
    }));
  });
  // Rebuild from an empty output so unpublishing cannot leave an old article online.
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(path.join(destination, 'thoughts'), { recursive: true });
  await fs.cp(path.join(source, 'assets'), path.join(destination, 'assets'), { recursive: true, filter: src => !src.endsWith('/hero-raw.jpg') && !src.endsWith('/.DS_Store') });
  for (const illustration of animatedIllustrations) {
    const svgPath = path.join(destination, illustration.slice(1));
    let svg;
    try { svg = await fs.readFile(svgPath, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    await fs.writeFile(svgPath.replace(/\.svg$/, '-still.svg'), svg.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ''));
  }
  await fs.copyFile(path.join(source, 'CNAME'), path.join(destination, 'CNAME'));
  await fs.writeFile(path.join(destination, '.nojekyll'), '');
  await Promise.all([...pages].map(([name, html]) => fs.writeFile(path.join(destination, name), html)));
  return { photos: photographCount, moments: photos.length, articles: articles.length, pages: pages.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildSite();
  console.log(`Built ${result.pages} pages, ${result.articles} articles and ${result.photos} gallery photographs.`);
}
