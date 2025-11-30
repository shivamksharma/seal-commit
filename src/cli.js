#!/usr/bin/env node

import { Command } from 'commander';
import { ConfigManager } from './config/ConfigManager.js';
import { SecretScanner } from './SecretScanner.js';
import { SecretRedactor } from './redaction/SecretRedactor.js';
import { gitUtils } from './git/GitUtils.js';
import { TerminalFormatter } from './output/TerminalFormatter.js';
import { JSONReportGenerator } from './output/JSONReportGenerator.js';
import { ErrorHandler } from './errors/SealCommitError.js';
import { AuditLogger } from './audit/AuditLogger.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

/**
 * Main CLI class that handles command-line interface and orchestrates the application
 */
export class CLI {
  constructor() {
    this.program = new Command();
    this.errorHandler = new ErrorHandler({ verbose: false, exitOnError: true });
    this.setupCommands();
  }

  /**
   * Set up all CLI commands and options
   */
  setupCommands() {
    this.program
      .name('seal-commit')
      .description('Detect and block API keys, secrets, tokens, or credentials from being committed to Git repositories')
      .version('1.0.0');

    // Default command (check staged files)
    this.program
      .command('check', { isDefault: true })
      .description('Check staged files for secrets (default command)')
      .option('-c, --config <path>', 'Path to configuration file')
      .option('--no-colors', 'Disable colored output')
      .option('-v, --verbose', 'Enable verbose output')
      .option('-r, --report <path>', 'Generate JSON report at specified path')
      .action((options) => this.handleCheckCommand(options));

    // Scan all files command
    this.program
      .command('scan-all')
      .description('Scan all tracked files in the repository')
      .option('-c, --config <path>', 'Path to configuration file')
      .option('--no-colors', 'Disable colored output')
      .option('-v, --verbose', 'Enable verbose output')
      .option('-r, --report <path>', 'Generate JSON report at specified path')
      .action((options) => this.handleScanAllCommand(options));

    // Fix command (placeholder for future implementation)
    this.program
      .command('fix')
      .description('Attempt to redact or remove detected secrets')
      .option('-c, --config <path>', 'Path to configuration file')
      .option('--no-colors', 'Disable colored output')
      .option('-v, --verbose', 'Enable verbose output')
      .option('--backup', 'Create backup files before making changes')
      .action((options) => this.handleFixCommand(options));

    // Global error handling
    this.program.exitOverride();
  }

  /**
   * Handle the default check command (scan staged files)
   * @param {Object} options - Command options
   */
  async handleCheckCommand(options) {
    try {
      // Update error handler verbosity
      this.errorHandler.verbose = options.verbose || false;

      // Load configuration
      const configManager = new ConfigManager(options.config);
      const config = configManager.getConfig();

      // Validate Git repository
      gitUtils.validateGitRepository();

      // Get staged files
      const stagedFiles = gitUtils.getStagedFiles();
      
      if (stagedFiles.length === 0) {
        const formatter = new TerminalFormatter({ 
          colors: options.colors !== false, 
          verbose: options.verbose 
        });
        console.log(formatter.formatInfo('No staged files to scan'));
        return;
      }

      // Convert relative paths to absolute paths
      const repoRoot = gitUtils.getRepositoryRoot();
      const absolutePaths = stagedFiles.map(file => path.resolve(repoRoot, file));

      // Scan files
      const scanner = new SecretScanner(config);
      const scanResult = await scanner.scanFiles(absolutePaths);

      // Format and display results
      await this.displayResults(scanResult, options, { scanMode: 'staged-files', config });

      // Exit with appropriate code
      process.exit(scanResult.hasSecrets ? 1 : 0);

    } catch (error) {
      this.errorHandler.handle(error, { operation: 'check-staged-files' });
    }
  }

  /**
   * Handle the scan-all command (scan all tracked files)
   * @param {Object} options - Command options
   */
  async handleScanAllCommand(options) {
    try {
      // Update error handler verbosity
      this.errorHandler.verbose = options.verbose || false;

      // Load configuration
      const configManager = new ConfigManager(options.config);
      const config = configManager.getConfig();

      // Validate Git repository
      gitUtils.validateGitRepository();

      // Get all tracked files
      const trackedFiles = gitUtils.getAllTrackedFiles();
      
      if (trackedFiles.length === 0) {
        const formatter = new TerminalFormatter({ 
          colors: options.colors !== false, 
          verbose: options.verbose 
        });
        console.log(formatter.formatInfo('No tracked files to scan'));
        return;
      }

      // Convert relative paths to absolute paths
      const repoRoot = gitUtils.getRepositoryRoot();
      const absolutePaths = trackedFiles.map(file => path.resolve(repoRoot, file));

      // Scan files
      const scanner = new SecretScanner(config);
      const scanResult = await scanner.scanFiles(absolutePaths);

      // Format and display results
      await this.displayResults(scanResult, options, { scanMode: 'all-files', config });

      // Exit with appropriate code
      process.exit(scanResult.hasSecrets ? 1 : 0);

    } catch (error) {
      this.errorHandler.handle(error, { operation: 'scan-all-files' });
    }
  }

  /**
   * Handle the fix command (redact secrets)
   * @param {Object} options - Command options
   */
  async handleFixCommand(options) {
    try {
      // Update error handler verbosity
      this.errorHandler.verbose = options.verbose || false;

      const formatter = new TerminalFormatter({ 
        colors: options.colors !== false, 
        verbose: options.verbose 
      });

      // Load configuration
      const configManager = new ConfigManager(options.config);
      const config = configManager.getConfig();

      // Validate Git repository
      gitUtils.validateGitRepository();

      // Get staged files (fix command works on staged files by default)
      const stagedFiles = gitUtils.getStagedFiles();
      
      if (stagedFiles.length === 0) {
        console.log(formatter.formatInfo('No staged files to scan and fix'));
        return;
      }

      // Convert relative paths to absolute paths
      const repoRoot = gitUtils.getRepositoryRoot();
      const absolutePaths = stagedFiles.map(file => path.resolve(repoRoot, file));

      // First, scan files to find secrets
      console.log(formatter.formatInfo('Scanning staged files for secrets...'));
      const scanner = new SecretScanner(config);
      const scanResult = await scanner.scanFiles(absolutePaths);

      if (!scanResult.hasSecrets) {
        console.log(formatter.formatSuccess('No secrets found in staged files'));
        return;
      }

      // Display what will be redacted
      console.log(formatter.formatScanResult(scanResult));
      
      // Create redactor with configuration
      const redactor = new SecretRedactor({
        createBackups: options.backup !== false, // Default to true, can be disabled
        redactionMask: config.redaction?.mask || '[REDACTED]',
        backupSuffix: config.redaction?.backupSuffix || '.seal-backup'
      });

      // Get redaction statistics
      const stats = redactor.getRedactionStats(scanResult);
      console.log(formatter.formatInfo(
        `About to redact ${stats.totalSecrets} secret(s) in ${stats.affectedFiles} file(s)`
      ));

      if (options.backup !== false) {
        console.log(formatter.formatInfo('Backup files will be created before making changes'));
      }

      // Perform redaction
      console.log(formatter.formatInfo('Redacting secrets...'));
      const redactionResult = await redactor.redactSecrets(scanResult, {
        createBackups: options.backup !== false,
        dryRun: false
      });

      // Display results
      if (redactionResult.errors.length > 0) {
        console.log(formatter.formatWarning(`Encountered ${redactionResult.errors.length} error(s):`));
        redactionResult.errors.forEach(error => {
          console.log(formatter.formatError(`  ${error.filePath}: ${error.error}`));
        });
      }

      if (redactionResult.secretsRedacted > 0) {
        console.log(formatter.formatSuccess(
          `Successfully redacted ${redactionResult.secretsRedacted} secret(s) in ${redactionResult.filesProcessed} file(s)`
        ));

        if (redactionResult.backupsCreated > 0) {
          console.log(formatter.formatInfo(
            `Created ${redactionResult.backupsCreated} backup file(s)`
          ));
          console.log(formatter.formatInfo(
            'You can restore original files using the backup files if needed'
          ));
        }

        // Show which files were modified
        if (options.verbose) {
          console.log(formatter.formatInfo('Modified files:'));
          redactionResult.processedFiles.forEach(file => {
            console.log(`  ${file.filePath} (${file.secretsRedacted} secret(s) redacted)`);
            if (file.backupCreated) {
              console.log(`    Backup: ${file.backupPath}`);
            }
          });
        }
      } else {
        console.log(formatter.formatWarning('No secrets were redacted'));
      }

      // Exit with success code
      process.exit(0);

    } catch (error) {
      this.errorHandler.handle(error, { operation: 'fix-secrets' });
    }
  }

  /**
   * Display scan results using appropriate formatter
   * @param {ScanResult} scanResult - The scan results
   * @param {Object} options - Command options
   * @param {Object} context - Additional context for reporting
   */
  async displayResults(scanResult, options, context = {}) {
    const formatter = new TerminalFormatter({ 
      colors: options.colors !== false, 
      verbose: options.verbose 
    });

    // Initialize audit logger
    const auditLogger = new AuditLogger({
      enabled: context.config?.audit?.enabled !== false, // Default to enabled
      logPath: context.config?.audit?.logPath,
      includeContext: options.verbose
    });

    // Always display terminal output
    const terminalOutput = formatter.formatScanResult(scanResult);
    console.log(terminalOutput);

    // Log secret detection event if secrets were found
    if (scanResult.hasSecrets) {
      auditLogger.logSecretDetection(
        {
          action: context.scanMode === 'staged-files' ? 'COMMIT_BLOCKED' : 'SECRETS_DETECTED'
        },
        scanResult,
        context
      );

      // Store scan result for potential bypass correlation
      if (context.scanMode === 'staged-files') {
        const { BypassDetector } = await import('./git/BypassDetector.js');
        const bypassDetector = new BypassDetector({
          verbose: options.verbose,
          auditLogger: { enabled: context.config?.audit?.enabled !== false }
        });
        bypassDetector.storeScanResult(scanResult);
      }

      // Show bypass instructions and warning if secrets were found in staged files
      if (context.scanMode === 'staged-files') {
        console.log(formatter.formatBypassInstructions());
        
        // Show additional warning about audit logging
        console.log(formatter.formatWarning(
          'This security event has been logged for audit purposes.'
        ));
      }
    }

    // Generate JSON report if requested
    if (options.report) {
      try {
        const reportGenerator = new JSONReportGenerator({
          includeMetadata: true,
          includeContext: options.verbose,
          prettyPrint: true,
          includeStats: true
        });

        await reportGenerator.generateAndWriteReport(
          scanResult, 
          options.report, 
          context
        );

        console.log(formatter.formatSuccess(`Report written to ${options.report}`));
      } catch (error) {
        console.error(formatter.formatError(error));
      }
    }
  }

  /**
   * Run the CLI with provided arguments
   * @param {string[]} argv - Command line arguments
   */
  async run(argv = process.argv) {
    try {
      await this.program.parseAsync(argv);
    } catch (error) {
      // Handle Commander.js errors
      if (error.code === 'commander.unknownCommand') {
        console.error(`❌ Unknown command: ${error.message}`);
        this.program.help();
      } else if (error.code === 'commander.invalidArgument') {
        console.error(`❌ Invalid argument: ${error.message}`);
        process.exit(1);
      } else if (error.code === 'commander.help' || error.message === '(outputHelp)') {
        // Help was requested, this is normal behavior
        process.exit(0);
      } else if (error.code === 'commander.version' || error.message === '1.0.0') {
        // Version was requested, this is normal behavior
        process.exit(0);
      } else {
        // Handle other errors through our error handler
        this.errorHandler.handle(error, { operation: 'cli-execution' });
      }
    }
  }

  /**
   * Get the Commander.js program instance (for testing)
   * @returns {Command} The Commander program
   */
  getProgram() {
    return this.program;
  }
}

// Create and run CLI if this file is executed directly
// In ES modules, we check if this module is the main entry point
const currentFilePath = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && (
  fs.realpathSync(currentFilePath) === fs.realpathSync(process.argv[1]) ||
  currentFilePath === process.argv[1]
);

if (isMainModule) {
  const cli = new CLI();
  cli.run().catch(error => {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  });
}
