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
    if (!['western', 'jhansi', 'other'].includes(p.collection)) throw new Error(`${p.id}: choose a photo collection.`);
    if (p.position && !/^(center|top|bottom|left|right|center \d{1,3}%)$/.test(p.position)) throw new Error(`${p.id}: invalid image focus.`);
  }
  if (new Set(photos.map(p => p.image)).size !== photos.length) throw new Error('Two published photo records use the same image. Keep one photo record per image.');
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
  return `<a class="thought-card" href="${a.url}"><div class="thought-meta"><span>Reflection · ${a.minutes} min read</span><span class="thought-number">${number(i)}</span></div><h3>${escapeHTML(a.title)}</h3><p>${escapeHTML(a.excerpt)}</p><div class="thought-read"><span>Read the reflection</span><i aria-hidden="true">↗</i></div></a>`;
}

function collectionCard(a, i) {
  const image = a.cover ? `<div class="collection-art-frame">${coverImage(a, 'collection-art', true)}</div>` : '';
  return `<a class="thought-card collection-card" href="${a.url}">${image}<div class="collection-copy"><div class="thought-meta"><span>${number(i)} · ${escapeHTML(a.category || 'Reflection')}</span><span>${a.minutes} min read</span></div><h2>${escapeHTML(a.title)}</h2><span class="collection-author">By Ashok Kumar Misra</span><p>${escapeHTML(a.listing_excerpt || a.excerpt)}</p><div class="thought-read"><span>Read the reflection</span><i aria-hidden="true">↗</i></div></div></a>`;
}

function coverImage(a, className = '', lazy = false) {
  const animatedIllustration = ['/assets/illustrations/observation.svg', '/assets/illustrations/learning.svg'].includes(a.cover);
  const motion = a.cover_motion === true;
  // Start built-in artwork still until the visibility observer activates it.
  const src = a.cover + (animatedIllustration ? '#still' : '');
  return `<img class="${className}${motion && !animatedIllustration ? ' cover-drift' : ''}" src="${escapeHTML(src)}"${motion ? ` data-cover-motion="${animatedIllustration ? 'illustration' : 'image'}" data-cover-src="${escapeHTML(a.cover)}"` : ''} width="600" height="260" alt="${escapeHTML(a.cover_alt)}"${lazy ? ' loading="lazy"' : ''}>`;
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
  const templates = Object.fromEntries(await Promise.all(['index', 'thoughts', 'article'].map(async name => [name, await fs.readFile(path.join(source, 'templates', name + '.html'), 'utf8')])));
  const pages = new Map();
  const empty = '<p class="content-empty">More reflections will be shared here soon.</p>';
  pages.set('index.html', render(templates.index, {
    HOME_ARTICLES: articles.slice(0, 2).map(homeCard).join('') || empty,
    GALLERY: jsonForScript(photos.map(p => ({ img: p.image, cap: p.caption, tag: p.date_label || '', collection: p.collection, position: p.position || 'center' }))),
    GALLERY_COUNT: photos.length,
    GALLERY_SUMMARY: `Showing ${Math.min(6, photos.length)} of ${photos.length} photographs`,
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
  await fs.copyFile(path.join(source, 'CNAME'), path.join(destination, 'CNAME'));
  await fs.writeFile(path.join(destination, '.nojekyll'), '');
  await Promise.all([...pages].map(([name, html]) => fs.writeFile(path.join(destination, name), html)));
  return { photos: photos.length, articles: articles.length, pages: pages.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildSite();
  console.log(`Built ${result.pages} pages, ${result.articles} articles and ${result.photos} gallery photographs.`);
}
