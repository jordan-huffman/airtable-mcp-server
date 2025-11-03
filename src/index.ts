#!/usr/bin/env node

/**
 * Enhanced Airtable MCP Server
 * Supports all Airtable field types including single select, dates, formulas, etc.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { ZodSchema } from 'zod';
import { AirtableClient } from './utils/airtable-client.js';
import { AirtableConfig } from './types/airtable.js';
import {
  buildAgeRangeFormula,
  buildMultipleSelectHasAny,
  buildMultipleSelectHasAll,
  buildMultipleSelectHasNone,
  buildNumberRangeFormula,
  combineFormulasAnd,
  combineFormulasOr
} from './utils/query-helpers.js';
import {
  listRecordsSchema,
  getRecordSchema,
  createRecordSchema,
  updateRecordSchema,
  deleteRecordSchema,
  setTableSchemaSchema,
  queryByAgeRangeSchema,
  queryMultipleSelectSchema,
  smartQuerySchema,
  listTablesSchema,
  getTableSchemaSchema,
  batchCreateRecordsSchema,
  batchUpdateRecordsSchema,
  batchDeleteRecordsSchema
} from './validation/tool-schemas.js';
import {
  ValidationError,
  wrapError,
  AuthenticationError
} from './utils/errors.js';
import {
  logger,
  logError,
  logSecurityEvent
} from './utils/logger.js';

// Get configuration from environment variables
// Note: In extension mode, these env vars are set by Claude Desktop from user config
function getConfig(): AirtableConfig {
  return {
    apiKey: process.env.AIRTABLE_PAT || '',
    baseId: process.env.AIRTABLE_BASE_ID || ''
  };
}

// Validate configuration format
function validateConfig(config: AirtableConfig): void {
  // Validate PAT is provided
  if (!config.apiKey) {
    throw new AuthenticationError('Missing AIRTABLE_PAT environment variable. Please configure your Personal Access Token.');
  }

  // Validate PAT format
  if (!config.apiKey.startsWith('pat')) {
    throw new AuthenticationError('Invalid token format. Expected Personal Access Token starting with "pat". Legacy API keys are no longer supported.');
  }

  if (config.apiKey.length < 20) {
    throw new AuthenticationError('Invalid AIRTABLE_PAT format - token appears too short.');
  }

  // Base ID is optional - PAT can access multiple bases
  if (config.baseId) {
    // Validate base ID format if provided
    if (!config.baseId.startsWith('app') || config.baseId.length !== 17) {
      throw new AuthenticationError('Invalid AIRTABLE_BASE_ID format. Expected format: appXXXXXXXXXXXXXX');
    }
  }
}

let client: AirtableClient;

/**
 * Validate API credentials by making a test request to Airtable
 */
async function validateCredentials(config: AirtableConfig): Promise<void> {
  try {
    logger.info('Validating Airtable Personal Access Token...');

    if (!config.baseId) {
      // For PAT without base ID, validate by listing accessible bases
      const basesUrl = 'https://api.airtable.com/v0/meta/bases';
      const response = await fetch(basesUrl, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new AuthenticationError('Invalid Personal Access Token');
        } else {
          throw new Error(`PAT validation failed with status ${response.status}`);
        }
      }

      const data = await response.json() as any;
      logger.info(`PAT validated successfully. You have access to ${data.bases?.length || 0} bases.`);
    } else {
      // For PAT with base ID configured, validate specific base access
      const metadataUrl = `https://api.airtable.com/v0/meta/bases/${config.baseId}/tables`;
      const response = await fetch(metadataUrl, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new AuthenticationError('Invalid Personal Access Token');
        } else if (response.status === 404) {
          throw new AuthenticationError(`Base not found: ${config.baseId}`);
        } else if (response.status === 403) {
          throw new AuthenticationError(`No access to base: ${config.baseId}`);
        } else {
          throw new Error(`PAT validation failed with status ${response.status}`);
        }
      }

      const data = await response.json() as any;
      logger.info(`PAT validated successfully. Base contains ${data.tables?.length || 0} tables.`);
    }
  } catch (error) {
    if (error instanceof AuthenticationError) {
      logger.error('Authentication failed:', { error: error.message });
      logSecurityEvent('pat_validation_failed', 'critical', {
        reason: error.message
      });
    } else {
      logger.error('Failed to validate PAT credentials:', { error });
    }
    throw error;
  }
}

/**
 * Validate and parse tool arguments using Zod schema
 * Returns parsed data or throws ValidationError
 */
function validateToolArgs<T>(schema: ZodSchema<T>, args: unknown): T {
  const result = schema.safeParse(args);

  if (!result.success) {
    const errorMessages = result.error.errors.map(err =>
      `${err.path.join('.')}: ${err.message}`
    );
    throw new ValidationError('Invalid tool arguments', errorMessages);
  }

  return result.data;
}

// Define available tools
const tools: Tool[] = [
  {
    name: 'airtable_list_bases',
    description: 'List all Airtable bases accessible with the configured Personal Access Token. Use this to discover available bases and get their IDs.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'airtable_list_tables',
    description: 'List all tables in an Airtable base. Returns table names, IDs, and descriptions.',
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'Airtable base ID (starts with "app"). REQUIRED: Use airtable_list_bases tool first to see available bases and get their IDs.'
        }
      },
      required: []
    }
  },
  {
    name: 'airtable_get_table_schema',
    description: 'Get the complete schema for a table including all field definitions, types, and options. Auto-fetches from Airtable Metadata API and caches the result.',
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'Airtable base ID (starts with "app"). REQUIRED: Use airtable_list_bases tool first to see available bases and get their IDs.'
        },
        table: {
          type: 'string',
          description: 'Name of the table'
        }
      },
      required: ['table']
    }
  },
  {
    name: 'airtable_list_records',
    description: 'List records from an Airtable table with optional filtering and sorting. Supports all field types including single select, dates, formulas, etc. IMPORTANT: Use excludeAttachments=true to prevent Claude Desktop timeouts!',
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'Airtable base ID (starts with "app"). REQUIRED: Use airtable_list_bases tool first to see available bases and get their IDs.'
        },
        table: {
          type: 'string',
          description: 'Name of the table to list records from'
        },
        filterByFormula: {
          type: 'string',
          description: 'Optional Airtable formula to filter records (e.g., "{Status} = \'Active\'")'
        },
        maxRecords: {
          type: 'number',
          description: 'Maximum number of records to return'
        },
        view: {
          type: 'string',
          description: 'Name of the view to use'
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific fields to return (takes precedence over excludes/presets)'
        },
        excludeFields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Fields to exclude from results'
        },
        excludeAttachments: {
          type: 'boolean',
          description: 'Automatically exclude all attachment/image fields (RECOMMENDED for Claude Desktop to prevent timeouts)',
          default: true
        },
        excludeLongText: {
          type: 'boolean',
          description: 'Automatically exclude long text fields like feedback and notes',
          default: false
        },
        preset: {
          type: 'string',
          enum: ['minimal', 'contact', 'summary', 'full'],
          description: 'Use a preset field configuration: minimal (name+email), contact (contact info), summary (key fields, no attachments), full (all fields)'
        },
        sort: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              direction: { type: 'string', enum: ['asc', 'desc'] }
            }
          },
          description: 'Fields to sort by'
        }
      },
      required: ['table']
    }
  },
  {
    name: 'airtable_get_record',
    description: 'Get a specific record by ID from an Airtable table',
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'Airtable base ID (starts with "app"). REQUIRED: Use airtable_list_bases tool first to see available bases and get their IDs.'
        },
        table: {
          type: 'string',
          description: 'Name of the table'
        },
        recordId: {
          type: 'string',
          description: 'ID of the record to retrieve'
        }
      },
      required: ['table', 'recordId']
    }
  },
  {
    name: 'airtable_create_record',
    description: 'Create a new record in an Airtable table. Automatically handles field type conversions for single select, dates, numbers, checkboxes, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'Airtable base ID (starts with "app"). REQUIRED: Use airtable_list_bases tool first to see available bases and get their IDs.'
        },
        table: {
          type: 'string',
          description: 'Name of the table'
        },
        fields: {
          type: 'object',
          description: 'Field values for the new record. Values will be automatically converted based on field type.'
        }
      },
      required: ['table', 'fields']
    }
  },
  {
    name: 'airtable_update_record',
    description: 'Update an existing record in an Airtable table. Automatically handles field type conversions.',
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'Airtable base ID (starts with "app"). REQUIRED: Use airtable_list_bases tool first to see available bases and get their IDs.'
        },
        table: {
          type: 'string',
          description: 'Name of the table'
        },
        recordId: {
          type: 'string',
          description: 'ID of the record to update'
        },
        fields: {
          type: 'object',
          description: 'Field values to update. Values will be automatically converted based on field type.'
        }
      },
      required: ['table', 'recordId', 'fields']
    }
  },
  {
    name: 'airtable_delete_record',
    description: 'Delete a record from an Airtable table',
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'Airtable base ID (starts with "app"). REQUIRED: Use airtable_list_bases tool first to see available bases and get their IDs.'
        },
        table: {
          type: 'string',
          description: 'Name of the table'
        },
        recordId: {
          type: 'string',
          description: 'ID of the record to delete'
        }
      },
      required: ['table', 'recordId']
    }
  },
  {
    name: 'airtable_set_table_schema',
    description: 'Set the schema for a table to enable proper field type handling. This should be called before creating/updating records to ensure proper type conversions.',
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'Airtable base ID (starts with "app"). REQUIRED: Use airtable_list_bases tool first to see available bases and get their IDs.'
        },
        table: {
          type: 'string',
          description: 'Name of the table'
        },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              type: {
                type: 'string',
                enum: [
                  'singleLineText', 'multilineText', 'richText', 'email', 'url',
                  'singleSelect', 'multipleSelect', 'multipleSelects',
                  'date', 'dateTime', 'checkbox', 'number', 'currency', 'percent',
                  'duration', 'rating', 'phoneNumber', 'formula', 'rollup', 'count',
                  'lookup', 'multipleRecordLinks', 'multipleAttachments', 'attachment',
                  'multipleCollaborators', 'barcode', 'button',
                  'createdTime', 'createdBy', 'lastModifiedTime', 'lastModifiedBy',
                  'autoNumber', 'aiText', 'aiImage'
                ]
              },
              options: {
                type: 'object',
                properties: {
                  choices: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        color: { type: 'string' }
                      }
                    }
                  }
                }
              }
            },
            required: ['name', 'type']
          },
          description: 'Array of field definitions with their types and options'
        }
      },
      required: ['table', 'fields']
    }
  },
  {
    name: 'airtable_query_by_age_range',
    description: 'Smart query to find records by age range. Automatically handles age range single-select fields by finding overlapping ranges. Example: query for ages 29-42 will return records with age ranges "25-34" and "35-44".',
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'Airtable base ID (starts with "app"). REQUIRED: Use airtable_list_bases tool first to see available bases and get their IDs.'
        },
        table: {
          type: 'string',
          description: 'Name of the table (e.g., "Roster")'
        },
        ageFieldName: {
          type: 'string',
          description: 'Name of the age field (default: "Age")',
          default: 'Age'
        },
        minAge: {
          type: 'number',
          description: 'Minimum age (inclusive)'
        },
        maxAge: {
          type: 'number',
          description: 'Maximum age (inclusive)'
        },
        availableAgeRanges: {
          type: 'array',
          items: { type: 'string' },
          description: 'Available age range options (default: ["12-17", "18-24", "25-34", "35-44", "45-65", "65+"])',
          default: ['12-17', '18-24', '25-34', '35-44', '45-65', '65+']
        },
        additionalFilters: {
          type: 'string',
          description: 'Optional additional Airtable formula to combine with age filter'
        },
        maxRecords: {
          type: 'number',
          description: 'Maximum number of records to return'
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific fields to return'
        }
      },
      required: ['table', 'minAge', 'maxAge']
    }
  },
  {
    name: 'airtable_query_multiple_select',
    description: 'Smart query for multiple select fields with hasAny/hasAll/hasNone logic. Supports fuzzy matching (e.g., "ugc" matches "UGC Creator"). Works with ANY multiple select field in any table - completely generic.',
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'Airtable base ID (starts with "app"). REQUIRED: Use airtable_list_bases tool first to see available bases and get their IDs.'
        },
        table: {
          type: 'string',
          description: 'Name of the table'
        },
        fieldName: {
          type: 'string',
          description: 'Name of the multiple select field (e.g., "Status", "Creator Type", "Pros")'
        },
        matchType: {
          type: 'string',
          enum: ['hasAny', 'hasAll', 'hasNone'],
          description: 'Match type: hasAny (OR logic), hasAll (AND logic), or hasNone (NOT logic)'
        },
        values: {
          type: 'array',
          items: { type: 'string' },
          description: 'Values to match against. Supports fuzzy matching by default.'
        },
        availableOptions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Available options for the field (enables fuzzy matching). If not provided, exact matching is used.'
        },
        useFuzzyMatch: {
          type: 'boolean',
          description: 'Enable fuzzy matching (default: true)',
          default: true
        },
        additionalFilters: {
          type: 'string',
          description: 'Optional additional Airtable formula to combine with this filter'
        },
        maxRecords: {
          type: 'number',
          description: 'Maximum number of records to return'
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific fields to return'
        }
      },
      required: ['table', 'fieldName', 'matchType', 'values']
    }
  },
  {
    name: 'airtable_smart_query',
    description: 'Advanced query builder that combines multiple conditions with AND/OR logic. Supports age ranges, multiple selects, number ranges, and custom formulas. Completely generic - works with any fields.',
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'Airtable base ID (starts with "app"). REQUIRED: Use airtable_list_bases tool first to see available bases and get their IDs.'
        },
        table: {
          type: 'string',
          description: 'Name of the table'
        },
        conditions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['ageRange', 'multipleSelect', 'numberRange', 'customFormula'],
                description: 'Type of condition'
              },
              fieldName: {
                type: 'string',
                description: 'Name of the field (not needed for customFormula)'
              },
              matchType: {
                type: 'string',
                enum: ['hasAny', 'hasAll', 'hasNone'],
                description: 'For multipleSelect: hasAny/hasAll/hasNone'
              },
              values: {
                type: 'array',
                items: { type: 'string' },
                description: 'For multipleSelect: values to match'
              },
              availableOptions: {
                type: 'array',
                items: { type: 'string' },
                description: 'For multipleSelect or ageRange: available options'
              },
              minAge: {
                type: 'number',
                description: 'For ageRange: minimum age'
              },
              maxAge: {
                type: 'number',
                description: 'For ageRange: maximum age'
              },
              min: {
                type: 'number',
                description: 'For numberRange: minimum value'
              },
              max: {
                type: 'number',
                description: 'For numberRange: maximum value'
              },
              formula: {
                type: 'string',
                description: 'For customFormula: raw Airtable formula'
              }
            }
          },
          description: 'Array of conditions to combine'
        },
        combineWith: {
          type: 'string',
          enum: ['AND', 'OR'],
          description: 'How to combine conditions (default: AND)',
          default: 'AND'
        },
        maxRecords: {
          type: 'number',
          description: 'Maximum number of records to return'
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific fields to return'
        },
        sort: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              direction: { type: 'string', enum: ['asc', 'desc'] }
            }
          },
          description: 'Fields to sort by'
        }
      },
      required: ['table', 'conditions']
    }
  },
  {
    name: 'airtable_batch_create_records',
    description: 'Create multiple records at once (up to 10 per request). More efficient than creating records one at a time. Automatically handles field type conversions.',
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'Airtable base ID (starts with "app"). REQUIRED: Use airtable_list_bases tool first to see available bases and get their IDs.'
        },
        table: {
          type: 'string',
          description: 'Name of the table'
        },
        records: {
          type: 'array',
          items: {
            type: 'object',
            description: 'Field values for each record. Values will be automatically converted based on field type.'
          },
          description: 'Array of records to create (max 10)',
          minItems: 1,
          maxItems: 10
        }
      },
      required: ['table', 'records']
    }
  },
  {
    name: 'airtable_batch_update_records',
    description: 'Update multiple records at once (up to 10 per request). More efficient than updating records one at a time. Automatically handles field type conversions.',
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'Airtable base ID (starts with "app"). REQUIRED: Use airtable_list_bases tool first to see available bases and get their IDs.'
        },
        table: {
          type: 'string',
          description: 'Name of the table'
        },
        updates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Record ID to update'
              },
              fields: {
                type: 'object',
                description: 'Field values to update. Values will be automatically converted based on field type.'
              }
            },
            required: ['id', 'fields']
          },
          description: 'Array of updates to apply (max 10)',
          minItems: 1,
          maxItems: 10
        }
      },
      required: ['table', 'updates']
    }
  },
  {
    name: 'airtable_batch_delete_records',
    description: 'Delete multiple records at once (up to 10 per request). More efficient than deleting records one at a time.',
    inputSchema: {
      type: 'object',
      properties: {
        baseId: {
          type: 'string',
          description: 'Airtable base ID (starts with "app"). REQUIRED: Use airtable_list_bases tool first to see available bases and get their IDs.'
        },
        table: {
          type: 'string',
          description: 'Name of the table'
        },
        recordIds: {
          type: 'array',
          items: {
            type: 'string',
            description: 'Record ID to delete'
          },
          description: 'Array of record IDs to delete (max 10)',
          minItems: 1,
          maxItems: 10
        }
      },
      required: ['table', 'recordIds']
    }
  }
];

// Create and configure the server
const server = new Server(
  {
    name: 'airtable-mcp-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'airtable_list_bases': {
        // Fetch available bases from Airtable API
        const basesUrl = 'https://api.airtable.com/v0/meta/bases';
        const response = await fetch(basesUrl, {
          headers: {
            'Authorization': `Bearer ${client['config'].apiKey}`
          }
        });

        if (!response.ok) {
          throw new AuthenticationError(`Failed to fetch bases: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as any;
        const bases = data.bases.map((base: any) => ({
          id: base.id,
          name: base.name,
          permissionLevel: base.permissionLevel
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: bases.length,
                bases
              }, null, 2)
            }
          ]
        };
      }

      case 'airtable_list_tables': {
        const params = validateToolArgs(listTablesSchema, args);
        const tables = await client.listTables(params.baseId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: tables.length,
                tables
              }, null, 2)
            }
          ]
        };
      }

      case 'airtable_get_table_schema': {
        const params = validateToolArgs(getTableSchemaSchema, args);
        const schema = await client.getTableSchemaFromAPI(params.table, params.baseId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(schema, null, 2)
            }
          ]
        };
      }

      case 'airtable_list_records': {
        const params = validateToolArgs(listRecordsSchema, args);
        const records = await client.listRecords(params.table, {
          filterByFormula: params.filterByFormula,
          maxRecords: params.maxRecords,
          view: params.view,
          fields: params.fields,
          excludeFields: params.excludeFields,
          excludeAttachments: params.excludeAttachments ?? true,  // Default to true for Claude Desktop safety
          excludeLongText: params.excludeLongText,
          preset: params.preset,
          sort: params.sort
        }, params.baseId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(records, null, 2)
            }
          ]
        };
      }

      case 'airtable_get_record': {
        const params = validateToolArgs(getRecordSchema, args);
        const record = await client.getRecord(params.table, params.recordId, params.baseId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(record, null, 2)
            }
          ]
        };
      }

      case 'airtable_create_record': {
        const params = validateToolArgs(createRecordSchema, args);
        const record = await client.createRecord(params.table, params.fields, params.baseId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(record, null, 2)
            }
          ]
        };
      }

      case 'airtable_update_record': {
        const params = validateToolArgs(updateRecordSchema, args);
        const record = await client.updateRecord(params.table, params.recordId, params.fields, params.baseId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(record, null, 2)
            }
          ]
        };
      }

      case 'airtable_delete_record': {
        const params = validateToolArgs(deleteRecordSchema, args);
        const deletedId = await client.deleteRecord(params.table, params.recordId, params.baseId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, deletedId }, null, 2)
            }
          ]
        };
      }

      case 'airtable_set_table_schema': {
        const params = validateToolArgs(setTableSchemaSchema, args);
        // Cast fields to FieldMetadata[] since Zod validation ensures correct shape
        client.updateTableSchema(params.table, params.fields as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: `Schema updated for table: ${params.table}` }, null, 2)
            }
          ]
        };
      }

      case 'airtable_query_by_age_range': {
        const params = validateToolArgs(queryByAgeRangeSchema, args);

        // Build the age range formula
        const ageFormula = buildAgeRangeFormula(
          params.ageFieldName || 'Age',  // Fallback to 'Age' if undefined
          params.minAge,
          params.maxAge,
          params.availableAgeRanges ?? ['12-17', '18-24', '25-34', '35-44', '45-65', '65+']
        );

        // Combine with additional filters if provided
        const finalFormula = params.additionalFilters
          ? combineFormulasAnd(ageFormula, params.additionalFilters)
          : ageFormula;

        // Query the records
        const records = await client.listRecords(params.table, {
          filterByFormula: finalFormula,
          maxRecords: params.maxRecords,
          fields: params.fields
        }, params.baseId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                query: {
                  minAge: params.minAge,
                  maxAge: params.maxAge,
                  formula: finalFormula
                },
                recordCount: records.length,
                records
              }, null, 2)
            }
          ]
        };
      }

      case 'airtable_query_multiple_select': {
        const params = validateToolArgs(queryMultipleSelectSchema, args);

        // Build the appropriate formula based on match type
        let multiSelectFormula: string;
        switch (params.matchType) {
          case 'hasAny':
            multiSelectFormula = buildMultipleSelectHasAny(
              params.fieldName,
              params.values,
              params.availableOptions,
              params.useFuzzyMatch
            );
            break;
          case 'hasAll':
            multiSelectFormula = buildMultipleSelectHasAll(
              params.fieldName,
              params.values,
              params.availableOptions,
              params.useFuzzyMatch
            );
            break;
          case 'hasNone':
            multiSelectFormula = buildMultipleSelectHasNone(
              params.fieldName,
              params.values,
              params.availableOptions,
              params.useFuzzyMatch
            );
            break;
        }

        // Combine with additional filters if provided
        const finalFormula = params.additionalFilters
          ? combineFormulasAnd(multiSelectFormula, params.additionalFilters)
          : multiSelectFormula;

        // Query the records
        const records = await client.listRecords(params.table, {
          filterByFormula: finalFormula,
          maxRecords: params.maxRecords,
          fields: params.fields
        }, params.baseId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                query: {
                  fieldName: params.fieldName,
                  matchType: params.matchType,
                  values: params.values,
                  formula: finalFormula
                },
                recordCount: records.length,
                records
              }, null, 2)
            }
          ]
        };
      }

      case 'airtable_smart_query': {
        const params = validateToolArgs(smartQuerySchema, args);

        // Build formulas for each condition
        const formulas: string[] = [];

        for (const condition of params.conditions) {
          let formula: string;

          switch (condition.type) {
            case 'ageRange':
              formula = buildAgeRangeFormula(
                condition.fieldName,
                condition.minAge,
                condition.maxAge,
                condition.availableOptions || ['12-17', '18-24', '25-34', '35-44', '45-65', '65+']
              );
              break;

            case 'multipleSelect':
              if (condition.matchType === 'hasAny') {
                formula = buildMultipleSelectHasAny(
                  condition.fieldName,
                  condition.values,
                  condition.availableOptions,
                  condition.useFuzzyMatch ?? true
                );
              } else if (condition.matchType === 'hasAll') {
                formula = buildMultipleSelectHasAll(
                  condition.fieldName,
                  condition.values,
                  condition.availableOptions,
                  condition.useFuzzyMatch ?? true
                );
              } else {
                formula = buildMultipleSelectHasNone(
                  condition.fieldName,
                  condition.values,
                  condition.availableOptions,
                  condition.useFuzzyMatch ?? true
                );
              }
              break;

            case 'numberRange':
              formula = buildNumberRangeFormula(
                condition.fieldName,
                condition.min,
                condition.max
              );
              break;

            case 'customFormula':
              formula = condition.formula;
              break;
          }

          formulas.push(formula);
        }

        // Combine all formulas
        const finalFormula = params.combineWith === 'OR'
          ? combineFormulasOr(...formulas)
          : combineFormulasAnd(...formulas);

        // Query the records
        const records = await client.listRecords(params.table, {
          filterByFormula: finalFormula,
          maxRecords: params.maxRecords,
          fields: params.fields,
          sort: params.sort
        }, params.baseId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                query: {
                  conditions: params.conditions,
                  combineWith: params.combineWith,
                  formula: finalFormula
                },
                recordCount: records.length,
                records
              }, null, 2)
            }
          ]
        };
      }

      case 'airtable_batch_create_records': {
        const params = validateToolArgs(batchCreateRecordsSchema, args);
        const createdRecords = await client.batchCreateRecords(params.table, params.records, params.baseId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                recordCount: createdRecords.length,
                records: createdRecords
              }, null, 2)
            }
          ]
        };
      }

      case 'airtable_batch_update_records': {
        const params = validateToolArgs(batchUpdateRecordsSchema, args);
        const updatedRecords = await client.batchUpdateRecords(params.table, params.updates, params.baseId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                recordCount: updatedRecords.length,
                records: updatedRecords
              }, null, 2)
            }
          ]
        };
      }

      case 'airtable_batch_delete_records': {
        const params = validateToolArgs(batchDeleteRecordsSchema, args);
        const deletedIds = await client.batchDeleteRecords(params.table, params.recordIds, params.baseId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                deletedCount: deletedIds.length,
                deletedIds
              }, null, 2)
            }
          ]
        };
      }

      default:
        throw new ValidationError(`Unknown tool: ${name}`);
    }
  } catch (error) {
    // Log the full error server-side for debugging
    logError(error, { tool: name, timestamp: new Date().toISOString() });

    // DEBUG: Output full error to stderr for troubleshooting
    console.error('[TOOL ERROR]', name, error);

    // Wrap and sanitize error for client response
    const mcpError = wrapError(error);
    const clientError = mcpError.toClientError();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(clientError, null, 2)
        }
      ],
      isError: true
    };
  }
});

// Start the server
async function main() {
  try {
    // Get configuration from environment variables
    const config = getConfig();

    // Validate configuration format
    validateConfig(config);

    // Debug: Write to stderr to see in MCP logs
    console.error('[DEBUG] Configuration loaded and validated');

    logger.info('Using Personal Access Token (PAT) authentication');
    if (config.baseId) {
      logger.info(`Default base ID configured: ${config.baseId.substring(0, 6)}***`);
    } else {
      logger.info('No default base ID configured - PAT can access multiple bases');
    }

    console.error('[DEBUG] Initializing Airtable client');
    // Initialize client
    client = new AirtableClient(config);

    console.error('[DEBUG] Validating credentials');
    // Validate credentials before starting server
    await validateCredentials(config);

    console.error('[DEBUG] Starting MCP server transport');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[DEBUG] Server connected successfully');
    logger.info('Airtable MCP Server running on stdio');
  } catch (error) {
    // Write to stderr so it appears in MCP logs
    console.error('[FATAL ERROR]', error);
    logger.error('Failed to start server:', { error });
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[FATAL ERROR in main()]', error);
  logger.error('Fatal error:', error);
  process.exit(1);
});
