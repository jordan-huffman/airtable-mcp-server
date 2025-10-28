/**
 * Airtable field type definitions
 * Supports various field types including single select, dates, formulas, etc.
 */

export interface AirtableConfig {
  apiKey: string;
  baseId: string;
}

export type FieldType =
  | 'singleLineText'
  | 'multilineText'
  | 'richText'
  | 'email'
  | 'url'
  | 'singleSelect'
  | 'multipleSelect'
  | 'multipleSelects'  // Legacy - kept for backward compatibility
  | 'date'
  | 'dateTime'
  | 'checkbox'
  | 'number'
  | 'currency'
  | 'percent'
  | 'duration'
  | 'rating'
  | 'phoneNumber'
  | 'formula'
  | 'rollup'
  | 'count'
  | 'lookup'
  | 'multipleRecordLinks'
  | 'multipleAttachments'
  | 'attachment'  // Legacy - kept for backward compatibility
  | 'multipleCollaborators'
  | 'barcode'
  | 'button'
  | 'createdTime'
  | 'createdBy'
  | 'lastModifiedTime'
  | 'lastModifiedBy'
  | 'autoNumber'
  | 'aiText'
  | 'aiImage';

export interface FieldMetadata {
  id: string;
  name: string;
  type: FieldType;
  options?: {
    choices?: Array<{ id: string; name: string; color?: string }>;
    dateFormat?: { name: string; format: string };
    timeFormat?: { name: string; format: string };
    precision?: number;
    symbol?: string;
  };
}

export interface TableSchema {
  id: string;
  name: string;
  fields: FieldMetadata[];
}

export interface RecordFields {
  [key: string]: any;
}

export interface AirtableRecord {
  id: string;
  fields: RecordFields;
  createdTime: string;
}

export interface QueryParams {
  filterByFormula?: string;
  maxRecords?: number;
  pageSize?: number;
  sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  view?: string;
  fields?: string[];
  excludeFields?: string[];
  excludeAttachments?: boolean;
  excludeLongText?: boolean;
  preset?: 'contact' | 'summary' | 'full' | 'minimal';
}
