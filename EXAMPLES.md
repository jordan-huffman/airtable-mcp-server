# Usage Examples

This document provides practical examples of using the Airtable MCP Server with different field types.

## Setting Up a Table Schema

Before working with complex field types, it's recommended to set up your table schema. This enables proper validation and type conversion.

```json
{
  "tool": "airtable_set_table_schema",
  "arguments": {
    "table": "Projects",
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
            {"id": "sel1", "name": "Planning"},
            {"id": "sel2", "name": "In Progress"},
            {"id": "sel3", "name": "On Hold"},
            {"id": "sel4", "name": "Completed"}
          ]
        }
      },
      {
        "name": "Priority",
        "type": "singleSelect",
        "options": {
          "choices": [
            {"id": "selA", "name": "Low"},
            {"id": "selB", "name": "Medium"},
            {"id": "selC", "name": "High"},
            {"id": "selD", "name": "Urgent"}
          ]
        }
      },
      {
        "name": "Start Date",
        "type": "date"
      },
      {
        "name": "Due Date",
        "type": "date"
      },
      {
        "name": "Budget",
        "type": "currency"
      },
      {
        "name": "Completion",
        "type": "percent"
      },
      {
        "name": "Active",
        "type": "checkbox"
      },
      {
        "name": "Tags",
        "type": "multipleSelects",
        "options": {
          "choices": [
            {"id": "tag1", "name": "Marketing"},
            {"id": "tag2", "name": "Development"},
            {"id": "tag3", "name": "Design"},
            {"id": "tag4", "name": "Research"}
          ]
        }
      }
    ]
  }
}
```

## Creating Records

### Example 1: Simple Project Record

```json
{
  "tool": "airtable_create_record",
  "arguments": {
    "table": "Projects",
    "fields": {
      "Name": "Website Redesign",
      "Status": "In Progress",
      "Priority": "High",
      "Start Date": "2024-01-15",
      "Due Date": "2024-03-30",
      "Budget": 50000,
      "Completion": 0.35,
      "Active": true,
      "Tags": ["Design", "Development"]
    }
  }
}
```

### Example 2: Contact Record with Email and Phone

```json
{
  "tool": "airtable_create_record",
  "arguments": {
    "table": "Contacts",
    "fields": {
      "Name": "Jane Smith",
      "Email": "jane.smith@example.com",
      "Phone": "+1-555-0123",
      "Company": "Tech Corp",
      "Role": "Senior Developer",
      "Active": true
    }
  }
}
```

### Example 3: Task with Date/Time

```json
{
  "tool": "airtable_create_record",
  "arguments": {
    "table": "Tasks",
    "fields": {
      "Task Name": "Review pull request",
      "Due DateTime": "2024-10-24T14:00:00.000Z",
      "Status": "To Do",
      "Estimated Hours": 2,
      "High Priority": true
    }
  }
}
```

## Querying Records

### Example 1: Filter by Status

```json
{
  "tool": "airtable_list_records",
  "arguments": {
    "table": "Projects",
    "filterByFormula": "{Status} = 'In Progress'",
    "maxRecords": 20
  }
}
```

### Example 2: Filter by Date Range

```json
{
  "tool": "airtable_list_records",
  "arguments": {
    "table": "Projects",
    "filterByFormula": "AND({Start Date} >= '2024-01-01', {Due Date} <= '2024-12-31')",
    "sort": [
      {"field": "Due Date", "direction": "asc"}
    ]
  }
}
```

### Example 3: Filter by Multiple Conditions

```json
{
  "tool": "airtable_list_records",
  "arguments": {
    "table": "Projects",
    "filterByFormula": "AND({Status} = 'In Progress', {Priority} = 'High', {Active} = TRUE())",
    "fields": ["Name", "Status", "Priority", "Due Date"],
    "sort": [
      {"field": "Priority", "direction": "desc"},
      {"field": "Due Date", "direction": "asc"}
    ]
  }
}
```

### Example 4: Using Views

```json
{
  "tool": "airtable_list_records",
  "arguments": {
    "table": "Projects",
    "view": "Active Projects",
    "maxRecords": 50
  }
}
```

## Updating Records

### Example 1: Update Single Select Field

```json
{
  "tool": "airtable_update_record",
  "arguments": {
    "table": "Projects",
    "recordId": "recXXXXXXXXXXXXXX",
    "fields": {
      "Status": "Completed",
      "Completion": 1.0
    }
  }
}
```

### Example 2: Update Date and Checkbox

```json
{
  "tool": "airtable_update_record",
  "arguments": {
    "table": "Tasks",
    "recordId": "recYYYYYYYYYYYYYY",
    "fields": {
      "Completed": true,
      "Completion Date": "2024-10-23T18:30:00.000Z"
    }
  }
}
```

### Example 3: Update Multiple Select Tags

```json
{
  "tool": "airtable_update_record",
  "arguments": {
    "table": "Projects",
    "recordId": "recZZZZZZZZZZZZZZ",
    "fields": {
      "Tags": ["Marketing", "Design", "Research"]
    }
  }
}
```

## Complex Queries with Formulas

### Example 1: Find Overdue Tasks

```json
{
  "tool": "airtable_list_records",
  "arguments": {
    "table": "Tasks",
    "filterByFormula": "AND(IS_BEFORE({Due Date}, TODAY()), {Completed} = FALSE())",
    "sort": [{"field": "Due Date", "direction": "asc"}]
  }
}
```

### Example 2: Find High-Value Projects

```json
{
  "tool": "airtable_list_records",
  "arguments": {
    "table": "Projects",
    "filterByFormula": "AND({Budget} > 25000, {Status} != 'Completed')",
    "sort": [{"field": "Budget", "direction": "desc"}]
  }
}
```

### Example 3: Search by Text

```json
{
  "tool": "airtable_list_records",
  "arguments": {
    "table": "Projects",
    "filterByFormula": "SEARCH('website', LOWER({Name}))",
    "maxRecords": 10
  }
}
```

## Working with Linked Records

### Example: Create Record with Links

```json
{
  "tool": "airtable_create_record",
  "arguments": {
    "table": "Tasks",
    "fields": {
      "Task Name": "Design homepage mockup",
      "Project": ["recPROJECT123"],
      "Assigned To": ["recUSER456", "recUSER789"],
      "Status": "In Progress"
    }
  }
}
```

## Working with Attachments

### Example: Add Attachment URLs

```json
{
  "tool": "airtable_create_record",
  "arguments": {
    "table": "Documents",
    "fields": {
      "Name": "Project Proposal",
      "Files": [
        {"url": "https://example.com/proposal.pdf"},
        {"url": "https://example.com/budget.xlsx"}
      ],
      "Category": "Proposals"
    }
  }
}
```

## Tips for Formula Writing

Airtable formulas can be powerful. Here are some useful patterns:

1. **Date comparisons**:
   - `IS_AFTER({Due Date}, TODAY())` - Due in the future
   - `IS_BEFORE({Start Date}, TODAY())` - Started in the past
   - `DATETIME_DIFF({Due Date}, TODAY(), 'days') < 7` - Due within a week

2. **Text searching**:
   - `SEARCH('keyword', {Field})` - Case-insensitive search
   - `FIND('exact', {Field})` - Case-sensitive search

3. **Multiple conditions**:
   - `AND(condition1, condition2, condition3)` - All must be true
   - `OR(condition1, condition2)` - At least one must be true
   - `NOT(condition)` - Negate a condition

4. **Checking for empty values**:
   - `{Field} != BLANK()` - Field is not empty
   - `{Field} = ''` - Text field is empty

## Error Handling

The server provides helpful error messages for common issues:

```json
// Invalid select option
{
  "error": "Invalid choice for field \"Status\". Valid choices: Planning, In Progress, On Hold, Completed"
}

// Invalid email format
{
  "error": "Invalid email format for field \"Email\""
}

// Read-only field
{
  "error": "Field type \"formula\" is read-only and cannot be set"
}
```
