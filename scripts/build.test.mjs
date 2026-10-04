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
  for (const collection of config.content) {
    assert.ok(collection.fields.some(field => field.name === 'order'));
    const entries = collection.name === 'gallery' ? photos : articles;
    for (const entry of entries) for (const field of collection.fields.filter(f => f.required)) {
      assert.notEqual(entry[field.name], undefined, `${entry.id}: missing ${field.name}`);
    }
  }
});

test('CMS additions, ordering, safe text, publishing and removal produce a complete site', async t => {
  const source = await fs.mkdtemp(path.join(os.tmpdir(), 'akm-cms-'));
  t.after(() => fs.rm(source, { recursive: true, force: true }));
  const output = path.join(source, 'dist');
  for (const dir of ['content/gallery', 'content/articles', 'assets/photos']) await fs.mkdir(path.join(source, dir), { recursive: true });
  await fs.cp(path.join(root, 'templates'), path.join(source, 'templates'), { recursive: true });
  await fs.writeFile(path.join(source, 'CNAME'), 'ashokmisra.in\n');
  await fs.writeFile(path.join(source, 'assets/photos/test.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const photo = (id, order, collection) => fs.writeFile(path.join(source, `content/gallery/${id}.json`), JSON.stringify({ title: id, order, collection, image: '/assets/photos/test.svg', caption: 'A "caption" </script><script>alert(1)</script>', published: true }));
  const article = (published, order = 10) => fs.writeFile(path.join(source, 'content/articles/new-reflection.md'), `---\ntitle: 'A "new" & thoughtful article'\nexcerpt: 'An introduction <with> punctuation'\norder: ${order}\npublished: ${published}\n---\n\n## A heading\n\nSome **important** words.\n\n![An image](/assets/photos/test.svg)\n\n<script>alert(1)</script>\n\n[Unsafe](javascript:alert(1))\n`);
  await photo('later', 30, 'western');
  await photo('first', 10, 'jhansi');
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
  await article(false);
  await fs.rm(path.join(source, 'content/gallery/first.json'));
  await photo('later', 1, 'other');
  await buildSite(source, output);
  await assert.rejects(fs.access(path.join(output, 'thoughts/new-reflection.html')));
  home = await fs.readFile(path.join(output, 'index.html'), 'utf8');
  assert.match(home, /Showing 1 of 1 photographs/);
  assert.equal(JSON.parse(home.match(/const GALLERY=(.*);/)[1])[0].collection, 'other');
  await fs.rm(path.join(source, 'content/gallery/later.json'));
  await buildSite(source, output);
  assert.match(await fs.readFile(path.join(output, 'index.html'), 'utf8'), /const GALLERY=\[\];/);
  assert.ok(!(await fs.readdir(output)).includes('content'));
  assert.ok(!(await fs.readdir(output)).includes('templates'));
  await photo('missing', 1, 'western');
  await fs.rm(path.join(source, 'assets/photos/test.svg'));
  await assert.rejects(buildSite(source, output), /image does not exist/);
});
