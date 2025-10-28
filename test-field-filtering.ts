/**
 * Test field filtering to prevent large responses
 */

import Airtable from 'airtable';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { AirtableClient } from './src/utils/airtable-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const apiKey = process.env.AIRTABLE_API_KEY!;
const baseId = process.env.AIRTABLE_BASE_ID!;

const client = new AirtableClient({ apiKey, baseId });

async function testFieldFiltering() {
  console.log('🧪 Testing Field Filtering\n');
  console.log('='.repeat(70));

  // Test 1: No filtering (all fields - might be huge!)
  console.log('\n📊 Test 1: No filtering (all fields - WARNING: Large!)');
  console.log('-'.repeat(70));

  const records1 = await client.listRecords('Roster', {
    maxRecords: 1,
    excludeAttachments: false,
    excludeLongText: false
  });

  console.log(`\n✅ Retrieved 1 record with ALL fields`);
  console.log(`   Field count: ${Object.keys(records1[0].fields).length}`);
  console.log(`   Fields: ${Object.keys(records1[0].fields).join(', ')}`);

  // Calculate approximate size
  const jsonSize = JSON.stringify(records1).length;
  console.log(`   Approximate JSON size: ${(jsonSize / 1024).toFixed(2)} KB`);

  // Test 2: Exclude attachments (recommended)
  console.log('\n\n📊 Test 2: Exclude Attachments (RECOMMENDED for Claude Desktop)');
  console.log('-'.repeat(70));

  const records2 = await client.listRecords('Roster', {
    maxRecords: 1,
    excludeAttachments: true
  });

  console.log(`\n✅ Retrieved 1 record without attachments`);
  console.log(`   Field count: ${Object.keys(records2[0].fields).length}`);
  const jsonSize2 = JSON.stringify(records2).length;
  console.log(`   Approximate JSON size: ${(jsonSize2 / 1024).toFixed(2)} KB`);
  console.log(`   Size reduction: ${((1 - jsonSize2 / jsonSize) * 100).toFixed(1)}%`);

  // Test 3: Exclude attachments AND long text
  console.log('\n\n📊 Test 3: Exclude Attachments + Long Text');
  console.log('-'.repeat(70));

  const records3 = await client.listRecords('Roster', {
    maxRecords: 1,
    excludeAttachments: true,
    excludeLongText: true
  });

  console.log(`\n✅ Retrieved 1 record without attachments or long text`);
  console.log(`   Field count: ${Object.keys(records3[0].fields).length}`);
  const jsonSize3 = JSON.stringify(records3).length;
  console.log(`   Approximate JSON size: ${(jsonSize3 / 1024).toFixed(2)} KB`);
  console.log(`   Size reduction: ${((1 - jsonSize3 / jsonSize) * 100).toFixed(1)}%`);

  // Test 4: Use "contact" preset
  console.log('\n\n📊 Test 4: Use "contact" preset');
  console.log('-'.repeat(70));

  const records4 = await client.listRecords('Roster', {
    maxRecords: 1,
    preset: 'contact'
  });

  console.log(`\n✅ Retrieved 1 record with contact preset`);
  console.log(`   Field count: ${Object.keys(records4[0].fields).length}`);
  console.log(`   Fields: ${Object.keys(records4[0].fields).join(', ')}`);
  const jsonSize4 = JSON.stringify(records4).length;
  console.log(`   Approximate JSON size: ${(jsonSize4 / 1024).toFixed(2)} KB`);
  console.log(`   Size reduction: ${((1 - jsonSize4 / jsonSize) * 100).toFixed(1)}%`);

  // Test 5: Use "summary" preset
  console.log('\n\n📊 Test 5: Use "summary" preset');
  console.log('-'.repeat(70));

  const records5 = await client.listRecords('Roster', {
    maxRecords: 1,
    preset: 'summary'
  });

  console.log(`\n✅ Retrieved 1 record with summary preset`);
  console.log(`   Field count: ${Object.keys(records5[0].fields).length}`);
  console.log(`   Fields: ${Object.keys(records5[0].fields).join(', ')}`);
  const jsonSize5 = JSON.stringify(records5).length;
  console.log(`   Approximate JSON size: ${(jsonSize5 / 1024).toFixed(2)} KB`);
  console.log(`   Size reduction: ${((1 - jsonSize5 / jsonSize) * 100).toFixed(1)}%`);

  // Test 6: Exclude specific fields
  console.log('\n\n📊 Test 6: Exclude specific fields manually');
  console.log('-'.repeat(70));

  const records6 = await client.listRecords('Roster', {
    maxRecords: 1,
    excludeFields: ['Headshot', 'Samples', 'Living Room photos', 'Bathroom photos', 'Current Setup photos', 'Home Photos', 'Feedback']
  });

  console.log(`\n✅ Retrieved 1 record with manual exclusions`);
  console.log(`   Field count: ${Object.keys(records6[0].fields).length}`);
  const jsonSize6 = JSON.stringify(records6).length;
  console.log(`   Approximate JSON size: ${(jsonSize6 / 1024).toFixed(2)} KB`);
  console.log(`   Size reduction: ${((1 - jsonSize6 / jsonSize) * 100).toFixed(1)}%`);

  // Test 7: Multiple records with safe filtering
  console.log('\n\n📊 Test 7: 10 Records with excludeAttachments=true');
  console.log('-'.repeat(70));

  const records7 = await client.listRecords('Roster', {
    maxRecords: 10,
    excludeAttachments: true
  });

  console.log(`\n✅ Retrieved ${records7.length} records without attachments`);
  const jsonSize7 = JSON.stringify(records7).length;
  console.log(`   Total JSON size: ${(jsonSize7 / 1024).toFixed(2)} KB`);
  console.log(`   Average per record: ${(jsonSize7 / records7.length / 1024).toFixed(2)} KB`);

  console.log('\n\n' + '='.repeat(70));
  console.log('✅ All field filtering tests completed!');
  console.log('='.repeat(70));

  console.log('\n💡 Recommendations for Claude Desktop:');
  console.log('  ✅ ALWAYS use excludeAttachments=true (default)');
  console.log('  ✅ Use preset="summary" for most queries');
  console.log('  ✅ Use preset="contact" when you only need contact info');
  console.log('  ✅ Specify exact fields when you know what you need');
  console.log('  ⚠️  Avoid fetching all fields - will cause timeouts!');
  console.log('\n');
}

testFieldFiltering().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
