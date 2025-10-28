/**
 * Field filtering utilities to control what data is returned
 * Helps prevent large responses that cause Claude Desktop to fail
 */

export interface FieldFilterOptions {
  /** Specific fields to include (whitelist) */
  includeFields?: string[];

  /** Specific fields to exclude (blacklist) */
  excludeFields?: string[];

  /** Exclude all attachment/image fields automatically */
  excludeAttachments?: boolean;

  /** Exclude long text fields (rich text, feedback, notes) */
  excludeLongText?: boolean;

  /** Use a preset field configuration */
  preset?: 'contact' | 'summary' | 'full' | 'minimal';

  /** Maximum number of fields to return (alphabetically) */
  maxFields?: number;
}

/**
 * Common attachment field patterns that tend to be large
 */
const ATTACHMENT_FIELD_PATTERNS = [
  /headshot/i,
  /photo/i,
  /image/i,
  /picture/i,
  /sample/i,
  /video/i,
  /attachment/i,
  /files?/i,
  /media/i,
  /screenshot/i,
  /living room/i,
  /bathroom/i,
  /home photos/i,
  /current setup/i,
  /dropbox/i,
  /ai.*image/i,  // AI-generated images
  /generated.*image/i
];

/**
 * Long text field patterns that can be large
 */
const LONG_TEXT_FIELD_PATTERNS = [
  /feedback/i,
  /notes?/i,
  /description/i,
  /bio/i,
  /additional.*notes/i,
  /project.*notes/i,
  /comments/i,
  /rich.*text/i,  // Rich text fields
  /ai.*text/i,  // AI-generated text
  /generated.*text/i,
  /summary/i,
  /content/i
];

/**
 * Check if a field name matches any pattern
 */
function matchesPatterns(fieldName: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(fieldName));
}

/**
 * Get preset field configurations
 */
export function getFieldPreset(preset: string, allFields?: string[]): string[] | undefined {
  switch (preset) {
    case 'minimal':
      // Just ID and name
      return ['Creator Name', 'First Name', 'Last Name', 'Email'];

    case 'contact':
      // Contact information only
      return [
        'Creator Name',
        'First Name',
        'Last Name',
        'Email',
        'Phone Number',
        'Instagram Handle',
        'TikTok Handle',
        'Instagram URL',
        'TikTok URL'
      ];

    case 'summary':
      // Key information without attachments
      return [
        'Creator Name',
        'First Name',
        'Last Name',
        'Email',
        'Phone Number',
        'Age',
        'Gender',
        'Status',
        'Creator Type',
        'Pros',
        'Cons',
        'Rate ( make it as a Dropdown) ❓',
        'Total # of Clients',
        'Active Clients (KEEP HIDDEN) ❓',
        'Country',
        'State',
        'City'
      ];

    case 'full':
      // All fields (no filtering)
      return undefined;

    default:
      return undefined;
  }
}

/**
 * Filter fields based on options
 *
 * @param allFields - All available fields in the table
 * @param options - Filtering options
 * @returns Array of fields to include, or undefined for all fields
 */
export function filterFields(
  allFields: string[],
  options: FieldFilterOptions
): string[] | undefined {
  // If includeFields is specified, use that as the whitelist
  if (options.includeFields && options.includeFields.length > 0) {
    return options.includeFields;
  }

  // If preset is specified, use that
  if (options.preset) {
    const presetFields = getFieldPreset(options.preset, allFields);
    if (presetFields) {
      return presetFields;
    }
  }

  // Start with all fields
  let fields = [...allFields];

  // Apply excludeFields
  if (options.excludeFields && options.excludeFields.length > 0) {
    fields = fields.filter(f => !options.excludeFields!.includes(f));
  }

  // Exclude attachments if requested
  if (options.excludeAttachments) {
    fields = fields.filter(f => !matchesPatterns(f, ATTACHMENT_FIELD_PATTERNS));
  }

  // Exclude long text if requested
  if (options.excludeLongText) {
    fields = fields.filter(f => !matchesPatterns(f, LONG_TEXT_FIELD_PATTERNS));
  }

  // Limit number of fields if specified
  if (options.maxFields && options.maxFields > 0) {
    fields = fields.slice(0, options.maxFields);
  }

  // If we filtered down to all fields, return undefined (Airtable default)
  if (fields.length === allFields.length) {
    return undefined;
  }

  return fields;
}

/**
 * Smart field filtering - automatically excludes attachments and long text
 * This is the recommended default for Claude Desktop to prevent timeouts
 */
export function smartFilterFields(allFields: string[]): string[] {
  return filterFields(allFields, {
    excludeAttachments: true,
    excludeLongText: true
  }) || allFields;
}

/**
 * Get safe fields for a table - excludes problematic large fields
 * Returns a list of fields that are safe to always return
 */
export function getSafeFields(allFields: string[]): string[] {
  const filtered = allFields.filter(field => {
    // Exclude attachments
    if (matchesPatterns(field, ATTACHMENT_FIELD_PATTERNS)) {
      return false;
    }

    // Exclude very long text fields
    if (matchesPatterns(field, LONG_TEXT_FIELD_PATTERNS)) {
      return false;
    }

    // Include everything else
    return true;
  });

  return filtered;
}

/**
 * Detect if a field is likely an attachment field
 */
export function isAttachmentField(fieldName: string): boolean {
  return matchesPatterns(fieldName, ATTACHMENT_FIELD_PATTERNS);
}

/**
 * Detect if a field is likely a long text field
 */
export function isLongTextField(fieldName: string): boolean {
  return matchesPatterns(fieldName, LONG_TEXT_FIELD_PATTERNS);
}
