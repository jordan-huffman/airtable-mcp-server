# Quick Start Guide

Get up and running with the Enhanced Airtable MCP Server in minutes.

## Prerequisites

- Node.js 18+ installed
- An Airtable account with API access
- Airtable API key and Base ID

## Step 1: Get Your Airtable Credentials

### API Key
1. Go to https://airtable.com/account
2. In the "API" section, click "Generate API key"
3. Copy your API key (starts with `key...` or `pat...`)

### Base ID
1. Open your Airtable base in your browser
2. Look at the URL: `https://airtable.com/appXXXXXXXXXXXXXX/...`
3. The part starting with `app` is your Base ID

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Build the Project

```bash
npm run build
```

## Step 4: Test Locally (Optional)

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```
AIRTABLE_API_KEY=your_actual_api_key
AIRTABLE_BASE_ID=your_actual_base_id
```

Run the server:

```bash
npm run dev
```

## Step 5: Configure Claude Desktop

### Find Your Config File

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

### Add the Server Configuration

Edit the config file and add:

```json
{
  "mcpServers": {
    "airtable": {
      "command": "node",
      "args": ["/FULL/PATH/TO/airtable-mcp-server/build/index.js"],
      "env": {
        "AIRTABLE_API_KEY": "your_api_key_here",
        "AIRTABLE_BASE_ID": "your_base_id_here"
      }
    }
  }
}
```

**Important**: Replace `/FULL/PATH/TO/airtable-mcp-server` with the actual absolute path to this project.

To get the full path, run this in the project directory:

```bash
pwd
```

### Example Configuration

If your project is at `/Users/jordan/Projects/airtable-mcp-server`, your config should look like:

```json
{
  "mcpServers": {
    "airtable": {
      "command": "node",
      "args": ["/Users/jordan/Projects/airtable-mcp-server/build/index.js"],
      "env": {
        "AIRTABLE_API_KEY": "keyXXXXXXXXXXXXXX",
        "AIRTABLE_BASE_ID": "appYYYYYYYYYYYYYY"
      }
    }
  }
}
```

## Step 6: Restart Claude Desktop

Completely quit and restart Claude Desktop for the changes to take effect.

## Step 7: Verify It's Working

In Claude Desktop, try asking:

> "Can you list the available tools for Airtable?"

You should see tools like:
- `airtable_list_records`
- `airtable_get_record`
- `airtable_create_record`
- `airtable_update_record`
- `airtable_delete_record`
- `airtable_set_table_schema`

## Your First Commands

### List Records from a Table

> "Show me all records from my Tasks table"

### Create a Record

> "Create a new task in my Tasks table with name 'Review documentation', status 'To Do', and due date '2024-10-30'"

### Set Up Schema (Recommended)

> "Set up the schema for my Projects table. It has these fields:
> - Name (text)
> - Status (single select: Planning, In Progress, On Hold, Completed)
> - Priority (single select: Low, Medium, High, Urgent)
> - Start Date (date)
> - Budget (currency)
> - Active (checkbox)"

## Common Issues

### "Command not found" or Server Won't Start

**Issue**: The path to the server is incorrect.

**Solution**:
1. Run `pwd` in the project directory
2. Copy the full path
3. Update your config with the complete path to `build/index.js`

### "AIRTABLE_API_KEY is required"

**Issue**: Environment variables not set correctly.

**Solution**:
- Make sure your API key and Base ID are in the `env` section of the config
- Check for typos in the key names
- Ensure the values are strings in quotes

### No Tools Showing Up

**Issue**: Claude Desktop hasn't loaded the server.

**Solution**:
1. Completely quit Claude Desktop (not just close the window)
2. Check the config file syntax is valid JSON
3. Restart Claude Desktop
4. Check Claude Desktop's logs for errors

### Wrong Base Being Accessed

**Issue**: Viewing data from a different Airtable base.

**Solution**:
- Double-check your Base ID in the config
- Each base has a unique ID starting with `app`
- You can run multiple instances for different bases with different names

## Next Steps

- Read [README.md](README.md) for detailed documentation
- Check out [EXAMPLES.md](EXAMPLES.md) for usage examples
- Learn about [Airtable formulas](https://support.airtable.com/docs/formula-field-reference) for advanced filtering

## Advanced: Multiple Bases

To work with multiple Airtable bases, add multiple server configurations:

```json
{
  "mcpServers": {
    "airtable-projects": {
      "command": "node",
      "args": ["/path/to/airtable-mcp-server/build/index.js"],
      "env": {
        "AIRTABLE_API_KEY": "key123",
        "AIRTABLE_BASE_ID": "appProjects"
      }
    },
    "airtable-customers": {
      "command": "node",
      "args": ["/path/to/airtable-mcp-server/build/index.js"],
      "env": {
        "AIRTABLE_API_KEY": "key123",
        "AIRTABLE_BASE_ID": "appCustomers"
      }
    }
  }
}
```

## Support

If you encounter issues:

1. Check the build compiled successfully: `npm run build`
2. Test locally first: `npm run dev`
3. Verify your Airtable credentials work in the Airtable web interface
4. Check Claude Desktop logs for error messages
5. Review the examples in [EXAMPLES.md](EXAMPLES.md)

Happy automating with Airtable!
