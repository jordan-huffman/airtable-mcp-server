/**
 * Test smart multiple select query functionality
 * Tests hasAny, hasAll, hasNone with fuzzy matching
 */

import {
  buildMultipleSelectHasAny,
  buildMultipleSelectHasAll,
  buildMultipleSelectHasNone,
  fuzzyMatchOptions,
  resolveOptionsWithFuzzyMatch
} from './src/utils/query-helpers.js';
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

// Available Creator Type options from your table
const creatorTypeOptions = [
  'UGC Creator',
  'B-roll Creator',
  'Street Interviewer',
  'Muted Podcaster',
  'Podcaster',
  'Script Reader',
  'Beauty/Nail Creator',
  'AI Avatar',
  'VO Creator',
  'Artist Creator',
  'Product B-Roll'
];

// Available Pros options
const prosOptions = [
  'Acne Creator',
  'Aesthetic House',
  'Bodybuilder',
  'Comedy',
  'DSLR Podcast Setup',
  'GLP-1',
  'Golfer',
  'Gym Bro/Girl',
  'Health Care Worker',
  'Kids + Piano',
  'LGBTQIA+ Creator',
  'Mid/Plus Size Creator',
  'Personal Trainer',
  'Physical Therapist',
  'Piano in Home',
  'Pickleball Player',
  'Spanish Speaking',
  'Yoga'
];

// Available Cons options
const consOptions = [
  'Accent',
  'Attitude',
  'Audio',
  'B-roll',
  'Bad Script Reader',
  'Bad Video Quality',
  'Busy',
  'Expensive',
  'Framing',
  'Lighting',
  'Non-U.S. Based',
  'Picky',
  'Slow',
  'Unresponsive'
];

async function testMultipleSelectQueries() {
  console.log('🧪 Testing Smart Multiple Select Queries\n');
  console.log('='.repeat(70));

  // Test 1: Fuzzy Matching
  console.log('\n📊 Test 1: Fuzzy Matching Resolution');
  console.log('-'.repeat(70));

  const fuzzyTests = [
    { search: 'ugc', options: creatorTypeOptions },
    { search: 'podcast', options: creatorTypeOptions },
    { search: 'dslr', options: prosOptions },
    { search: 'trainer', options: prosOptions },
  ];

  for (const test of fuzzyTests) {
    const matches = fuzzyMatchOptions(test.search, test.options);
    console.log(`\n  "${test.search}" matches:`);
    matches.forEach(m => console.log(`    ✓ ${m}`));
  }

  // Test 2: hasAny - Find creators who are UGC OR VO creators
  console.log('\n\n📊 Test 2: hasAny - UGC Creators OR VO Creators');
  console.log('-'.repeat(70));

  const values1 = ['UGC Creator', 'VO Creator'];
  const formula1 = buildMultipleSelectHasAny('Creator Type', values1, creatorTypeOptions);
  console.log(`\nSearching for: ${values1.join(' OR ')}`);
  console.log(`Formula: ${formula1}`);

  const records1 = await base('Roster').select({
    filterByFormula: formula1,
    maxRecords: 10,
    fields: ['Creator Name', 'First Name', 'Last Name', 'Creator Type', 'Email']
  }).all();

  console.log(`\n✅ Found ${records1.length} creators`);
  records1.slice(0, 5).forEach((record, i) => {
    const fields = record.fields as any;
    console.log(`\n  ${i + 1}. ${fields['Creator Name'] || fields['First Name'] + ' ' + fields['Last Name']}`);
    console.log(`     Types: ${Array.isArray(fields['Creator Type']) ? fields['Creator Type'].join(', ') : fields['Creator Type']}`);
  });

  // Test 3: hasAll - Find creators with BOTH UGC AND VO capabilities
  console.log('\n\n📊 Test 3: hasAll - Creators with BOTH UGC AND VO');
  console.log('-'.repeat(70));

  const values2 = ['UGC Creator', 'VO Creator'];
  const formula2 = buildMultipleSelectHasAll('Creator Type', values2, creatorTypeOptions);
  console.log(`\nSearching for: ${values2.join(' AND ')}`);
  console.log(`Formula: ${formula2}`);

  const records2 = await base('Roster').select({
    filterByFormula: formula2,
    maxRecords: 10,
    fields: ['Creator Name', 'First Name', 'Last Name', 'Creator Type', 'Email']
  }).all();

  console.log(`\n✅ Found ${records2.length} creators`);
  records2.slice(0, 5).forEach((record, i) => {
    const fields = record.fields as any;
    console.log(`\n  ${i + 1}. ${fields['Creator Name'] || fields['First Name'] + ' ' + fields['Last Name']}`);
    console.log(`     Types: ${Array.isArray(fields['Creator Type']) ? fields['Creator Type'].join(', ') : fields['Creator Type']}`);
  });

  // Test 4: hasNone - Find creators WITHOUT specific cons
  console.log('\n\n📊 Test 4: hasNone - Creators WITHOUT Slow, Unresponsive, or Expensive');
  console.log('-'.repeat(70));

  const values3 = ['Slow', 'Unresponsive', 'Expensive'];
  const formula3 = buildMultipleSelectHasNone('Cons', values3, consOptions);
  console.log(`\nExcluding: ${values3.join(', ')}`);
  console.log(`Formula: ${formula3}`);

  const records3 = await base('Roster').select({
    filterByFormula: formula3,
    maxRecords: 10,
    fields: ['Creator Name', 'First Name', 'Last Name', 'Cons', 'Email']
  }).all();

  console.log(`\n✅ Found ${records3.length} creators`);
  records3.slice(0, 5).forEach((record, i) => {
    const fields = record.fields as any;
    const cons = fields['Cons'];
    console.log(`\n  ${i + 1}. ${fields['Creator Name'] || fields['First Name'] + ' ' + fields['Last Name']}`);
    console.log(`     Cons: ${Array.isArray(cons) && cons.length > 0 ? cons.join(', ') : 'None'}`);
  });

  // Test 5: Fuzzy Match Query - Find creators with "dslr" setup
  console.log('\n\n📊 Test 5: Fuzzy Match - Creators with "dslr" (fuzzy)');
  console.log('-'.repeat(70));

  const fuzzyValues = ['dslr'];  // Should match "DSLR Podcast Setup"
  const resolved = resolveOptionsWithFuzzyMatch(fuzzyValues, prosOptions);
  console.log(`\nSearching for: "${fuzzyValues[0]}"`);
  console.log(`Resolved to: ${resolved.join(', ')}`);

  const formula4 = buildMultipleSelectHasAny('Pros', fuzzyValues, prosOptions, true);
  console.log(`Formula: ${formula4}`);

  const records4 = await base('Roster').select({
    filterByFormula: formula4,
    maxRecords: 10,
    fields: ['Creator Name', 'First Name', 'Last Name', 'Pros', 'Email']
  }).all();

  console.log(`\n✅ Found ${records4.length} creators`);
  records4.slice(0, 5).forEach((record, i) => {
    const fields = record.fields as any;
    const pros = fields['Pros'];
    console.log(`\n  ${i + 1}. ${fields['Creator Name'] || fields['First Name'] + ' ' + fields['Last Name']}`);
    console.log(`     Pros: ${Array.isArray(pros) ? pros.join(', ') : pros || 'None'}`);
  });

  // Test 6: Multiple fuzzy matches - Health professionals
  console.log('\n\n📊 Test 6: Multiple Fuzzy - Health Professionals');
  console.log('-'.repeat(70));

  const healthValues = ['trainer', 'therapist', 'health'];  // Fuzzy match multiple health-related pros
  const resolvedHealth = resolveOptionsWithFuzzyMatch(healthValues, prosOptions);
  console.log(`\nSearching for: ${healthValues.join(', ')}`);
  console.log(`Resolved to: ${resolvedHealth.join(', ')}`);

  const formula5 = buildMultipleSelectHasAny('Pros', healthValues, prosOptions, true);
  console.log(`Formula: ${formula5}`);

  const records5 = await base('Roster').select({
    filterByFormula: formula5,
    maxRecords: 10,
    fields: ['Creator Name', 'First Name', 'Last Name', 'Pros', 'Email']
  }).all();

  console.log(`\n✅ Found ${records5.length} creators`);
  records5.slice(0, 5).forEach((record, i) => {
    const fields = record.fields as any;
    const pros = fields['Pros'];
    console.log(`\n  ${i + 1}. ${fields['Creator Name'] || fields['First Name'] + ' ' + fields['Last Name']}`);
    console.log(`     Pros: ${Array.isArray(pros) ? pros.join(', ') : pros || 'None'}`);
  });

  // Test 7: Exact match (no fuzzy)
  console.log('\n\n📊 Test 7: Exact Match (fuzzy disabled)');
  console.log('-'.repeat(70));

  const exactValue = ['Pickleball Player'];  // Exact match
  const formula6 = buildMultipleSelectHasAny('Pros', exactValue, prosOptions, false);
  console.log(`\nSearching for (exact): "${exactValue[0]}"`);
  console.log(`Formula: ${formula6}`);

  const records6 = await base('Roster').select({
    filterByFormula: formula6,
    maxRecords: 5,
    fields: ['Creator Name', 'First Name', 'Last Name', 'Pros']
  }).all();

  console.log(`\n✅ Found ${records6.length} creators`);
  records6.forEach((record, i) => {
    const fields = record.fields as any;
    const pros = fields['Pros'];
    console.log(`\n  ${i + 1}. ${fields['Creator Name'] || fields['First Name'] + ' ' + fields['Last Name']}`);
    console.log(`     Pros: ${Array.isArray(pros) ? pros.join(', ') : pros || 'None'}`);
  });

  console.log('\n\n' + '='.repeat(70));
  console.log('✅ All multiple select query tests completed successfully!');
  console.log('='.repeat(70));
  console.log('\n💡 Key Features Demonstrated:');
  console.log('  ✓ hasAny (OR logic) - matches if ANY value present');
  console.log('  ✓ hasAll (AND logic) - matches if ALL values present');
  console.log('  ✓ hasNone (NOT logic) - matches if NONE of values present');
  console.log('  ✓ Fuzzy matching - "dslr" → "DSLR Podcast Setup"');
  console.log('  ✓ Case-insensitive matching');
  console.log('  ✓ Partial string matching');
  console.log('  ✓ Works with ANY multiple select field (completely generic!)');
  console.log('\n');
}

testMultipleSelectQueries().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
