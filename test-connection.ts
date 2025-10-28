/**
 * Test script to verify Airtable connection and explore base structure
 */

import Airtable from 'airtable';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;

if (!apiKey || !baseId) {
  console.error('❌ Error: AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set in .env');
  process.exit(1);
}

console.log('🔑 API Key:', apiKey.substring(0, 10) + '...');
console.log('🗄️  Base ID:', baseId);
console.log('');

// Configure Airtable
Airtable.configure({ apiKey });
const base = Airtable.base(baseId);

async function testConnection() {
  try {
    console.log('🔍 Testing connection to Airtable...\n');

    // We'll try to access the Metadata API to get table information
    // For now, let's try a few common table names
    const commonTableNames = [
      'Projects', 'Tasks', 'Contacts', 'Companies', 'Leads',
      'Customers', 'Orders', 'Inventory', 'Notes', 'Events',
      'Table 1', 'Main Table', 'Data'
    ];

    const foundTables: string[] = [];
    const tableInfo: Array<{name: string, recordCount: number, sampleFields: string[]}> = [];

    console.log('📋 Searching for tables...\n');

    for (const tableName of commonTableNames) {
      try {
        const records = await base(tableName).select({ maxRecords: 1 }).firstPage();

        if (records.length > 0) {
          foundTables.push(tableName);
          const fields = Object.keys(records[0].fields);

          // Get total count
          const allRecords = await base(tableName).select({ maxRecords: 100 }).firstPage();

          tableInfo.push({
            name: tableName,
            recordCount: allRecords.length,
            sampleFields: fields
          });
        }
      } catch (err) {
        // Table doesn't exist, continue
      }
    }

    if (foundTables.length === 0) {
      console.log('⚠️  No common table names found. Let me try to get metadata...\n');

      // Try using the Metadata API
      try {
        const metadataUrl = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
        const response = await fetch(metadataUrl, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });

        if (response.ok) {
          const data = await response.json() as any;
          console.log('✅ Successfully retrieved base metadata!\n');
          console.log('📊 Tables in your base:\n');

          for (const table of data.tables) {
            console.log(`\n🔹 Table: ${table.name} (ID: ${table.id})`);
            console.log(`   Fields (${table.fields.length}):`);

            for (const field of table.fields.slice(0, 10)) {
              console.log(`   - ${field.name} (${field.type})`);
              if (field.options?.choices) {
                const choices = field.options.choices.map((c: any) => c.name).join(', ');
                console.log(`     Choices: ${choices}`);
              }
            }

            if (table.fields.length > 10) {
              console.log(`   ... and ${table.fields.length - 10} more fields`);
            }

            // Get sample records from this table
            try {
              const sampleRecords = await base(table.name).select({ maxRecords: 3 }).firstPage();
              console.log(`   Sample records: ${sampleRecords.length} found`);

              if (sampleRecords.length > 0) {
                console.log('\n   📝 Sample record:');
                console.log(JSON.stringify(sampleRecords[0].fields, null, 2));
              }
            } catch (err) {
              console.log(`   ⚠️  Could not fetch sample records`);
            }
          }
        } else {
          console.log('❌ Could not retrieve metadata:', response.statusText);
          console.log('\nPlease provide a table name from your base to test with.');
        }
      } catch (metaErr) {
        console.log('❌ Error accessing metadata API:', metaErr);
        console.log('\nPlease provide a table name from your base to test with.');
      }
    } else {
      console.log('✅ Successfully connected to Airtable!\n');
      console.log(`📊 Found ${foundTables.length} table(s):\n`);

      for (const info of tableInfo) {
        console.log(`\n🔹 Table: ${info.name}`);
        console.log(`   Records found: ~${info.recordCount}+`);
        console.log(`   Fields (${info.sampleFields.length}):`);
        info.sampleFields.forEach(field => {
          console.log(`   - ${field}`);
        });

        // Get a sample record to show the data
        const sample = await base(info.name).select({ maxRecords: 1 }).firstPage();
        if (sample.length > 0) {
          console.log('\n   📝 Sample record:');
          console.log(JSON.stringify(sample[0].fields, null, 2));
        }
      }
    }

    console.log('\n\n✅ Connection test completed successfully!');
    console.log('\nYou can now use the MCP server with Claude Desktop.');

  } catch (error) {
    console.error('\n❌ Error during connection test:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
    }
    process.exit(1);
  }
}

testConnection();
