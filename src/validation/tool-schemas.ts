/**
 * Zod validation schemas for all MCP tool inputs
 * Provides comprehensive input validation and type safety
 */

import { z } from 'zod';

// Maximum array sizes to prevent DoS attacks
const MAX_FIELDS = 100;
const MAX_RECORDS = 1000;
const MAX_SORT_FIELDS = 10;
const MAX_CONDITIONS = 20;
const MAX_VALUES = 100;
const MAX_STRING_LENGTH = 1000;

/**
 * Sanitize table names - allow most characters that Airtable supports
 * More permissive to match Airtable's actual table naming rules
 */
const tableNameSchema = z.string()
  .min(1, 'Table name cannot be empty')
  .max(MAX_STRING_LENGTH, `Table name too long (max ${MAX_STRING_LENGTH})`)
  .regex(/^[\w\s\-()#+.,'!?&@$%]+$/, 'Table name contains potentially dangerous characters');

/**
 * Sanitize field names - alphanumeric, spaces, underscores, hyphens, parentheses only
 * More permissive than table names since Airtable allows various characters
 */
const fieldNameSchema = z.string()
  .min(1, 'Field name cannot be empty')
  .max(MAX_STRING_LENGTH, `Field name too long (max ${MAX_STRING_LENGTH})`)
  .regex(/^[\w\s\-()#+.,'!?&@$%]+$/, 'Field name contains potentially dangerous characters');

/**
 * Base ID format: app + 14 alphanumeric characters
 */
const baseIdSchema = z.string()
  .regex(/^app[a-zA-Z0-9]{14}$/, 'Invalid base ID format (must be appXXXXXXXXXXXXXX)');

/**
 * Record ID format: rec + 14 alphanumeric characters
 */
const recordIdSchema = z.string()
  .regex(/^rec[a-zA-Z0-9]{14}$/, 'Invalid record ID format (must be recXXXXXXXXXXXXXX)');

/**
 * Airtable formula - string with reasonable length limit
 */
const formulaSchema = z.string()
  .max(10000, 'Formula too long (max 10000 characters)');

/**
 * Sort direction enum
 */
const sortDirectionSchema = z.enum(['asc', 'desc']);

/**
 * Sort field object
 */
const sortFieldSchema = z.object({
  field: fieldNameSchema,
  direction: sortDirectionSchema
});

/**
 * Field preset enum
 */
const presetSchema = z.enum(['minimal', 'contact', 'summary', 'full']);

/**
 * Match type for multiple select queries
 */
const matchTypeSchema = z.enum(['hasAny', 'hasAll', 'hasNone']);

/**
 * Condition type for smart queries
 */
const conditionTypeSchema = z.enum(['ageRange', 'multipleSelect', 'numberRange', 'customFormula']);

// ============================================================================
// Tool Input Schemas
// ============================================================================

/**
 * airtable_list_records
 */
export const listRecordsSchema = z.object({
  baseId: baseIdSchema.optional(),
  table: tableNameSchema,
  filterByFormula: formulaSchema.optional(),
  maxRecords: z.number().int().positive().max(MAX_RECORDS).optional(),
  view: z.string().max(MAX_STRING_LENGTH).optional(),
  fields: z.array(fieldNameSchema).max(MAX_FIELDS).optional(),
  excludeFields: z.array(fieldNameSchema).max(MAX_FIELDS).optional(),
  excludeAttachments: z.boolean().optional(),
  excludeLongText: z.boolean().optional(),
  preset: presetSchema.optional(),
  sort: z.array(sortFieldSchema).max(MAX_SORT_FIELDS).optional()
});

export type ListRecordsInput = z.infer<typeof listRecordsSchema>;

/**
 * airtable_get_record
 */
export const getRecordSchema = z.object({
  baseId: baseIdSchema.optional(),
  table: tableNameSchema,
  recordId: recordIdSchema
});

export type GetRecordInput = z.infer<typeof getRecordSchema>;

/**
 * airtable_create_record
 */
export const createRecordSchema = z.object({
  baseId: baseIdSchema.optional(),
  table: tableNameSchema,
  fields: z.record(
    fieldNameSchema,
    z.any() // Field values can be any type - will be validated against schema later
  ).refine(
    (fields) => Object.keys(fields).length > 0,
    { message: 'At least one field must be provided' }
  ).refine(
    (fields) => Object.keys(fields).length <= MAX_FIELDS,
    { message: `Too many fields (max ${MAX_FIELDS})` }
  )
});

export type CreateRecordInput = z.infer<typeof createRecordSchema>;

/**
 * airtable_update_record
 */
export const updateRecordSchema = z.object({
  baseId: baseIdSchema.optional(),
  table: tableNameSchema,
  recordId: recordIdSchema,
  fields: z.record(
    fieldNameSchema,
    z.any()
  ).refine(
    (fields) => Object.keys(fields).length > 0,
    { message: 'At least one field must be provided' }
  ).refine(
    (fields) => Object.keys(fields).length <= MAX_FIELDS,
    { message: `Too many fields (max ${MAX_FIELDS})` }
  )
});

export type UpdateRecordInput = z.infer<typeof updateRecordSchema>;

/**
 * airtable_delete_record
 */
export const deleteRecordSchema = z.object({
  baseId: baseIdSchema.optional(),
  table: tableNameSchema,
  recordId: recordIdSchema
});

export type DeleteRecordInput = z.infer<typeof deleteRecordSchema>;

/**
 * airtable_set_table_schema
 */
export const setTableSchemaSchema = z.object({
  baseId: baseIdSchema.optional(),
  table: tableNameSchema,
  fields: z.array(
    z.object({
      id: z.string().optional(),
      name: fieldNameSchema,
      type: z.string(), // FieldType enum - too many to enumerate here
      options: z.record(z.any()).optional()
    })
  ).min(1, 'At least one field must be provided')
    .max(MAX_FIELDS, `Too many fields (max ${MAX_FIELDS})`)
});

export type SetTableSchemaInput = z.infer<typeof setTableSchemaSchema>;

/**
 * airtable_query_by_age_range
 */
export const queryByAgeRangeSchema = z.object({
  baseId: baseIdSchema.optional(),
  table: tableNameSchema,
  ageFieldName: z.string().optional().default('Age'),
  minAge: z.number().int().min(0).max(150),
  maxAge: z.number().int().min(0).max(150),
  availableAgeRanges: z.array(z.string()).max(50).optional(),
  additionalFilters: formulaSchema.optional(),
  maxRecords: z.number().int().positive().max(MAX_RECORDS).optional(),
  fields: z.array(fieldNameSchema).max(MAX_FIELDS).optional()
}).refine(
  (data) => data.minAge <= data.maxAge,
  { message: 'minAge must be less than or equal to maxAge' }
);

export type QueryByAgeRangeInput = z.infer<typeof queryByAgeRangeSchema>;

/**
 * airtable_query_multiple_select
 */
export const queryMultipleSelectSchema = z.object({
  baseId: baseIdSchema.optional(),
  table: tableNameSchema,
  fieldName: fieldNameSchema,
  matchType: matchTypeSchema,
  values: z.array(z.string().max(MAX_STRING_LENGTH)).min(1, 'At least one value required').max(MAX_VALUES),
  availableOptions: z.array(z.string().max(MAX_STRING_LENGTH)).max(MAX_VALUES).optional(),
  useFuzzyMatch: z.boolean().optional().default(true),
  additionalFilters: formulaSchema.optional(),
  maxRecords: z.number().int().positive().max(MAX_RECORDS).optional(),
  fields: z.array(fieldNameSchema).max(MAX_FIELDS).optional()
});

export type QueryMultipleSelectInput = z.infer<typeof queryMultipleSelectSchema>;

/**
 * airtable_smart_query
 */
export const smartQuerySchema = z.object({
  baseId: baseIdSchema.optional(),
  table: tableNameSchema,
  conditions: z.array(
    z.discriminatedUnion('type', [
      z.object({
        type: z.literal('ageRange'),
        fieldName: fieldNameSchema,
        minAge: z.number().int().min(0).max(150),
        maxAge: z.number().int().min(0).max(150),
        availableOptions: z.array(z.string()).max(50).optional()
      }),
      z.object({
        type: z.literal('multipleSelect'),
        fieldName: fieldNameSchema,
        matchType: matchTypeSchema,
        values: z.array(z.string().max(MAX_STRING_LENGTH)).min(1).max(MAX_VALUES),
        availableOptions: z.array(z.string().max(MAX_STRING_LENGTH)).max(MAX_VALUES).optional(),
        useFuzzyMatch: z.boolean().optional()
      }),
      z.object({
        type: z.literal('numberRange'),
        fieldName: fieldNameSchema,
        min: z.number().finite().optional(),
        max: z.number().finite().optional()
      }),
      z.object({
        type: z.literal('customFormula'),
        formula: formulaSchema
      })
    ])
  ).min(1, 'At least one condition required').max(MAX_CONDITIONS),
  combineWith: z.enum(['AND', 'OR']).optional().default('AND'),
  maxRecords: z.number().int().positive().max(MAX_RECORDS).optional(),
  fields: z.array(fieldNameSchema).max(MAX_FIELDS).optional(),
  sort: z.array(sortFieldSchema).max(MAX_SORT_FIELDS).optional()
});

export type SmartQueryInput = z.infer<typeof smartQuerySchema>;
