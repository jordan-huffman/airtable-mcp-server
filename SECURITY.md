# Security Policy

## Supported Versions

Currently supported versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by emailing the maintainers with the subject line "SECURITY VULNERABILITY - Airtable MCP Server".

Include the following information:
- Type of vulnerability
- Full paths of affected source file(s)
- Location of the affected code (tag/branch/commit/direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability

### What to expect

- **Acknowledgment**: You will receive an acknowledgment within 48 hours
- **Updates**: We will send regular updates about our progress
- **Disclosure**: We follow coordinated disclosure practices
- **Credit**: If you wish, we will credit you in the security advisory

## Security Features

### Input Validation

All tool inputs are validated using Zod schemas with:
- Maximum string lengths (1000 characters)
- Maximum array sizes (100 items for most arrays)
- Maximum record limits (1000 records per query)
- Field name sanitization (alphanumeric + safe special characters only)
- Table name sanitization
- Record ID format validation (`recXXXXXXXXXXXXXX`)

### Formula Injection Protection

- **Escaping**: All user-provided values in formulas are escaped using SQL-style escaping (single quote → double single quote)
- **Field Name Validation**: Field names are sanitized to prevent breaking out of `{FieldName}` context
- **Number Validation**: Numeric values validated as finite numbers to prevent injection via NaN/Infinity
- **Date Validation**: Date values validated against ISO 8601 format

### Error Handling

- **Sanitized Errors**: Error messages are sanitized before being returned to clients
- **No Stack Traces**: Stack traces never exposed to clients (logged server-side only)
- **Credential Redaction**: API keys, base IDs, and tokens automatically redacted from error messages
- **Custom Error Classes**: Type-safe error handling with appropriate HTTP status codes

### Data Protection

- **Attachment Filtering**: Automatically excludes large attachment fields by default to prevent data leaks
- **Field Exclusion**: Supports excluding sensitive fields from responses
- **Long Text Filtering**: Can exclude potentially sensitive long text fields
- **Preset Filters**: Pre-configured field sets (minimal, contact, summary) for safe queries

### Authentication & Authorization

- **PAT Validation**: Personal Access Token validated at startup
- **PAT-Only Authentication**: Only supports Personal Access Tokens (legacy API keys deprecated)
- **No Token Storage**: PATs only stored in environment variables, never in code
- **Token Rotation**: Supports seamless token rotation via environment variable updates
- **Scoped Permissions**: Leverages Airtable's PAT permission system for fine-grained access control

## Security Best Practices

### Environment Variables

**CRITICAL**: Never commit `.env` files to version control!

```bash
# .env (DO NOT COMMIT)
AIRTABLE_PAT=patXXXXXXXXXXXXXXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
```

Add to `.gitignore`:
```gitignore
.env
.env.local
.env.*.local
```

### Personal Access Token (PAT) Security

1. **Use Scoped Permissions**: Create PATs with minimum required scopes (e.g., read-only if possible)
2. **Rotate Regularly**: Rotate PATs every 90 days
3. **Separate Environments**: Use different PATs for development/staging/production
4. **Monitor Usage**: Regularly check Airtable API usage for anomalies
5. **Revoke Unused Tokens**: Remove PATs that are no longer in use
6. **Name Tokens Clearly**: Use descriptive names to track where each PAT is used

### Deployment Security

#### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "airtable": {
      "command": "node",
      "args": ["/absolute/path/to/build/index.js"],
      "env": {
        "AIRTABLE_PAT": "patXXXXXXXXXXXXXXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "AIRTABLE_BASE_ID": "appXXXXXXXXXXXXXX"
      }
    }
  }
}
```

**Security Notes**:
- Use absolute paths to prevent path traversal
- Store config file with restricted permissions: `chmod 600 claude_desktop_config.json`
- Never commit config files with real PATs
- Use separate PATs for each MCP server instance
- Limit PAT scopes to only what's needed (principle of least privilege)

#### Production Deployment

1. **Use Secrets Management**:
   - AWS Secrets Manager
   - HashiCorp Vault
   - Kubernetes Secrets
   - Azure Key Vault

2. **Principle of Least Privilege**:
   - Run MCP server with minimal user permissions
   - Use read-only API keys when possible
   - Limit base access to required tables only

3. **Network Security**:
   - Run behind firewall if exposing over network
   - Use TLS/SSL for all network communication
   - Implement IP whitelisting if applicable

4. **Monitoring & Logging**:
   - Enable structured logging
   - Monitor for unusual API patterns
   - Set up alerts for authentication failures
   - Track API rate limit usage

### Field Filtering (IMPORTANT for Claude Desktop)

**Always use `excludeAttachments=true`** to prevent timeouts and data leakage:

```json
{
  "table": "Contacts",
  "excludeAttachments": true,  // Prevents loading images/files
  "excludeLongText": true,      // Prevents loading large text fields
  "maxRecords": 100             // Limit response size
}
```

Or use presets for common scenarios:

```json
{
  "table": "Contacts",
  "preset": "contact",  // Only returns contact info (no attachments)
  "maxRecords": 50
}
```

Available presets:
- `minimal`: Name and email only
- `contact`: Contact information only
- `summary`: Key fields without attachments
- `full`: All fields (use with caution!)

### Rate Limiting

Airtable has rate limits:
- **5 requests per second per base**
- **100,000 API calls per workspace per day**

To avoid hitting limits:
1. Use `maxRecords` to limit response size
2. Implement client-side caching where appropriate
3. Batch operations when possible
4. Monitor API usage in Airtable dashboard

## Known Security Considerations

### Formula Execution

Custom formulas in `airtable_smart_query` can execute Airtable formula functions. While these are sandboxed by Airtable, be cautious with user-provided formula strings.

**Recommendation**: Prefer using the built-in query builders (`ageRange`, `multipleSelect`, `numberRange`) over `customFormula` when possible.

### Claude Desktop Integration

When using with Claude Desktop:
- Claude has access to ALL tools defined in this MCP server
- Claude can read/write ANY data in the connected Airtable base
- Consider using separate bases for sensitive vs. non-sensitive data
- Use Airtable permissions to restrict what the API key can access

### Read-Only Fields

The following field types are read-only and attempting to set them will throw errors:
- `formula`, `rollup`, `count`, `lookup`
- `createdTime`, `createdBy`, `lastModifiedTime`, `lastModifiedBy`
- `autoNumber`
- `aiText`, `aiImage` (AI-generated fields)

This is a security feature to prevent unintended data modification.

## Security Checklist for Production

- [ ] API keys stored in environment variables (not code)
- [ ] `.env` files added to `.gitignore`
- [ ] Using scoped API keys with minimum permissions
- [ ] API key rotation schedule established
- [ ] Structured logging configured
- [ ] Error monitoring/alerting configured
- [ ] Rate limit monitoring configured
- [ ] Regular security updates scheduled
- [ ] Access logs reviewed regularly
- [ ] Using `excludeAttachments=true` by default
- [ ] Field filtering configured appropriately
- [ ] Running with minimal user permissions
- [ ] Dependencies audit (`npm audit`) passing
- [ ] HTTPS enforced for all attachments
- [ ] Deployment behind firewall/VPN if applicable

## Updates and Patches

Subscribe to security advisories:
- Watch this repository for security updates
- Enable GitHub Dependabot alerts
- Run `npm audit` regularly
- Keep dependencies up to date

## Additional Resources

- [Airtable API Security](https://airtable.com/developers/web/api/authentication)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Model Context Protocol Security](https://modelcontextprotocol.io/docs/security)

## Contact

For security concerns, please contact the maintainers directly rather than opening public issues.

---

**Last Updated**: 2025-01-23
**Version**: 1.0.0
