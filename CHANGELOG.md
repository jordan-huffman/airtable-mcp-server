# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2025-10-31

### Added
- LICENSE file with MIT license text
- Comprehensive project documentation (CHANGELOG, CONTRIBUTING)
- GitHub issue templates for bugs, features, and security reports
- Pull request template
- Dependabot configuration for automated dependency updates
- README badges for npm version, CI status, test coverage, license, and Node version
- CodeQL security scanning workflow for automated vulnerability detection
- Test coverage reporting with Codecov integration
- npm caching in CI workflow for faster builds
- npm audit security check in CI workflow
- `clean` script to remove build artifacts and coverage reports

### Changed
- Moved development test scripts to `scripts/` directory for better organization
- Updated package.json with explicit `files` array to control npm package contents
- Added `types`, `exports`, and `engines` fields to package.json
- Updated GitHub Actions to remove `continue-on-error` from critical steps
- Updated TypeScript configuration to exclude test files from compilation
- Removed empty `src/handlers/` directory
- Enhanced CI workflow with security scanning and coverage reporting
- Updated GitHub Actions dependencies (checkout v5, setup-node v6, github-script v8)
- Updated @modelcontextprotocol/sdk to 1.20.2
- Updated @types/node to 24.9.2

### Fixed
- GitHub workflow files no longer included in npm package
- Test files no longer compiled to build directory
- CI/CD workflows now properly fail on test failures
- Publish workflow release comment issue (now updates release body instead)

## [1.0.2] - 2025-10-31

### Changed
- Tested automated release workflow
- Validated npm publishing process

## [1.0.1] - 2025-10-31

### Added
- GitHub Actions workflow for continuous integration
- Automated npm publishing workflow on releases
- Multi-version Node.js testing (18, 20, 22)

### Changed
- Added repository links to package.json
- Updated package metadata for better npm discoverability

## [1.0.0] - 2025-10-28

### Added
- Initial release of Enhanced Airtable MCP Server
- Support for all Airtable field types including:
  - Single/Multi-line text, Rich text
  - Single/Multiple select fields
  - Number, Currency, Percent fields
  - Date and DateTime fields
  - Checkbox (boolean) fields
  - Email, Phone, URL fields
  - Attachments (file uploads)
  - Linked records (foreign keys)
  - Lookup and Rollup fields
  - Formula fields
  - Rating, Duration, Barcode fields
  - Button, Last modified time/by fields
  - Created time/by fields
  - AI text and AI image fields
- Personal Access Token (PAT) authentication
- 10 MCP tools for Airtable operations:
  - `airtable_list_bases` - List accessible bases
  - `airtable_list_records` - Query records with filtering
  - `airtable_get_record` - Get single record details
  - `airtable_create_record` - Create new records
  - `airtable_update_record` - Update existing records
  - `airtable_delete_record` - Delete records
  - `airtable_set_table_schema` - Set metadata for tables
  - `airtable_query_by_age_range` - Query by date ranges
  - `airtable_query_multiple_select` - Fuzzy match multiple select fields
  - `airtable_smart_query` - Build complex formula queries
- Comprehensive security features:
  - Input validation with Zod schemas
  - Formula injection prevention
  - DoS protection (request limits, string length limits)
  - Credential redaction in error messages
  - Error message sanitization
- Field filtering system to reduce token usage
- Winston-based structured logging
- Comprehensive documentation:
  - README with full API reference
  - QUICKSTART guide for setup
  - EXAMPLES with real-world usage patterns
  - FIELD_TYPES reference for all Airtable field types
  - SECURITY documentation with best practices
- Jest test suite with 23 security-focused tests
- TypeScript with strict mode
- ESM module support

### Security
- Zero known vulnerabilities in dependencies
- Secure credential handling with environment variables
- Protection against common attacks (SQL injection, formula injection, DoS)
- Comprehensive input validation
- Automatic credential redaction in logs and errors

[Unreleased]: https://github.com/jordan-huffman/airtable-mcp-server/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/jordan-huffman/airtable-mcp-server/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/jordan-huffman/airtable-mcp-server/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/jordan-huffman/airtable-mcp-server/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/jordan-huffman/airtable-mcp-server/releases/tag/v1.0.0
