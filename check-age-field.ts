/**
 * Check Age field options in Roster table
 */

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

async function checkAgeField() {
  try {
    // Get table metadata
    const metadataUrl = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
    const response = await fetch(metadataUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const data = await response.json() as any;
    const rosterTable = data.tables.find((t: any) => t.name === 'Roster');

    if (!rosterTable) {
      console.log('Roster table not found');
      return;
    }

    const ageField = rosterTable.fields.find((f: any) => f.name === 'Age');

    if (!ageField) {
      console.log('Age field not found');
      return;
    }

    console.log('Age Field Information:');
    console.log('Type:', ageField.type);
    console.log('\nOptions:');

    if (ageField.options?.choices) {
      console.log('Available age ranges:');
      ageField.options.choices.forEach((choice: any) => {
        console.log(`  - ${choice.name}`);
      });
    } else {
      console.log('No choices found (might be a different field type)');
    }

    console.log('\n\nFull field data:');
    console.log(JSON.stringify(ageField, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

checkAgeField();
