# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-28

### Added

#### Core Features
- **Secret Detection Engine**: Comprehensive regex-based pattern detection for API keys, tokens, and credentials
- **Entropy Analysis**: High-entropy string detection using Shannon entropy calculation (threshold ≥ 4.0)
- **Git Integration**: Automatic pre-commit hook setup using Husky for seamless Git workflow integration
- **Zero-Config Setup**: Automatic installation and configuration during `npm install`

#### Supported Secret Types
- AWS Access Keys and Secret Keys
- Google API Keys
- Stripe API Keys (live and test)
- GitHub Personal Access Tokens
- Firebase API Keys
- JWT Tokens
- Bearer Tokens
- OAuth Tokens
- Private Keys (RSA, DSA, EC)
- Generic high-entropy strings

#### CLI Interface
- **Default Mode**: Scan staged files before commit
- **Scan All Mode**: `--scan-all` to scan entire codebase
- **Fix Mode**: `--fix` to automatically redact detected secrets
- **Report Mode**: `--report` to generate JSON reports for CI/CD integration
- **Custom Config**: `--config` to specify custom configuration file

#### Configuration System
- Support for `.sealcommitrc` files in JSON and YAML formats
- Custom regex patterns for project-specific secret detection
- Allowlist functionality to skip known safe strings
- File and directory ignore patterns
- Configurable entropy thresholds and string length limits

#### Output and Reporting
- Color-coded terminal output with file paths and line numbers
- JSON report generation for automated processing
- Truncated secret display for security
- Grouped findings by file and secret type
- Progress indicators and user-friendly error messages

#### Cross-Platform Support
- Full compatibility with Linux, macOS, and Windows
- Monorepo and npm workspace support
- Proper path handling across different operating systems
- Lightweight dependency footprint

#### Security Features
- Commit override capability with `--no-verify` and clear warnings
- Audit logging for bypassed secret detections
- Memory-safe secret handling
- Secure temporary file management

#### Developer Experience
- Comprehensive documentation and usage examples
- Example configuration files for different use cases
- Clear error messages with suggested solutions
- Integration with popular development tools

### Technical Implementation
- **Architecture**: Modular design with clear separation of concerns
- **Performance**: Parallel file processing and optimized regex compilation
- **Testing**: Comprehensive unit, integration, and performance test suites
- **Error Handling**: Graceful degradation with detailed error reporting
- **Memory Management**: Efficient handling of large files and repositories

### Package Information
- **NPM Package**: Available as `seal-commit`
- **Node.js Support**: Requires Node.js ≥ 16.0.0
- **Installation**: `npm install --save-dev seal-commit`
- **Usage**: `npx seal-commit` or automatic via Git hooks

### Documentation
- Complete README with installation and usage instructions
- Configuration guide with all available options
- Troubleshooting guide for common issues
- Example configurations for various project types
- API documentation for programmatic usage

[1.0.0]: https://github.com/seal-commit/seal-commit/releases/tag/v1.0.0