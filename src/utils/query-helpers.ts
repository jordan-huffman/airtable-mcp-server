/**
 * Smart query helpers for common query patterns
 * Helps translate natural queries into Airtable formulas
 */

export interface AgeRangeOption {
  id: string;
  name: string;
  minAge: number;
  maxAge: number | null; // null for "65+"
}

/**
 * Parse age range strings like "25-34" or "65+" into structured data
 */
export function parseAgeRange(rangeStr: string): AgeRangeOption {
  const parts = rangeStr.split('-');

  if (rangeStr.includes('+')) {
    const minAge = parseInt(rangeStr.replace('+', ''));
    return {
      id: '',
      name: rangeStr,
      minAge,
      maxAge: null
    };
  }

  return {
    id: '',
    name: rangeStr,
    minAge: parseInt(parts[0]),
    maxAge: parseInt(parts[1])
  };
}

/**
 * Find which age range options overlap with a given age range
 *
 * Example: findOverlappingAgeRanges(29, 42, availableRanges)
 * Returns: ["25-34", "35-44"]
 */
export function findOverlappingAgeRanges(
  minAge: number,
  maxAge: number,
  availableRanges: string[]
): string[] {
  const parsedRanges = availableRanges.map(parseAgeRange);
  const overlapping: string[] = [];

  for (const range of parsedRanges) {
    // Check if ranges overlap
    if (range.maxAge === null) {
      // Handle "65+" case
      if (maxAge >= range.minAge) {
        overlapping.push(range.name);
      }
    } else {
      // Normal range: check for overlap
      // Ranges overlap if: range.min <= maxAge AND range.max >= minAge
      if (range.minAge <= maxAge && range.maxAge >= minAge) {
        overlapping.push(range.name);
      }
    }
  }

  return overlapping;
}

/**
 * Build an Airtable formula to filter by age range
 *
 * Example: buildAgeRangeFormula("Age", 29, 42, ["12-17", "18-24", "25-34", "35-44", "45-65", "65+"])
 * Returns: "OR({Age} = '25-34', {Age} = '35-44')"
 */
export function buildAgeRangeFormula(
  fieldName: string,
  minAge: number,
  maxAge: number,
  availableRanges: string[]
): string {
  const sanitizedFieldName = sanitizeFieldName(fieldName);
  const overlappingRanges = findOverlappingAgeRanges(minAge, maxAge, availableRanges);

  if (overlappingRanges.length === 0) {
    return 'FALSE()'; // No matching ranges
  }

  if (overlappingRanges.length === 1) {
    const escapedRange = escapeFormulaString(overlappingRanges[0]);
    return `{${sanitizedFieldName}} = '${escapedRange}'`;
  }

  const conditions = overlappingRanges.map(range => {
    const escapedRange = escapeFormulaString(range);
    return `{${sanitizedFieldName}} = '${escapedRange}'`;
  });
  return `OR(${conditions.join(', ')})`;
}

/**
 * Escape single quotes in strings for Airtable formulas
 * Airtable uses SQL-style escaping: single quote becomes two single quotes
 * This prevents formula injection attacks
 *
 * Example: "It's working" → "It''s working"
 */
function escapeFormulaString(str: string): string {
  // Airtable uses SQL-style escaping, not backslash escaping
  return str.replace(/'/g, "''");
}

/**
 * Sanitize field names for use in Airtable formulas
 * Field names in Airtable formulas are wrapped in curly braces: {Field Name}
 * This prevents injection by validating the field name contains no special characters
 * that could break out of the curly brace context
 *
 * @throws Error if field name contains dangerous characters
 */
function sanitizeFieldName(fieldName: string): string {
  // Field names should not contain curly braces or newlines
  if (/[{}\n\r]/.test(fieldName)) {
    throw new Error(`Invalid field name: contains forbidden characters ({}, newlines)`);
  }

  // Trim whitespace to prevent confusion
  const trimmed = fieldName.trim();

  if (trimmed.length === 0) {
    throw new Error('Field name cannot be empty');
  }

  return trimmed;
}

/**
 * Fuzzy match a search term against available options
 * Returns matching options (case-insensitive, partial match)
 */
export function fuzzyMatchOptions(
  searchTerm: string,
  availableOptions: string[]
): string[] {
  const lowerSearch = searchTerm.toLowerCase();
  return availableOptions.filter(option =>
    option.toLowerCase().includes(lowerSearch)
  );
}

/**
 * Resolve values to exact option names using fuzzy matching
 * This allows queries like "dslr" to match "DSLR Podcast Setup"
 */
export function resolveOptionsWithFuzzyMatch(
  values: string[],
  availableOptions?: string[]
): string[] {
  if (!availableOptions || availableOptions.length === 0) {
    // No available options provided, return values as-is
    return values;
  }

  const resolved: Set<string> = new Set();

  for (const value of values) {
    // First try exact match (case-insensitive)
    const exactMatch = availableOptions.find(
      opt => opt.toLowerCase() === value.toLowerCase()
    );

    if (exactMatch) {
      resolved.add(exactMatch);
    } else {
      // Try fuzzy match
      const fuzzyMatches = fuzzyMatchOptions(value, availableOptions);
      fuzzyMatches.forEach(match => resolved.add(match));
    }
  }

  return Array.from(resolved);
}

/**
 * Build a formula to filter by multiple select field values - ANY match
 * Uses FIND() to check if any of the values exist in the array
 *
 * @param fieldName - Name of the multiple select field
 * @param values - Values to search for
 * @param availableOptions - Optional: available options for fuzzy matching
 * @param useFuzzyMatch - Whether to use fuzzy matching (default: true)
 */
export function buildMultipleSelectHasAny(
  fieldName: string,
  values: string[],
  availableOptions?: string[],
  useFuzzyMatch: boolean = true
): string {
  const sanitizedFieldName = sanitizeFieldName(fieldName);

  if (values.length === 0) {
    return 'FALSE()';
  }

  // Resolve values with fuzzy matching if enabled
  const resolvedValues = useFuzzyMatch && availableOptions
    ? resolveOptionsWithFuzzyMatch(values, availableOptions)
    : values;

  if (resolvedValues.length === 0) {
    return 'FALSE()';
  }

  if (resolvedValues.length === 1) {
    const escaped = escapeFormulaString(resolvedValues[0]);
    return `FIND('${escaped}', ARRAYJOIN({${sanitizedFieldName}}))`;
  }

  const conditions = resolvedValues.map(value => {
    const escaped = escapeFormulaString(value);
    return `FIND('${escaped}', ARRAYJOIN({${sanitizedFieldName}}))`;
  });
  return `OR(${conditions.join(', ')})`;
}

/**
 * Build a formula to check if a multiple select field contains ALL specified values
 *
 * @param fieldName - Name of the multiple select field
 * @param values - Values that must all be present
 * @param availableOptions - Optional: available options for fuzzy matching
 * @param useFuzzyMatch - Whether to use fuzzy matching (default: true)
 */
export function buildMultipleSelectHasAll(
  fieldName: string,
  values: string[],
  availableOptions?: string[],
  useFuzzyMatch: boolean = true
): string {
  const sanitizedFieldName = sanitizeFieldName(fieldName);

  if (values.length === 0) {
    return 'TRUE()';
  }

  // Resolve values with fuzzy matching if enabled
  const resolvedValues = useFuzzyMatch && availableOptions
    ? resolveOptionsWithFuzzyMatch(values, availableOptions)
    : values;

  if (resolvedValues.length === 0) {
    return 'TRUE()';
  }

  const conditions = resolvedValues.map(value => {
    const escaped = escapeFormulaString(value);
    return `FIND('${escaped}', ARRAYJOIN({${sanitizedFieldName}}))`;
  });
  return `AND(${conditions.join(', ')})`;
}

/**
 * Build a formula to check if a multiple select field contains NONE of the specified values
 *
 * @param fieldName - Name of the multiple select field
 * @param values - Values that must NOT be present
 * @param availableOptions - Optional: available options for fuzzy matching
 * @param useFuzzyMatch - Whether to use fuzzy matching (default: true)
 */
export function buildMultipleSelectHasNone(
  fieldName: string,
  values: string[],
  availableOptions?: string[],
  useFuzzyMatch: boolean = true
): string {
  const sanitizedFieldName = sanitizeFieldName(fieldName);

  if (values.length === 0) {
    return 'TRUE()';
  }

  // Resolve values with fuzzy matching if enabled
  const resolvedValues = useFuzzyMatch && availableOptions
    ? resolveOptionsWithFuzzyMatch(values, availableOptions)
    : values;

  if (resolvedValues.length === 0) {
    return 'TRUE()';
  }

  // NOT(OR(conditions)) is equivalent to AND(NOT(each condition))
  if (resolvedValues.length === 1) {
    const escaped = escapeFormulaString(resolvedValues[0]);
    return `NOT(FIND('${escaped}', ARRAYJOIN({${sanitizedFieldName}})))`;
  }

  const conditions = resolvedValues.map(value => {
    const escaped = escapeFormulaString(value);
    return `FIND('${escaped}', ARRAYJOIN({${sanitizedFieldName}}))`;
  });
  return `NOT(OR(${conditions.join(', ')}))`;
}

/**
 * Legacy function - now uses buildMultipleSelectHasAny
 * @deprecated Use buildMultipleSelectHasAny instead
 */
export function buildMultipleSelectFormula(
  fieldName: string,
  values: string[]
): string {
  return buildMultipleSelectHasAny(fieldName, values);
}

/**
 * Legacy function - now uses buildMultipleSelectHasAll
 * @deprecated Use buildMultipleSelectHasAll instead
 */
export function buildMultipleSelectAllFormula(
  fieldName: string,
  values: string[]
): string {
  return buildMultipleSelectHasAll(fieldName, values);
}

/**
 * Generic number range query builder
 * Works with any numeric field (age, client count, ratings, etc.)
 */
export function buildNumberRangeFormula(
  fieldName: string,
  min?: number,
  max?: number
): string {
  const sanitizedFieldName = sanitizeFieldName(fieldName);
  const conditions: string[] = [];

  if (min !== undefined && min !== null) {
    // Validate number to prevent injection
    if (!Number.isFinite(min)) {
      throw new Error('Minimum value must be a finite number');
    }
    conditions.push(`{${sanitizedFieldName}} >= ${min}`);
  }

  if (max !== undefined && max !== null) {
    // Validate number to prevent injection
    if (!Number.isFinite(max)) {
      throw new Error('Maximum value must be a finite number');
    }
    conditions.push(`{${sanitizedFieldName}} <= ${max}`);
  }

  if (conditions.length === 0) {
    return 'TRUE()';
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return `AND(${conditions.join(', ')})`;
}

/**
 * Build a date range formula
 *
 * Example: buildDateRangeFormula("Created", "2024-01-01", "2024-12-31")
 * Returns: "AND(IS_AFTER({Created}, '2024-01-01'), IS_BEFORE({Created}, '2024-12-31'))"
 */
export function buildDateRangeFormula(
  fieldName: string,
  startDate?: string,
  endDate?: string
): string {
  const sanitizedFieldName = sanitizeFieldName(fieldName);
  const conditions: string[] = [];

  if (startDate) {
    // Validate date format (basic ISO date check)
    if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}.*)?$/.test(startDate)) {
      throw new Error('Start date must be in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)');
    }
    const escapedStartDate = escapeFormulaString(startDate);
    conditions.push(`IS_AFTER({${sanitizedFieldName}}, '${escapedStartDate}')`);
  }

  if (endDate) {
    // Validate date format (basic ISO date check)
    if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}.*)?$/.test(endDate)) {
      throw new Error('End date must be in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)');
    }
    const escapedEndDate = escapeFormulaString(endDate);
    conditions.push(`IS_BEFORE({${sanitizedFieldName}}, '${escapedEndDate}')`);
  }

  if (conditions.length === 0) {
    return 'TRUE()';
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return `AND(${conditions.join(', ')})`;
}

/**
 * Combine multiple formulas with AND
 */
export function combineFormulasAnd(...formulas: string[]): string {
  const filtered = formulas.filter(f => f && f !== 'TRUE()');

  if (filtered.length === 0) {
    return 'TRUE()';
  }

  if (filtered.length === 1) {
    return filtered[0];
  }

  return `AND(${filtered.join(', ')})`;
}

/**
 * Combine multiple formulas with OR
 */
export function combineFormulasOr(...formulas: string[]): string {
  const filtered = formulas.filter(f => f && f !== 'FALSE()');

  if (filtered.length === 0) {
    return 'FALSE()';
  }

  if (filtered.length === 1) {
    return filtered[0];
  }

  return `OR(${filtered.join(', ')})`;
}
