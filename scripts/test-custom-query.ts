/**
 * Test custom query: Female creators, 25-35, A-roll capable
 */

import {
  buildAgeRangeFormula,
  buildMultipleSelectHasAny,
  combineFormulasAnd
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

async function findCreators() {
  console.log('🔍 Searching for creators with criteria:');
  console.log('  • A-roll capable');
  console.log('  • Female');
  console.log('  • Ages 25-35\n');
  console.log('='.repeat(70));

  // Build age range formula (25-35 spans two ranges: 25-34 and 35-44)
  const ageFormula = buildAgeRangeFormula(
    'Age',
    25,
    35,
    ['12-17', '18-24', '25-34', '35-44', '45-65', '65+']
  );
  console.log('\n📊 Age Formula:', ageFormula);

  // Gender filter - exact match for "She/Her" or similar
  // Let me first check what gender values exist
  const genderFormula = `OR({Gender} = 'She/Her', {Gender} = 'Female', {Gender} = 'she/her')`;
  console.log('📊 Gender Formula:', genderFormula);

  // For A-roll, we need to search Creator Type field
  // "A-roll" might not be a specific type, but B-roll creators do B-roll
  // So let's look for UGC creators (they typically do A-roll)
  // We'll also exclude B-roll specialists
  console.log('\n💡 Note: Searching for UGC creators (typically do A-roll talking head content)');
  console.log('    Excluding pure B-roll creators\n');

  // Actually, let me first explore what creator types we have
  console.log('🔍 First, let me check available creator types...\n');

  // Get metadata to see all creator types
  const metadataUrl = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
  const response = await fetch(metadataUrl, {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  const data = await response.json() as any;
  const rosterTable = data.tables.find((t: any) => t.name === 'Roster');
  const creatorTypeField = rosterTable?.fields.find((f: any) => f.name === 'Creator Type');

  if (creatorTypeField?.options?.choices) {
    console.log('Available Creator Types:');
    creatorTypeField.options.choices.forEach((choice: any) => {
      console.log(`  - ${choice.name}`);
    });
  }

  // Based on the types, UGC Creator is most likely to do A-roll (talking head)
  // But let's be inclusive and search for multiple types
  const creatorTypeFormula = buildMultipleSelectHasAny(
    'Creator Type',
    ['UGC Creator', 'Street Interviewer', 'Podcaster'],
    creatorTypeField?.options?.choices.map((c: any) => c.name) || [],
    true
  );
  console.log('\n📊 Creator Type Formula:', creatorTypeFormula);

  // Combine all conditions
  const finalFormula = combineFormulasAnd(ageFormula, genderFormula, creatorTypeFormula);
  console.log('\n📊 Final Combined Formula:');
  console.log(finalFormula);

  console.log('\n' + '='.repeat(70));
  console.log('🔍 Searching Airtable...\n');

  // Execute the query
  const records = await base('Roster').select({
    filterByFormula: finalFormula,
    maxRecords: 50,
    fields: [
      'Creator Name',
      'First Name',
      'Last Name',
      'Age',
      'Gender',
      'Creator Type',
      'Email',
      'Phone Number',
      'Status',
      'Total # of Clients'
    ]
  }).all();

  console.log(`✅ Found ${records.length} matching creators!\n`);
  console.log('='.repeat(70));

  if (records.length === 0) {
    console.log('\n💡 No exact matches found. Let me try a broader search...\n');

    // Try without creator type filter
    const broaderFormula = combineFormulasAnd(ageFormula, genderFormula);
    console.log('Broader formula (age + gender only):', broaderFormula);

    const broaderRecords = await base('Roster').select({
      filterByFormula: broaderFormula,
      maxRecords: 50,
      fields: [
        'Creator Name',
        'First Name',
        'Last Name',
        'Age',
        'Gender',
        'Creator Type',
        'Email',
        'Status'
      ]
    }).all();

    console.log(`\n✅ Found ${broaderRecords.length} female creators aged 25-35:\n`);

    broaderRecords.slice(0, 20).forEach((record, i) => {
      const fields = record.fields as any;
      const name = fields['Creator Name'] || `${fields['First Name']} ${fields['Last Name']}`;
      const types = Array.isArray(fields['Creator Type']) ? fields['Creator Type'].join(', ') : fields['Creator Type'] || 'None';

      console.log(`\n${i + 1}. ${name}`);
      console.log(`   Age: ${fields['Age']}`);
      console.log(`   Gender: ${fields['Gender']}`);
      console.log(`   Creator Types: ${types}`);
      console.log(`   Status: ${Array.isArray(fields['Status']) ? fields['Status'].join(', ') : fields['Status']}`);
      console.log(`   Email: ${fields['Email']}`);
    });

    if (broaderRecords.length > 20) {
      console.log(`\n   ... and ${broaderRecords.length - 20} more creators`);
    }
  } else {
    // Show detailed results
    records.forEach((record, i) => {
      const fields = record.fields as any;
      const name = fields['Creator Name'] || `${fields['First Name']} ${fields['Last Name']}`;
      const types = Array.isArray(fields['Creator Type']) ? fields['Creator Type'].join(', ') : fields['Creator Type'] || 'None';

      console.log(`\n${i + 1}. ${name}`);
      console.log(`   Age: ${fields['Age']}`);
      console.log(`   Gender: ${fields['Gender']}`);
      console.log(`   Creator Types: ${types}`);
      console.log(`   Status: ${Array.isArray(fields['Status']) ? fields['Status'].join(', ') : fields['Status']}`);
      console.log(`   Clients: ${fields['Total # of Clients'] || 0}`);
      console.log(`   Email: ${fields['Email']}`);
      if (fields['Phone Number']) {
        console.log(`   Phone: ${fields['Phone Number']}`);
      }
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Query completed!\n');
}

findCreators().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
