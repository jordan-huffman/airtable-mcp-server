# Contributing to Airtable MCP Server

Thank you for your interest in contributing to the Airtable MCP Server! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Code Style](#code-style)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Security Issues](#reporting-security-issues)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow. Please be respectful and professional in all interactions.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/airtable-mcp-server.git
   cd airtable-mcp-server
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/jordan-huffman/airtable-mcp-server.git
   ```

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm (comes with Node.js)
- An Airtable account with a Personal Access Token (for testing)

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your Airtable credentials:
   - `AIRTABLE_PERSONAL_ACCESS_TOKEN` - Your Airtable PAT
   - `AIRTABLE_BASE_ID` - A test base ID

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Run tests**:
   ```bash
   npm test
   ```

### Development Commands

- `npm run dev` - Run the server in development mode with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch mode for TypeScript compilation
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report

## Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
   Or for bug fixes:
   ```bash
   git checkout -b fix/issue-description
   ```

2. **Make your changes** following the code style guidelines

3. **Write or update tests** for your changes

4. **Run tests** to ensure everything passes:
   ```bash
   npm test
   ```

5. **Build the project** to verify no TypeScript errors:
   ```bash
   npm run build
   ```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Writing Tests

- Place unit tests in `src/__tests__/` directory
- Name test files with `.test.ts` extension
- Use Jest and the `@jest/globals` package
- Focus on security tests, edge cases, and critical functionality

Example test structure:
```typescript
import { describe, it, expect } from '@jest/globals';

describe('Feature Name', () => {
  it('should do something correctly', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Test Coverage Goals

- Maintain at least 80% code coverage
- All security-critical code should have 100% coverage
- Test edge cases and error conditions

## Code Style

### TypeScript Guidelines

- **Strict mode**: The project uses TypeScript strict mode
- **Type safety**: Avoid `any` types when possible, use proper type definitions
- **Interfaces**: Define interfaces for complex data structures
- **Naming conventions**:
  - `camelCase` for variables and functions
  - `PascalCase` for types, interfaces, and classes
  - `UPPER_SNAKE_CASE` for constants

### Code Organization

- Keep functions small and focused (single responsibility)
- Use descriptive variable and function names
- Add JSDoc comments for public APIs
- Group imports logically (external, internal, types)

### Error Handling

- Always sanitize error messages to avoid leaking credentials
- Use the error utilities from `src/utils/errors.ts`
- Provide helpful error messages for users
- Log detailed error information for debugging

### Security Considerations

When contributing code, always consider:
- **Input validation**: Validate all user inputs with Zod schemas
- **Formula injection**: Escape special characters in Airtable formulas
- **Credential exposure**: Never log credentials or include them in error messages
- **DoS protection**: Implement limits on resource-intensive operations
- **Type safety**: Use TypeScript's type system to prevent type-related bugs

## Commit Guidelines

### Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no functional changes)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (dependencies, build config)
- `security`: Security improvements or fixes

**Examples**:
```
feat(query): add support for OR conditions in smart queries

Add ability to combine multiple conditions with OR logic
in the airtable_smart_query tool.

Closes #123
```

```
fix(auth): redact personal access tokens from error logs

Previously PATs could leak in error messages. Now all
credentials are properly redacted using sanitizeError().

Security issue reported in #456
```

## Pull Request Process

1. **Update documentation**:
   - Update README.md if you've changed functionality
   - Update CHANGELOG.md under the "Unreleased" section
   - Add JSDoc comments for new functions

2. **Ensure all checks pass**:
   - All tests pass (`npm test`)
   - Build succeeds (`npm run build`)
   - No TypeScript errors
   - Code follows style guidelines

3. **Create pull request**:
   - Use the pull request template
   - Provide a clear description of changes
   - Link related issues
   - Request review from maintainers

4. **Address review feedback**:
   - Respond to comments
   - Make requested changes
   - Update the PR description if needed

5. **Squash commits** (if requested):
   - Maintainers may ask you to squash commits before merging
   - Use `git rebase -i` to combine related commits

### Pull Request Checklist

Before submitting a PR, ensure:

- [ ] Code follows the project's code style
- [ ] All tests pass
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Commit messages follow conventional commits format
- [ ] No sensitive data (credentials, API keys) in code
- [ ] Security considerations addressed
- [ ] TypeScript types are properly defined

## Reporting Security Issues

**DO NOT** open a public issue for security vulnerabilities.

Instead, please report security issues by following the process in [SECURITY.md](SECURITY.md):

1. Email security details to the maintainer
2. Include detailed information about the vulnerability
3. Wait for acknowledgment before disclosing publicly

## Development Scripts Directory

The `scripts/` directory contains development and testing scripts:

- `check-age-field.ts` - Verify age field functionality
- `test-age-query.ts` - Test age range queries
- `test-connection.ts` - Test Airtable connection
- `test-custom-query.ts` - Test custom query building
- `test-field-filtering.ts` - Test field filtering
- `test-multiple-select.ts` - Test multiple select queries

These scripts require valid Airtable credentials in your `.env` file.

## Questions?

If you have questions about contributing:

1. Check the [README.md](README.md) for general documentation
2. Review existing issues and pull requests
3. Open a new issue with the "question" label

## License

By contributing to this project, you agree that your contributions will be licensed under the project's MIT License.

## Thank You!

Thank you for contributing to the Airtable MCP Server! Your efforts help make this project better for everyone.
