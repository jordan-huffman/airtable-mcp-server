/**
 * Utilities for converting field values to and from Airtable format
 * Handles different field types appropriately
 */

import { FieldMetadata, FieldType } from '../types/airtable.js';

/**
 * Convert a value to the appropriate format for Airtable based on field type
 */
export function formatFieldValue(value: any, fieldMetadata: FieldMetadata): any {
  if (value === null || value === undefined) {
    return null;
  }

  const { type } = fieldMetadata;

  switch (type) {
    case 'singleSelect':
      // Single select expects just the string name
      return typeof value === 'string' ? value : String(value);

    case 'multipleSelect':
    case 'multipleSelects':  // Legacy support
      // Multiple selects expects an array of strings
      return Array.isArray(value) ? value : [String(value)];

    case 'date':
    case 'dateTime':
      // Dates should be in ISO format
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (typeof value === 'string') {
        // Validate it's a valid date
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
      return value;

    case 'number':
    case 'currency':
    case 'percent':
    case 'rating':
    case 'duration':
      // Convert to number
      return typeof value === 'number' ? value : parseFloat(String(value));

    case 'checkbox':
      // Convert to boolean
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1';
      }
      return Boolean(value);

    case 'multipleRecordLinks':
      // Record links expect an array of record IDs
      if (Array.isArray(value)) {
        return value.map(v => typeof v === 'string' ? v : v.id);
      }
      return [typeof value === 'string' ? value : value.id];

    case 'multipleAttachments':
    case 'attachment':  // Legacy support
      // Attachments expect an array of objects with url
      if (Array.isArray(value)) {
        return value.map(v => typeof v === 'string' ? { url: v } : v);
      }
      return [typeof value === 'string' ? { url: value } : value];

    case 'multipleCollaborators':
      // Collaborators expect an array of user objects or IDs
      if (Array.isArray(value)) {
        return value.map(v => typeof v === 'string' ? { id: v } : v);
      }
      return [typeof value === 'string' ? { id: value } : value];

    case 'email':
    case 'url':
    case 'phoneNumber':
    case 'singleLineText':
    case 'multilineText':
    case 'richText':
      // Text fields (richText treated as string for input)
      return String(value);

    case 'aiText':
    case 'aiImage':
      // AI-generated fields - read-only
      throw new Error(`Field type "${type}" is AI-generated and read-only`);

    case 'formula':
    case 'rollup':
    case 'count':
    case 'lookup':
    case 'createdTime':
    case 'createdBy':
    case 'lastModifiedTime':
    case 'lastModifiedBy':
    case 'autoNumber':
      // Read-only fields - don't convert
      throw new Error(`Field type "${type}" is read-only and cannot be set`);

    default:
      // For unknown types, pass through as-is
      return value;
  }
}

/**
 * Parse a field value from Airtable to a more user-friendly format
 */
export function parseFieldValue(value: any, fieldMetadata: FieldMetadata): any {
  if (value === null || value === undefined) {
    return null;
  }

  const { type } = fieldMetadata;

  switch (type) {
    case 'date':
    case 'dateTime':
    case 'createdTime':
    case 'lastModifiedTime':
      // Return ISO string for dates
      return value;

    case 'multipleRecordLinks':
      // Return array of IDs
      return Array.isArray(value) ? value : [value];

    case 'multipleAttachments':
    case 'attachment':  // Legacy support
      // Return array of attachment objects
      return Array.isArray(value) ? value : [value];

    case 'multipleSelect':
    case 'multipleSelects':  // Legacy support
      // Return array of selected values
      return Array.isArray(value) ? value : [value];

    case 'multipleCollaborators':
      // Return array of collaborator objects
      return Array.isArray(value) ? value : [value];

    case 'aiText':
    case 'aiImage':
      // AI fields - return as-is
      return value;

    default:
      // For most types, return as-is
      return value;
  }
}

/**
 * Validate a value against field metadata
 */
export function validateFieldValue(value: any, fieldMetadata: FieldMetadata): { valid: boolean; error?: string } {
  if (value === null || value === undefined) {
    return { valid: true };
  }

  const { type, options } = fieldMetadata;

  switch (type) {
    case 'singleSelect':
      if (options?.choices) {
        const validChoices = options.choices.map(c => c.name);
        if (!validChoices.includes(String(value))) {
          return {
            valid: false,
            error: `Invalid choice for field "${fieldMetadata.name}". Valid choices: ${validChoices.join(', ')}`
          };
        }
      }
      return { valid: true };

    case 'multipleSelect':
    case 'multipleSelects':  // Legacy support
      if (options?.choices) {
        const validChoices = options.choices.map(c => c.name);
        const values = Array.isArray(value) ? value : [value];
        const invalidChoices = values.filter(v => !validChoices.includes(String(v)));
        if (invalidChoices.length > 0) {
          return {
            valid: false,
            error: `Invalid choices for field "${fieldMetadata.name}": ${invalidChoices.join(', ')}. Valid choices: ${validChoices.join(', ')}`
          };
        }
      }
      return { valid: true };

    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(value))) {
        return { valid: false, error: `Invalid email format for field "${fieldMetadata.name}"` };
      }
      return { valid: true };

    case 'url':
      try {
        new URL(String(value));
        return { valid: true };
      } catch {
        return { valid: false, error: `Invalid URL format for field "${fieldMetadata.name}"` };
      }

    default:
      return { valid: true };
  }
}
