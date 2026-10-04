import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { buildSite, loadContent } from './build.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('published content satisfies the editor schema', async () => {
  const { photos, articles } = await loadContent();
  for (const article of articles) assert.equal(article.url, `/thoughts/${article.id}.html`);
  const config = parse(await fs.readFile(path.join(root, '.pages.yml'), 'utf8'));
  for (const collection of config.content.filter(c => c.type === 'collection')) {
    const fields = collection.fields;
    const entries = collection.name === 'photos' ? photos : articles;
    for (const entry of entries) for (const field of fields.filter(f => f.required)) {
      assert.notEqual(entry[field.name], undefined, `${entry.id}: missing ${field.name}`);
    }
  }
});

test('event albums preserve individual images, tags and thumbnail ordering', async t => {
  const source = await fs.mkdtemp(path.join(os.tmpdir(), 'akm-albums-'));
  t.after(() => fs.rm(source, { recursive: true, force: true }));
  for (const dir of ['content/articles', 'content/photos', 'assets/photos']) await fs.mkdir(path.join(source, dir), { recursive: true });
  await fs.cp(path.join(root, 'templates'), path.join(source, 'templates'), { recursive: true });
  await fs.writeFile(path.join(source, 'CNAME'), 'ashokmisra.in\n');
  for (const name of ['cover', 'second', 'third', 'single']) await fs.writeFile(path.join(source, `assets/photos/${name}.svg`), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const album = { title: 'An event', image: '/assets/photos/cover.svg', additional_images: ['/assets/photos/third.svg', '/assets/photos/second.svg'], caption: 'Event "caption" </script>', collection: 'western', tags: ['people', 'western'], published: true };
  const single = { title: 'A single photograph', image: '/assets/photos/single.svg', caption: 'A caption', collection: 'jhansi', published: true };
  const save = (id, data) => fs.writeFile(path.join(source, `content/photos/${id}.json`), JSON.stringify(data));
  await save('event', album); await save('single', single);
  await fs.writeFile(path.join(source, 'content/gallery-order.json'), JSON.stringify({ images: [single.image, album.image] }));
  const output = path.join(source, 'dist');
  assert.deepEqual(await buildSite(source, output), { photos: 4, moments: 2, articles: 0, pages: 2 });
  const html = await fs.readFile(path.join(output, 'index.html'), 'utf8');
  const gallery = JSON.parse(html.match(/const GALLERY=(.*);/)[1]);
  assert.deepEqual(gallery.map(p => p.title), [single.title, album.title]);
  assert.deepEqual(gallery[1].images, [album.image, ...album.additional_images]);
  assert.deepEqual(gallery[1].tags, ['western', 'people']);
  assert.deepEqual(gallery[0].images, [single.image]);
  assert.equal(gallery[1].cap, album.caption);
  assert.match(html, /4 photographs across 2 moments/);
  assert.match(html, /data-gallery-filter="people"/);
  assert.doesNotMatch(html, /data-gallery-filter="eastcentral"/);
  assert.doesNotMatch(html, /Event "caption" <\/script>/);
  await save('event', { ...album, published: false });
  assert.equal((await buildSite(source, output)).photos, 1);
  const unpublished = await fs.readFile(path.join(output, 'index.html'), 'utf8');
  assert.doesNotMatch(unpublished, /data-gallery-filter="people"/);
  assert.doesNotMatch(unpublished.match(/const GALLERY=(.*);/)[1], /cover.svg|second.svg|third.svg/);
  await save('event', { ...album, additional_images: [album.image] });
  await assert.rejects(loadContent(source), /same photo more than once/);
  await save('event', { ...album, additional_images: [single.image] });
  await assert.rejects(loadContent(source), /each photo in one event/);
  await save('event', { ...album, tags: ['made-up'] });
  await assert.rejects(loadContent(source), /valid gallery tags/);
  await save('event', { ...album, additional_images: ['/assets/photos/missing.svg'] });
  await assert.rejects(loadContent(source), /image does not exist/);
  await save('event', { ...album, additional_images: null, tags: null });
  assert.deepEqual((await loadContent(source)).photos[1].additional_images, []);
});

test('CMS additions, ordering, safe text, publishing and removal produce a complete site', async t => {
  const source = await fs.mkdtemp(path.join(os.tmpdir(), 'akm-cms-'));
  t.after(() => fs.rm(source, { recursive: true, force: true }));
  const output = path.join(source, 'dist');
  for (const dir of ['content/articles', 'content/photos', 'assets/photos']) await fs.mkdir(path.join(source, dir), { recursive: true });
  await fs.cp(path.join(root, 'templates'), path.join(source, 'templates'), { recursive: true });
  await fs.writeFile(path.join(source, 'CNAME'), 'ashokmisra.in\n');
  for (const name of ['test', 'first', 'hidden', 'later', 'earlier', 'missing']) await fs.writeFile(path.join(source, `assets/photos/${name}.svg`), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const photo = (title, collection, published = true) => ({ title, collection, image: `/assets/photos/${title}.svg`, caption: 'A "caption" </script><script>alert(1)</script>', published });
  const saveOrder = images => fs.writeFile(path.join(source, 'content/gallery-order.json'), JSON.stringify({ images }));
  const saveGallery = async photos => {
    await fs.rm(path.join(source, 'content/photos'), { recursive: true });
    await fs.mkdir(path.join(source, 'content/photos'));
    await Promise.all(photos.map(p => fs.writeFile(path.join(source, `content/photos/${p.title}.json`), JSON.stringify(p))));
  };
  const article = (published, order = 10) => fs.writeFile(path.join(source, 'content/articles/new-reflection.md'), `---\ntitle: 'A "new" & thoughtful article'\nexcerpt: 'An introduction <with> punctuation'\norder: ${order}\npublished: ${published}\n---\n\n## A heading\n\nSome **important** words.\n\n![An image](/assets/photos/test.svg)\n\n<script>alert(1)</script>\n\n[Unsafe](javascript:alert(1))\n`);
  await saveGallery([photo('first', 'jhansi'), photo('hidden', 'other', false), photo('later', 'western')]);
  await saveOrder(['/assets/photos/first.svg', '/assets/photos/hidden.svg', '/assets/photos/later.svg']);
  await article(false);
  await buildSite(source, output);
  let home = await fs.readFile(path.join(output, 'index.html'), 'utf8');
  const gallery = JSON.parse(home.match(/const GALLERY=(.*);/)[1]);
  assert.deepEqual(gallery.map(p => p.collection), ['jhansi', 'western']);
  assert.equal(gallery[0].cap, 'A "caption" </script><script>alert(1)</script>');
  assert.ok(!home.includes('</script><script>alert(1)'));
  assert.match(home, /Showing 2 of 2 photographs/);
  await assert.rejects(fs.access(path.join(output, 'thoughts/new-reflection.html')));
  for (const script of home.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    if (script[1].trim()) assert.doesNotThrow(() => new vm.Script(script[1]));
  }
  // Only the thumbnail order changes; descriptions stay attached to their image.
  await saveOrder(['/assets/photos/later.svg', '/assets/photos/first.svg', '/assets/photos/hidden.svg']);
  await buildSite(source, output);
  home = await fs.readFile(path.join(output, 'index.html'), 'utf8');
  assert.deepEqual(JSON.parse(home.match(/const GALLERY=(.*);/)[1]).map(p => p.collection), ['western', 'jhansi']);
  // New published photographs appear at the end before being added to the grid.
  await fs.writeFile(path.join(source, 'content/photos/earlier.json'), JSON.stringify(photo('earlier', 'other')));
  assert.deepEqual((await loadContent(source)).photos.map(p => p.title), ['later', 'first', 'earlier']);
  await article(true, 5);
  await buildSite(source, output);
  const page = await fs.readFile(path.join(output, 'thoughts/new-reflection.html'), 'utf8');
  assert.match(page, /<h1>A &quot;new&quot; &amp; thoughtful article<\/h1>/);
  assert.match(page, /<article class="reading-body" aria-label="A &quot;new&quot; &amp; thoughtful article"><h2>/);
  assert.match(page, /<h2>A heading<\/h2>/);
  assert.match(page, /<strong>important<\/strong>/);
  assert.match(page, /src="\/assets\/photos\/test.svg"/);
  assert.ok(!page.includes('<script>alert(1)'));
  assert.ok(!page.includes('href="javascript:'));
  assert.match(await fs.readFile(path.join(output, 'thoughts/index.html'), 'utf8'), /1 reflection · An open notebook/);
  assert.match(await fs.readFile(path.join(output, 'index.html'), 'utf8'), /href="\/thoughts\/new-reflection.html"/);
  // A growing homepage rail includes later articles, and reduced-motion illustrations
  // use a real static image rather than relying on SVG fragment state.
  await fs.mkdir(path.join(source, 'assets/illustrations'), { recursive: true });
  for (const name of ['observation', 'learning', 'home-first-school', 'information-and-thinking', 'habits-take-root', 'time-to-learn', 'discipline-and-service', 'beyond-the-rank', 'effort-and-recognition']) await fs.copyFile(path.join(root, `assets/illustrations/${name}.svg`), path.join(source, `assets/illustrations/${name}.svg`));
  for (const [i, name] of ['second', 'third', 'fourth'].entries()) {
    await fs.writeFile(path.join(source, `content/articles/${name}.md`), `---\ntitle: ${name}\nexcerpt: Another reflection\norder: ${20+i}\npublished: true\ncover: /assets/illustrations/observation.svg\ncover_motion: ${i !== 2}\n---\n\nA new article.\n`);
  }
  await buildSite(source, output);
  home = await fs.readFile(path.join(output, 'index.html'), 'utf8');
  for (const name of ['new-reflection', 'second', 'third', 'fourth']) assert.match(home, new RegExp(`href="/thoughts/${name}.html"`));
  assert.equal((home.match(/class="thought-card home-thought"/g) || []).length, 4);
  assert.match(home, /data-cover-still="\/assets\/illustrations\/observation-still.svg"/);
  for (const name of ['observation', 'learning', 'home-first-school', 'information-and-thinking', 'habits-take-root', 'time-to-learn', 'discipline-and-service', 'beyond-the-rank', 'effort-and-recognition']) {
    const still = await fs.readFile(path.join(output, `assets/illustrations/${name}-still.svg`), 'utf8');
    assert.match(still, /<path/);
    assert.doesNotMatch(still, /@keyframes|animation:|<animate/);
  }
  const disabledMotionArticle = await fs.readFile(path.join(output, 'thoughts/fourth.html'), 'utf8');
  assert.match(disabledMotionArticle, /src="\/assets\/illustrations\/observation-still.svg"/);
  assert.doesNotMatch(disabledMotionArticle, /data-cover-motion/);
  await article(false);
  await saveGallery([photo('later', 'other')]);
  await buildSite(source, output);
  await assert.rejects(fs.access(path.join(output, 'thoughts/new-reflection.html')));
  home = await fs.readFile(path.join(output, 'index.html'), 'utf8');
  assert.match(home, /Showing 1 of 1 photographs/);
  assert.equal(JSON.parse(home.match(/const GALLERY=(.*);/)[1])[0].collection, 'other');
  await saveGallery([]);
  await buildSite(source, output);
  assert.match(await fs.readFile(path.join(output, 'index.html'), 'utf8'), /const GALLERY=\[\];/);
  assert.ok(!(await fs.readdir(output)).includes('content'));
  assert.ok(!(await fs.readdir(output)).includes('templates'));
  // Clearing the grid resets ordering without deleting photo records.
  await saveGallery([photo('later', 'western'), photo('first', 'jhansi')]);
  await saveOrder(null);
  assert.deepEqual((await loadContent(source)).photos.map(p => p.title), ['first', 'later']);
  await saveOrder(['/assets/photos/first.svg', '/assets/photos/first.svg']);
  await assert.rejects(loadContent(source), /same photo more than once/);
  await saveOrder([]);
  await saveGallery([photo('missing', 'western')]);
  await fs.rm(path.join(source, 'assets/photos/missing.svg'));
  await assert.rejects(buildSite(source, output), /image does not exist/);
});

test('fitness records publish their distances and keep related photos tied to gallery visibility', async t => {
  const source = await fs.mkdtemp(path.join(os.tmpdir(), 'akm-fitness-'));
  t.after(() => fs.rm(source, { recursive: true, force: true }));
  for (const dir of ['content/articles', 'content/photos', 'assets/photos']) await fs.mkdir(path.join(source, dir), { recursive: true });
  await fs.cp(path.join(root, 'templates'), path.join(source, 'templates'), { recursive: true });
  await fs.writeFile(path.join(source, 'CNAME'), 'ashokmisra.in\n');
  const fitness = JSON.parse(await fs.readFile(path.join(root, 'content/fitness.json'), 'utf8'));
  fitness.cycling_photos = ['/assets/photos/ride.svg', '/assets/photos/unpublished.svg'];
  fitness.running_photos = [];
  const photo = { title: 'A coastal ride', image: '/assets/photos/ride.svg', caption: 'A ride along the seafront.', collection: 'life', published: true };
  const savePhoto = () => fs.writeFile(path.join(source, 'content/photos/ride.json'), JSON.stringify(photo));
  const saveFitness = () => fs.writeFile(path.join(source, 'content/fitness.json'), JSON.stringify(fitness));
  await fs.writeFile(path.join(source, 'content/gallery-order.json'), '{"images":[]}');
  await fs.writeFile(path.join(source, 'assets/photos/ride.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await savePhoto(); await saveFitness();
  const output = path.join(source, 'dist');
  await buildSite(source, output);
  let html = await fs.readFile(path.join(output, 'index.html'), 'utf8');
  assert.match(html, /class="fitness-distance">100<small>km/);
  assert.match(html, /<strong>27 <small>km/);
  assert.match(html, /6 finish lines/);
  assert.match(html, /WDR Run Together/);
  assert.equal((html.match(/data-fitness-photo="/g) || []).length, 1);
  assert.doesNotMatch(html, /unpublished\.svg/);
  photo.published = false;
  await savePhoto(); await buildSite(source, output);
  html = await fs.readFile(path.join(output, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /class="fitness-photo"/);
  assert.match(html, /class="fitness-distance">100<small>km/);
  fitness.cycling_distance = -1; await saveFitness();
  await assert.rejects(buildSite(source, output), /cycling_distance must be positive/);
});
