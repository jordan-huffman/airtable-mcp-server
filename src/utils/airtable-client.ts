/**
 * Airtable client wrapper with proper field type handling
 */

import Airtable, { FieldSet, Records } from 'airtable';
import { AirtableConfig, AirtableRecord, QueryParams, TableSchema, FieldMetadata, RecordFields } from '../types/airtable.js';
import { formatFieldValue, validateFieldValue } from './field-converter.js';
import { getSafeFields } from './field-filters.js';
import { ConfigurationError } from './errors.js';

export class AirtableClient {
  private base: Airtable.Base | null = null;
  private tableSchemas: Map<string, TableSchema> = new Map();
  private config: AirtableConfig;

  constructor(config: AirtableConfig) {
    this.config = config;
    Airtable.configure({ apiKey: config.apiKey });
    // Only initialize base if baseId is provided (legacy API key mode)
    // For PAT mode without baseId, base will be initialized per-operation
    if (config.baseId) {
      this.base = Airtable.base(config.baseId);
    }
  }

  /**
   * Get the Airtable base instance
   * For PAT mode, this must be called with a baseId
   */
  private getBase(baseId?: string): Airtable.Base {
    // If we have a configured base, use it
    if (this.base) {
      return this.base;
    }

    // For PAT mode, require baseId parameter
    if (!baseId) {
      throw new ConfigurationError('Base ID required. Please use the airtable_list_bases tool to see available bases and get their IDs, then provide the baseId parameter.');
    }

    return Airtable.base(baseId);
  }

  /**
   * Fetch and cache table schema including field metadata
   */
  async getTableSchema(tableName: string, baseId?: string): Promise<TableSchema> {
    if (this.tableSchemas.has(tableName)) {
      return this.tableSchemas.get(tableName)!;
    }

    // Determine which base ID to use
    const targetBaseId = baseId || this.config.baseId;
    if (!targetBaseId) {
      throw new ConfigurationError('Base ID required for schema fetch. Please use the airtable_list_bases tool to see available bases and get their IDs, then provide the baseId parameter.');
    }

    // Try to fetch schema from Airtable Metadata API
    try {
      const metadataUrl = `https://api.airtable.com/v0/meta/bases/${targetBaseId}/tables`;
      const response = await fetch(metadataUrl, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (response.ok) {
        const data = await response.json() as any;
        const table = data.tables.find((t: any) => t.name === tableName);

        if (table) {
          const schema: TableSchema = {
            id: table.id,
            name: table.name,
            fields: table.fields.map((f: any) => ({
              id: f.id,
              name: f.name,
              type: f.type,
              options: f.options
            }))
          };

          this.tableSchemas.set(tableName, schema);
          return schema;
        }
      }
    } catch (error) {
      // If metadata API fails, fall through to basic schema
      // Note: Do not use console.error - it breaks MCP stdio communication
      // Error silently falls through to basic schema
    }

    // Fallback: create basic schema
    const schema: TableSchema = {
      id: tableName,
      name: tableName,
      fields: []
    };

    this.tableSchemas.set(tableName, schema);
    return schema;
  }

  /**
   * Update table schema with field metadata
   */
  updateTableSchema(tableName: string, fields: FieldMetadata[]): void {
    const schema = this.tableSchemas.get(tableName) || {
      id: tableName,
      name: tableName,
      fields: []
    };

    schema.fields = fields;
    this.tableSchemas.set(tableName, schema);
  }

  /**
   * List all records in a table with optional filtering
   */
  async listRecords(tableName: string, params?: QueryParams, baseId?: string): Promise<AirtableRecord[]> {
    const query: any = {};

    if (params?.filterByFormula) {
      query.filterByFormula = params.filterByFormula;
    }
    if (params?.maxRecords) {
      query.maxRecords = params.maxRecords;
    }
    if (params?.pageSize) {
      query.pageSize = params.pageSize;
    }
    if (params?.sort) {
      query.sort = params.sort;
    }
    if (params?.view) {
      query.view = params.view;
    }

    // Handle field filtering
    if (params?.fields) {
      // Explicit fields list takes precedence
      query.fields = params.fields;
    } else {
      // Apply smart filtering based on exclusion options
      const schema = await this.getTableSchema(tableName, baseId);
      const allFieldNames = schema.fields.map(f => f.name);

      // If we have field names from schema, apply filtering
      if (allFieldNames.length > 0) {
        let filteredFields = [...allFieldNames];

        // Apply preset
        if (params?.preset) {
          const { getFieldPreset } = await import('./field-filters.js');
          const presetFields = getFieldPreset(params.preset, allFieldNames);
          if (presetFields) {
            filteredFields = presetFields;
          }
        } else {
          // Apply exclusions
          if (params?.excludeFields) {
            filteredFields = filteredFields.filter(f => !params.excludeFields!.includes(f));
          }

          if (params?.excludeAttachments || params?.excludeLongText) {
            const { filterFields } = await import('./field-filters.js');
            const filtered = filterFields(allFieldNames, {
              excludeAttachments: params.excludeAttachments,
              excludeLongText: params.excludeLongText
            });
            if (filtered) {
              filteredFields = filtered;
            }
          }
        }

        // Only set fields if we actually filtered something
        if (filteredFields.length < allFieldNames.length) {
          query.fields = filteredFields;
        }
      }
    }

    const base = this.getBase(baseId);
    const records = await base(tableName).select(query).all();

    return records.map(record => ({
      id: record.id,
      fields: record.fields as RecordFields,
      createdTime: record._rawJson.createdTime
    }));
  }

  /**
   * Get a single record by ID
   */
  async getRecord(tableName: string, recordId: string, baseId?: string): Promise<AirtableRecord> {
    const base = this.getBase(baseId);
    const record = await base(tableName).find(recordId);

    return {
      id: record.id,
      fields: record.fields as RecordFields,
      createdTime: record._rawJson.createdTime
    };
  }

  /**
   * Create a new record with proper field type handling
   */
  async createRecord(tableName: string, fields: RecordFields, baseId?: string): Promise<AirtableRecord> {
    const schema = await this.getTableSchema(tableName, baseId);
    const formattedFields: RecordFields = {};

    // Format and validate fields
    for (const [fieldName, value] of Object.entries(fields)) {
      const fieldMetadata = schema.fields.find(f => f.name === fieldName);

      if (fieldMetadata) {
        // Validate value
        const validation = validateFieldValue(value, fieldMetadata);
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        // Format value
        formattedFields[fieldName] = formatFieldValue(value, fieldMetadata);
      } else {
        // If we don't have metadata, pass through as-is
        formattedFields[fieldName] = value;
      }
    }

    const base = this.getBase(baseId);
    const record = await base(tableName).create(formattedFields as FieldSet);

    return {
      id: record.id,
      fields: record.fields as RecordFields,
      createdTime: record._rawJson.createdTime
    };
  }

  /**
   * Update an existing record with proper field type handling
   */
  async updateRecord(tableName: string, recordId: string, fields: RecordFields, baseId?: string): Promise<AirtableRecord> {
    const schema = await this.getTableSchema(tableName, baseId);
    const formattedFields: RecordFields = {};

    // Format and validate fields
    for (const [fieldName, value] of Object.entries(fields)) {
      const fieldMetadata = schema.fields.find(f => f.name === fieldName);

      if (fieldMetadata) {
        // Validate value
        const validation = validateFieldValue(value, fieldMetadata);
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        // Format value
        formattedFields[fieldName] = formatFieldValue(value, fieldMetadata);
      } else {
        // If we don't have metadata, pass through as-is
        formattedFields[fieldName] = value;
      }
    }

    const base = this.getBase(baseId);
    const record = await base(tableName).update(recordId, formattedFields as FieldSet);

    return {
      id: record.id,
      fields: record.fields as RecordFields,
      createdTime: record._rawJson.createdTime
    };
  }

  /**
   * Delete a record
   */
  async deleteRecord(tableName: string, recordId: string, baseId?: string): Promise<string> {
    const base = this.getBase(baseId);
    const record = await base(tableName).destroy(recordId);
    return record.id;
  }

  /**
   * List all tables in the base using Metadata API
   */
  async listTables(baseId?: string): Promise<Array<{id: string, name: string, description?: string, primaryFieldId: string}>> {
    const targetBaseId = baseId || this.config.baseId;
    if (!targetBaseId) {
      throw new ConfigurationError('Base ID required. Please use the airtable_list_bases tool to see available bases and get their IDs, then provide the baseId parameter.');
    }

    const metadataUrl = `https://api.airtable.com/v0/meta/bases/${targetBaseId}/tables`;
    const response = await fetch(metadataUrl, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tables: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.tables.map((table: any) => ({
      id: table.id,
      name: table.name,
      description: table.description,
      primaryFieldId: table.primaryFieldId
    }));
  }

  /**
   * Get full table schema from Metadata API (returns complete schema with all field info)
   */
  async getTableSchemaFromAPI(tableName: string, baseId?: string): Promise<TableSchema> {
    const targetBaseId = baseId || this.config.baseId;
    if (!targetBaseId) {
      throw new ConfigurationError('Base ID required. Please use the airtable_list_bases tool to see available bases and get their IDs, then provide the baseId parameter.');
    }

    const metadataUrl = `https://api.airtable.com/v0/meta/bases/${targetBaseId}/tables`;
    const response = await fetch(metadataUrl, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch table schema: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const table = data.tables.find((t: any) => t.name === tableName);

    if (!table) {
      throw new Error(`Table "${tableName}" not found in base`);
    }

    const schema: TableSchema = {
      id: table.id,
      name: table.name,
      fields: table.fields.map((f: any) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        options: f.options
      }))
    };

    // Cache the schema
    this.tableSchemas.set(tableName, schema);
    return schema;
  }

  /**
   * Batch create records (up to 10 at a time per Airtable's API limit)
   */
  async batchCreateRecords(tableName: string, records: RecordFields[], baseId?: string): Promise<AirtableRecord[]> {
    if (records.length === 0) {
      return [];
    }

    if (records.length > 10) {
      throw new Error('Airtable API supports a maximum of 10 records per batch create request');
    }

    const schema = await this.getTableSchema(tableName, baseId);
    const formattedRecords: RecordFields[] = [];

    // Format and validate each record's fields
    for (const recordFields of records) {
      const formattedFields: RecordFields = {};

      for (const [fieldName, value] of Object.entries(recordFields)) {
        const fieldMetadata = schema.fields.find(f => f.name === fieldName);

        if (fieldMetadata) {
          // Validate value
          const validation = validateFieldValue(value, fieldMetadata);
          if (!validation.valid) {
            throw new Error(`Record validation failed for field "${fieldName}": ${validation.error}`);
          }

          // Format value
          formattedFields[fieldName] = formatFieldValue(value, fieldMetadata);
        } else {
          // If we don't have metadata, pass through as-is
          formattedFields[fieldName] = value;
        }
      }

      formattedRecords.push(formattedFields);
    }

    const base = this.getBase(baseId);
    const createdRecords = await base(tableName).create(
      formattedRecords.map(fields => ({ fields: fields as FieldSet }))
    );

    return createdRecords.map(record => ({
      id: record.id,
      fields: record.fields as RecordFields,
      createdTime: record._rawJson.createdTime
    }));
  }

  /**
   * Batch update records (up to 10 at a time per Airtable's API limit)
   */
  async batchUpdateRecords(
    tableName: string,
    updates: Array<{id: string, fields: RecordFields}>,
    baseId?: string
  ): Promise<AirtableRecord[]> {
    if (updates.length === 0) {
      return [];
    }

    if (updates.length > 10) {
      throw new Error('Airtable API supports a maximum of 10 records per batch update request');
    }

    const schema = await this.getTableSchema(tableName, baseId);
    const formattedUpdates: Array<{id: string, fields: RecordFields}> = [];

    // Format and validate each update's fields
    for (const update of updates) {
      const formattedFields: RecordFields = {};

      for (const [fieldName, value] of Object.entries(update.fields)) {
        const fieldMetadata = schema.fields.find(f => f.name === fieldName);

        if (fieldMetadata) {
          // Validate value
          const validation = validateFieldValue(value, fieldMetadata);
          if (!validation.valid) {
            throw new Error(`Update validation failed for record "${update.id}", field "${fieldName}": ${validation.error}`);
          }

          // Format value
          formattedFields[fieldName] = formatFieldValue(value, fieldMetadata);
        } else {
          // If we don't have metadata, pass through as-is
          formattedFields[fieldName] = value;
        }
      }

      formattedUpdates.push({
        id: update.id,
        fields: formattedFields
      });
    }

    const base = this.getBase(baseId);
    const updatedRecords = await base(tableName).update(
      formattedUpdates.map(u => ({ id: u.id, fields: u.fields as FieldSet }))
    );

    return updatedRecords.map(record => ({
      id: record.id,
      fields: record.fields as RecordFields,
      createdTime: record._rawJson.createdTime
    }));
  }

  /**
   * Batch delete records (up to 10 at a time per Airtable's API limit)
   */
  async batchDeleteRecords(tableName: string, recordIds: string[], baseId?: string): Promise<string[]> {
    if (recordIds.length === 0) {
      return [];
    }

    if (recordIds.length > 10) {
      throw new Error('Airtable API supports a maximum of 10 records per batch delete request');
    }

    const base = this.getBase(baseId);
    const deletedRecords = await base(tableName).destroy(recordIds);

    return deletedRecords.map(record => record.id);
  }
}
