import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

const cmsDataDir = path.join(process.cwd(), 'cms-data');
const dbPath = path.join(cmsDataDir, 'cms.db');

// Read JSON files
const pagesJson = JSON.parse(fs.readFileSync(path.join(cmsDataDir, 'pages.json'), 'utf-8'));
const mediaJson = JSON.parse(fs.readFileSync(path.join(cmsDataDir, 'media-index.json'), 'utf-8'));
const settingsJson = JSON.parse(fs.readFileSync(path.join(cmsDataDir, 'settings.json'), 'utf-8'));

// Initialize database connection
const db = new Database(dbPath);

console.log('Starting migration to SQLite...\n');

// Clear existing data
console.log('Clearing existing data...');
db.exec('DELETE FROM pages');
db.exec('DELETE FROM media');
db.exec('DELETE FROM settings');

// Migrate pages
console.log('\nMigrating pages...');
const insertPage = db.prepare(`
  INSERT INTO pages (id, title, slug, description, category, status, blocks, seo, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const migratePages = db.transaction((pages) => {
  for (const page of pages) {
    // Convert old block format to new format if needed
    const blocks = page.blocks.map((block: any, index: number) => ({
      id: block.id || `block-${index}`,
      type: block.type,
      order: index + 1,
      props: block.content || block.props || {}
    }));

    const now = new Date().toISOString();
    
    insertPage.run(
      page.id,
      page.title,
      page.slug,
      page.description || page.title,
      (page.category || 'main').toLowerCase(),
      page.status || 'published',
      JSON.stringify(blocks),
      JSON.stringify(page.seo || {
        title: page.title,
        description: page.description || page.title
      }),
      page.createdAt || now,
      page.updatedAt || now
    );
    
    console.log(`  ✓ Migrated page: ${page.title} (${page.slug})`);
  }
});

migratePages(pagesJson);

// Migrate media
console.log('\nMigrating media...');
const insertMedia = db.prepare(`
  INSERT INTO media (id, filename, url, size, type, uploadedAt)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const migrateMedia = db.transaction((mediaItems) => {
  for (const media of mediaItems) {
    insertMedia.run(
      media.id,
      media.filename || media.name,
      media.url || media.path,
      media.size || 0,
      media.type || media.mimeType || 'image/jpeg',
      media.uploadedAt || new Date().toISOString()
    );
    
    console.log(`  ✓ Migrated media: ${media.filename || media.name}`);
  }
});

if (Array.isArray(mediaJson)) {
  migrateMedia(mediaJson);
} else if (mediaJson.files && Array.isArray(mediaJson.files)) {
  migrateMedia(mediaJson.files);
}

// Migrate settings
console.log('\nMigrating settings...');
const insertSetting = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
`);

insertSetting.run('siteSettings', JSON.stringify(settingsJson));
console.log('  ✓ Migrated site settings');

// Verify migration
const pageCount = db.prepare('SELECT COUNT(*) as count FROM pages').get() as { count: number };
const mediaCount = db.prepare('SELECT COUNT(*) as count FROM media').get() as { count: number };
const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };

console.log('\n=== Migration Complete ===');
console.log(`Pages migrated: ${pageCount.count}`);
console.log(`Media items migrated: ${mediaCount.count}`);
console.log(`Settings migrated: ${settingsCount.count}`);

// Close database
db.close();

console.log('\n✓ Database closed successfully');
console.log('\nYou can now delete the JSON files or keep them as backup.');
