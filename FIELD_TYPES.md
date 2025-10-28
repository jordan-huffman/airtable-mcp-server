# Airtable Field Types - Complete Reference

This document lists all supported Airtable field types and how they're handled by the MCP server.

## All Supported Field Types (2025)

### Text Fields
- **`singleLineText`** - Short text (up to ~100k characters)
- **`multilineText`** - Long text without formatting
- **`richText`** - Rich text with formatting (HTML/Markdown) ⚠️ Can be large
- **`email`** - Email address with validation
- **`url`** - URL with validation
- **`phoneNumber`** - Phone number

### Choice Fields
- **`singleSelect`** - Single choice from dropdown
- **`multipleSelect`** - Multiple choices (correct API name)
- **`multipleSelects`** - Legacy name (kept for backward compatibility)
- **`checkbox`** - Boolean true/false

### Number Fields
- **`number`** - Integer or decimal
- **`currency`** - Number with currency formatting
- **`percent`** - Percentage (0-1 as decimal)
- **`duration`** - Time duration in seconds
- **`rating`** - Star rating (1-10)

### Date & Time Fields
- **`date`** - Date only (YYYY-MM-DD)
- **`dateTime`** - Date and time (ISO 8601)
- **`createdTime`** - Auto-populated creation timestamp (read-only)
- **`lastModifiedTime`** - Auto-populated modification timestamp (read-only)

### Relationship Fields
- **`multipleRecordLinks`** - Links to records in other tables
- **`lookup`** - Pull values from linked records (read-only)
- **`rollup`** - Aggregate values from linked records (read-only)
- **`count`** - Count linked records (read-only)

### Media & Files
- **`multipleAttachments`** - Images, videos, files (correct API name) ⚠️ Very large
- **`attachment`** - Legacy name (kept for backward compatibility) ⚠️ Very large
- **`barcode`** - Barcode/QR code data

### User Fields
- **`createdBy`** - User who created record (read-only)
- **`lastModifiedBy`** - User who last modified record (read-only)
- **`multipleCollaborators`** - Multiple user references

### Computed Fields (Read-Only)
- **`formula`** - Calculated field (read-only)
- **`autoNumber`** - Auto-incrementing number (read-only)
- **`button`** - Interactive button field

### AI Fields (NEW - Read-Only)
- **`aiText`** - AI-generated text ⚠️ Can be large
- **`aiImage`** - AI-generated images ⚠️ Very large

## Field Type Handling

### Writable Fields
These can be set when creating/updating records:
- All text fields (singleLineText, multilineText, richText, email, url, phoneNumber)
- All choice fields (singleSelect, multipleSelect, checkbox)
- All number fields (number, currency, percent, duration, rating)
- Date fields (date, dateTime)
- Relationship fields (multipleRecordLinks)
- Media fields (multipleAttachments)
- User fields (multipleCollaborators)
- Barcode

### Read-Only Fields
These are computed or auto-generated (will throw error if you try to set them):
- `formula`
- `rollup`
- `count`
- `lookup`
- `createdTime`
- `createdBy`
- `lastModifiedTime`
- `lastModifiedBy`
- `autoNumber`
- `aiText` - AI-generated
- `aiImage` - AI-generated
- `button`

## Field Filtering Recommendations

### Exclude by Default (Large Data)
These field types are automatically excluded when `excludeAttachments=true`:
- `multipleAttachments` / `attachment`
- `aiImage`
- Any field matching patterns: photo, image, video, sample, headshot, etc.

### Exclude for Performance (Long Text)
These field types are excluded when `excludeLongText=true`:
- `richText`
- `aiText`
- Any field matching patterns: feedback, notes, description, etc.

### Safe for Claude Desktop
These are safe to always include (small data):
- All text fields (except richText)
- All choice fields
- All number fields
- All date fields
- User references (createdBy, lastModifiedBy, multipleCollaborators)
- Record links (just IDs, not the full records)

## Type Conversions

### Input Formatting
When creating/updating records, values are automatically converted:

| Field Type | Input Format | Converted To |
|------------|--------------|--------------|
| singleSelect | `"Option Name"` | String |
| multipleSelect | `["Opt1", "Opt2"]` | Array of strings |
| date/dateTime | `"2024-12-31"` or Date | ISO 8601 string |
| number/currency/percent | `42` or `"42"` | Number |
| checkbox | `true`, `"true"`, `1` | Boolean |
| multipleRecordLinks | `["recXXX"]` | Array of record IDs |
| multipleAttachments | `[{url: "..."}]` | Array of attachment objects |
| multipleCollaborators | `[{id: "usr123"}]` | Array of user objects |

### Output Format
When reading records, values are returned as-is from Airtable with some normalization:
- Arrays stay as arrays
- Dates stay as ISO strings
- Numbers stay as numbers
- Objects stay as objects

## Legacy Type Names

For backward compatibility, these legacy names are still supported:
- `multipleSelects` → Use `multipleSelect` (correct API name)
- `attachment` → Use `multipleAttachments` (correct API name)

Both will work, but prefer the correct API names for new code.

## New AI Features (2025)

Airtable now supports AI-generated fields:
- **aiText**: AI writes content based on your prompts
- **aiImage**: AI generates images based on your prompts

These are:
- ✅ Fully supported by the MCP server
- ⚠️ Read-only (you can't set them manually)
- ⚠️ Automatically excluded by default filters (large data)
- ⚠️ Can be very large (especially aiImage)

## Usage Example

```typescript
// Create a record with various field types
await client.createRecord('Tasks', {
  // Text fields
  'Name': 'Complete project',
  'Description': 'Long description here',

  // Choice fields
  'Status': 'In Progress',  // singleSelect
  'Tags': ['Urgent', 'Important'],  // multipleSelect
  'Completed': false,  // checkbox

  // Number fields
  'Priority': 5,  // number
  'Budget': 50000,  // currency
  'Progress': 0.75,  // percent (75%)

  // Date fields
  'Due Date': '2024-12-31',  // date
  'Created': '2024-01-01T10:00:00Z',  // dateTime

  // Relationship fields
  'Project': ['recPROJECT123'],  // multipleRecordLinks
  'Assignees': [{id: 'usrUSER456'}],  // multipleCollaborators

  // Media fields
  'Attachments': [{url: 'https://example.com/file.pdf'}]
});
```

## Best Practices

1. **Always use `excludeAttachments=true`** for Claude Desktop queries
2. **Use presets** for common queries (`contact`, `summary`, `minimal`)
3. **Specify exact fields** when you know what you need
4. **Avoid rich text and AI fields** unless specifically needed
5. **Validate choice fields** against available options
6. **Use correct type names** (`multipleSelect` not `multipleSelects`)
7. **Don't try to set read-only fields** (formula, rollup, aiText, etc.)

## Reference

For the most up-to-date information, see:
- [Airtable API Field Types](https://airtable.com/developers/web/api/model/field-type)
- [Airtable Support - Field Types](https://support.airtable.com/docs/supported-field-types-in-airtable-overview)
