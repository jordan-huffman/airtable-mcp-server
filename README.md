# Enhanced Airtable MCP Server

[![npm version](https://badge.fury.io/js/@jordanhuffman%2Fairtable-mcp-server.svg)](https://www.npmjs.com/package/@jordanhuffman/airtable-mcp-server)
[![CI](https://github.com/jordan-huffman/airtable-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/jordan-huffman/airtable-mcp-server/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

A robust Model Context Protocol (MCP) server for Airtable that properly handles all field types including single select, dates, formulas, checkboxes, numbers, and more.

## Features

- **Full Field Type Support**: Properly handles all Airtable field types:
  - Single Select & Multiple Selects
  - Date & DateTime
  - Number, Currency, Percent, Duration, Rating
  - Checkbox (Boolean)
  - Email, URL, Phone Number
  - Attachments
  - Record Links
  - Formula, Rollup, Lookup (read-only)
  - And more!

- **Automatic Type Conversion**: Automatically converts values to the correct format based on field type
- **Validation**: Validates field values against schema (e.g., validates select options)
- **Flexible Querying**: Support for filtering, sorting, views, and field selection
- **Schema Management**: Define table schemas for enhanced type safety

## Installation

```bash
npm install
npm run build
```

## Configuration

### Authentication

This server uses **Personal Access Tokens (PAT)** for authentication. Airtable is deprecating legacy API keys in favor of PATs.

**Personal Access Tokens**:
- Start with `pat` (e.g., `patXXXXXXXXXXXXXXXXXX.XXXXXXXXX...`)
- Can access multiple bases with a single token
- Support fine-grained permissions
- Optionally set `AIRTABLE_BASE_ID` for a default base

**Environment Variables**:
- `AIRTABLE_PAT` (required): Your Personal Access Token
- `AIRTABLE_BASE_ID` (optional): Default base ID if you primarily work with one base

**Create your PAT**: https://airtable.com/create/tokens

> **Note**: Legacy API keys (starting with `key`) are no longer supported by this server.

### Security Best Practices

⚠️ **IMPORTANT**: Never commit tokens to version control!

1. **Use Environment Variables**: Store credentials in `.env` file (already in `.gitignore`)
2. **Rotate Tokens Regularly**: Refresh Personal Access Tokens every 90 days
3. **Use Scoped Permissions**: Create PATs with minimum required permissions (scopes)
4. **Separate Environments**: Use different tokens for dev/staging/production

See [SECURITY.md](SECURITY.md) for comprehensive security guidelines.

## Usage

### Running Locally

```bash
# Development mode with PAT only (access multiple bases)
AIRTABLE_PAT=your_pat npm run dev

# Development mode with default base
AIRTABLE_PAT=your_pat AIRTABLE_BASE_ID=your_base npm run dev

# Production mode
AIRTABLE_PAT=your_pat AIRTABLE_BASE_ID=your_base npm start
```

### Using with Claude Desktop

Add to your Claude Desktop configuration file:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

#### Option 1: PAT Only (Multi-base Access)

```json
{
  "mcpServers": {
    "airtable": {
      "command": "node",
      "args": ["/absolute/path/to/airtable-mcp-server/build/index.js"],
      "env": {
        "AIRTABLE_PAT": "patXXXXXXXXXXXXXXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
      }
    }
  }
}
```

With this setup, the server can access all bases your PAT has permissions for.

#### Option 2: PAT with Default Base (Recommended)

If you primarily work with one base:

```json
{
  "mcpServers": {
    "airtable": {
      "command": "node",
      "args": ["/absolute/path/to/airtable-mcp-server/build/index.js"],
      "env": {
        "AIRTABLE_PAT": "patXXXXXXXXXXXXXXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "AIRTABLE_BASE_ID": "appXXXXXXXXXXXXXX"
      }
    }
  }
}
```

**Security Notes**:
- ⚠️ Use **absolute paths** only (e.g., `/Users/you/projects/...` not `~/projects/...`)
- 🔒 Protect config file: `chmod 600 ~/Library/Application\ Support/Claude/claude_desktop_config.json`
- 🚫 Never commit this config file with real credentials
- ✅ Claude Desktop config file is user-specific and should stay private

## Available Tools

### 1. `airtable_list_records`

List records from a table with optional filtering and sorting.

**Parameters**:
- `table` (required): Table name
- `filterByFormula` (optional): Airtable formula for filtering
- `maxRecords` (optional): Maximum records to return
- `view` (optional): View name to use
- `fields` (optional): Array of field names to return
- `sort` (optional): Array of sort objects `[{field: "Name", direction: "asc"}]`

**Example**:
```json
{
  "table": "Contacts",
  "filterByFormula": "{Status} = 'Active'",
  "maxRecords": 10,
  "sort": [{"field": "Created", "direction": "desc"}]
}
```

### 2. `airtable_get_record`

Get a specific record by ID.

**Parameters**:
- `table` (required): Table name
- `recordId` (required): Record ID

### 3. `airtable_create_record`

Create a new record with automatic field type conversion.

**Parameters**:
- `table` (required): Table name
- `fields` (required): Object with field values

**Example**:
```json
{
  "table": "Tasks",
  "fields": {
    "Name": "Complete project",
    "Status": "In Progress",
    "Due Date": "2024-12-31",
    "Priority": 5,
    "Completed": false
  }
}
```

### 4. `airtable_update_record`

Update an existing record.

**Parameters**:
- `table` (required): Table name
- `recordId` (required): Record ID
- `fields` (required): Object with field values to update

### 5. `airtable_delete_record`

Delete a record.

**Parameters**:
- `table` (required): Table name
- `recordId` (required): Record ID

### 6. `airtable_set_table_schema`

Define the schema for a table to enable proper field type handling. This is optional but recommended for better type safety and validation.

**Parameters**:
- `table` (required): Table name
- `fields` (required): Array of field definitions

**Example**:
```json
{
  "table": "Tasks",
  "fields": [
    {
      "name": "Name",
      "type": "singleLineText"
    },
    {
      "name": "Status",
      "type": "singleSelect",
      "options": {
        "choices": [
          {"id": "sel1", "name": "To Do"},
          {"id": "sel2", "name": "In Progress"},
          {"id": "sel3", "name": "Done"}
        ]
      }
    },
    {
      "name": "Due Date",
      "type": "date"
    },
    {
      "name": "Priority",
      "type": "number"
    },
    {
      "name": "Completed",
      "type": "checkbox"
    }
  ]
}
```

## Field Type Handling

The server automatically converts values based on field types:

| Field Type | Input Format | Notes |
|------------|-------------|-------|
| singleSelect | `"Option Name"` | Validates against available choices |
| multipleSelects | `["Option1", "Option2"]` | Array of option names |
| date/dateTime | `"2024-12-31"` or ISO string | Converts to ISO format |
| number/currency/percent | `42` or `"42"` | Converts to number |
| checkbox | `true`, `false`, `"true"`, `"1"` | Converts to boolean |
| email | `"user@example.com"` | Validates email format |
| url | `"https://example.com"` | Validates URL format |
| multipleRecordLinks | `["recXXX", "recYYY"]` | Array of record IDs |
| attachment | `[{url: "https://..."}]` | Array of attachment objects |
| formula/rollup/etc. | N/A | Read-only fields |

## Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Build TypeScript
npm run build

# Watch mode for development
npm run watch
```

## Project Structure

```
.
├── src/
│   ├── index.ts                 # Main MCP server
│   ├── types/
│   │   └── airtable.ts         # Type definitions
│   ├── utils/
│   │   ├── airtable-client.ts  # Airtable client wrapper
│   │   └── field-converter.ts  # Field type conversion utilities
│   └── handlers/                # Future: tool handlers
├── build/                       # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

## Why This Server?

The existing Airtable MCP servers only work with simple text fields. This server:

- Properly handles **single select** fields (validates options)
- Correctly formats **date** and **datetime** fields
- Converts **number**, **currency**, **percent** fields appropriately
- Handles **checkbox** (boolean) fields
- Supports **multiple selects**, **attachments**, **record links**
- Validates field values against schema
- Provides helpful error messages

## Security

This MCP server implements comprehensive security measures:

✅ **Input Validation**: All inputs validated with Zod schemas
✅ **Formula Injection Protection**: Sanitized field names and escaped values
✅ **Error Sanitization**: Sensitive data redacted from error messages
✅ **Field Filtering**: Automatic exclusion of large/sensitive fields
✅ **Rate Limit Awareness**: Respects Airtable API limits
✅ **Dependency Scanning**: Regular `npm audit` checks (currently 0 vulnerabilities)

**For security issues**: Please review [SECURITY.md](SECURITY.md) and report vulnerabilities privately to maintainers (not via public issues).

### Best Practices for Claude Desktop

Always use field filtering to prevent timeouts and protect sensitive data:

```json
{
  "table": "Users",
  "excludeAttachments": true,  // ⭐ ALWAYS use this with Claude Desktop
  "maxRecords": 100
}
```

Or use presets for common scenarios:
```json
{
  "table": "Contacts",
  "preset": "contact",  // Safe preset (no attachments/long text)
  "maxRecords": 50
}
```

### Monitor API Usage

Airtable limits:
- 5 requests/second per base
- 100,000 calls/day per workspace

Check your usage in the [Airtable Account Dashboard](https://airtable.com/account).

## License

MIT

## Contributing

Contributions are welcome! Please:
1. Review [SECURITY.md](SECURITY.md) for security guidelines
2. Run `npm audit` before submitting
3. Add tests for new features
4. Follow existing code style

For security vulnerabilities, please follow the private disclosure process in [SECURITY.md](SECURITY.md).
