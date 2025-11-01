/**
 * Test the age range query functionality
 */

import { buildAgeRangeFormula, findOverlappingAgeRanges } from './src/utils/query-helpers.js';
import Airtable from 'airtable';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const apiKey = process.env.AIRTABLE_API_KEY!;
const baseId = process.env.AIRTABLE_BASE_ID!;

Airtable.configure({ apiKey });
const base = Airtable.base(baseId);

const availableAgeRanges = ['12-17', '18-24', '25-34', '35-44', '45-65', '65+'];

async function testAgeQuery() {
  console.log('🧪 Testing Age Range Query\n');
  console.log('='.repeat(60));

  // Test 1: Query for ages 29-42
  console.log('\n📊 Test 1: Find creators aged 29-42');
  console.log('-'.repeat(60));

  const minAge1 = 29;
  const maxAge1 = 42;

  const overlapping1 = findOverlappingAgeRanges(minAge1, maxAge1, availableAgeRanges);
  console.log(`\nAge range ${minAge1}-${maxAge1} overlaps with:`);
  overlapping1.forEach(range => console.log(`  ✓ ${range}`));

  const formula1 = buildAgeRangeFormula('Age', minAge1, maxAge1, availableAgeRanges);
  console.log(`\nGenerated Airtable formula:`);
  console.log(`  ${formula1}`);

  console.log(`\nQuerying Airtable...`);
  const records1 = await base('Roster').select({
    filterByFormula: formula1,
    maxRecords: 10,
    fields: ['Creator Name', 'First Name', 'Last Name', 'Age', 'Email']
  }).all();

  console.log(`\n✅ Found ${records1.length} creators`);
  records1.forEach((record, i) => {
    const fields = record.fields as any;
    console.log(`\n  ${i + 1}. ${fields['Creator Name'] || fields['First Name'] + ' ' + fields['Last Name']}`);
    console.log(`     Age: ${fields.Age}`);
    console.log(`     Email: ${fields.Email}`);
  });

  // Test 2: Query for younger creators (18-24)
  console.log('\n\n📊 Test 2: Find creators aged 18-24');
  console.log('-'.repeat(60));

  const minAge2 = 18;
  const maxAge2 = 24;

  const overlapping2 = findOverlappingAgeRanges(minAge2, maxAge2, availableAgeRanges);
  console.log(`\nAge range ${minAge2}-${maxAge2} overlaps with:`);
  overlapping2.forEach(range => console.log(`  ✓ ${range}`));

  const formula2 = buildAgeRangeFormula('Age', minAge2, maxAge2, availableAgeRanges);
  console.log(`\nGenerated Airtable formula:`);
  console.log(`  ${formula2}`);

  console.log(`\nQuerying Airtable...`);
  const records2 = await base('Roster').select({
    filterByFormula: formula2,
    maxRecords: 10,
    fields: ['Creator Name', 'First Name', 'Last Name', 'Age', 'Email']
  }).all();

  console.log(`\n✅ Found ${records2.length} creators`);
  records2.slice(0, 5).forEach((record, i) => {
    const fields = record.fields as any;
    console.log(`\n  ${i + 1}. ${fields['Creator Name'] || fields['First Name'] + ' ' + fields['Last Name']}`);
    console.log(`     Age: ${fields.Age}`);
    console.log(`     Email: ${fields.Email}`);
  });

  if (records2.length > 5) {
    console.log(`\n  ... and ${records2.length - 5} more`);
  }

  // Test 3: Query for ages spanning multiple ranges (25-50)
  console.log('\n\n📊 Test 3: Find creators aged 25-50');
  console.log('-'.repeat(60));

  const minAge3 = 25;
  const maxAge3 = 50;

  const overlapping3 = findOverlappingAgeRanges(minAge3, maxAge3, availableAgeRanges);
  console.log(`\nAge range ${minAge3}-${maxAge3} overlaps with:`);
  overlapping3.forEach(range => console.log(`  ✓ ${range}`));

  const formula3 = buildAgeRangeFormula('Age', minAge3, maxAge3, availableAgeRanges);
  console.log(`\nGenerated Airtable formula:`);
  console.log(`  ${formula3}`);

  console.log(`\nQuerying Airtable...`);
  const records3 = await base('Roster').select({
    filterByFormula: formula3,
    maxRecords: 10,
    fields: ['Creator Name', 'First Name', 'Last Name', 'Age', 'Email']
  }).all();

  console.log(`\n✅ Found ${records3.length} creators`);
  records3.slice(0, 5).forEach((record, i) => {
    const fields = record.fields as any;
    console.log(`\n  ${i + 1}. ${fields['Creator Name'] || fields['First Name'] + ' ' + fields['Last Name']}`);
    console.log(`     Age: ${fields.Age}`);
  });

  if (records3.length > 5) {
    console.log(`\n  ... and ${records3.length - 5} more`);
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('✅ All age range query tests completed successfully!');
  console.log('='.repeat(60));
}

testAgeQuery().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
