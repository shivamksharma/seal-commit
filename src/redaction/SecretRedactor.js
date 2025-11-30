import fs from 'fs';
import { SealCommitError } from '../errors/SealCommitError.js';

/**
 * SecretRedactor - Handles automatic redaction of detected secrets in files
 * Creates backups before making changes and provides safe redaction operations
 */
export class SecretRedactor {
  constructor(config = {}) {
    this.config = {
      backupSuffix: '.seal-backup',
      redactionMask: '[REDACTED]',
      createBackups: true,
      dryRun: false,
      ...config
    };
  }

  /**
   * Redact secrets from multiple files based on scan results
   * @param {ScanResult} scanResult - The scan results containing findings
   * @param {Object} options - Redaction options
   * @returns {Promise<Object>} Redaction results with statistics
   */
  async redactSecrets(scanResult, options = {}) {
    const redactionOptions = { ...this.config, ...options };
    const results = {
      filesProcessed: 0,
      secretsRedacted: 0,
      backupsCreated: 0,
      errors: [],
      processedFiles: []
    };

    if (!scanResult || !scanResult.hasSecrets) {
      return results;
    }

    // Group findings by file for efficient processing
    const findingsByFile = scanResult.groupByFile();

    // Process each file
    for (const [filePath, findings] of Object.entries(findingsByFile)) {
      try {
        const fileResult = await this.redactSecretsInFile(filePath, findings, redactionOptions);
        
        results.filesProcessed++;
        results.secretsRedacted += fileResult.secretsRedacted;
        
        if (fileResult.backupCreated) {
          results.backupsCreated++;
        }
        
        results.processedFiles.push({
          filePath,
          secretsRedacted: fileResult.secretsRedacted,
          backupCreated: fileResult.backupCreated,
          backupPath: fileResult.backupPath
        });

      } catch (error) {
        results.errors.push({
          filePath,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Redact secrets in a single file
   * @param {string} filePath - Path to the file to process
   * @param {Finding[]} findings - Array of findings for this file
   * @param {Object} options - Redaction options
   * @returns {Promise<Object>} File processing results
   */
  async redactSecretsInFile(filePath, findings, options = {}) {
    const result = {
      secretsRedacted: 0,
      backupCreated: false,
      backupPath: null
    };

    // Validate file exists and is readable
    if (!fs.existsSync(filePath)) {
      throw new SealCommitError(`File not found: ${filePath}`, 'FILE_NOT_FOUND');
    }

    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      throw new SealCommitError(`Not a file: ${filePath}`, 'NOT_A_FILE');
    }

    // Read original file content
    let originalContent;
    try {
      originalContent = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      throw new SealCommitError(
        `Failed to read file ${filePath}: ${error.message}`, 
        'FILE_READ_ERROR'
      );
    }

    // Create backup if requested
    if (options.createBackups && !options.dryRun) {
      const backupPath = this.createBackup(filePath, originalContent, options.backupSuffix);
      result.backupCreated = true;
      result.backupPath = backupPath;
    }

    // Sort findings by position (reverse order to maintain positions during replacement)
    const sortedFindings = findings.sort((a, b) => {
      if (a.lineNumber !== b.lineNumber) {
        return b.lineNumber - a.lineNumber;
      }
      return b.columnStart - a.columnStart;
    });

    // Apply redactions
    let modifiedContent = originalContent;
    const lines = modifiedContent.split('\n');

    for (const finding of sortedFindings) {
      try {
        const redactedLines = this.redactSecretInLines(
          lines, 
          finding, 
          options.redactionMask || this.config.redactionMask
        );
        
        if (redactedLines) {
          // Update the lines array with redacted content
          lines.splice(0, lines.length, ...redactedLines);
          result.secretsRedacted++;
        }
      } catch (error) {
        // Log warning but continue with other findings
        console.warn(`Warning: Failed to redact secret at ${filePath}:${finding.lineNumber}: ${error.message}`);
      }
    }

    // Write modified content back to file (unless dry run)
    if (!options.dryRun && result.secretsRedacted > 0) {
      const finalContent = lines.join('\n');
      
      try {
        fs.writeFileSync(filePath, finalContent, 'utf8');
      } catch (error) {
        throw new SealCommitError(
          `Failed to write redacted content to ${filePath}: ${error.message}`, 
          'FILE_WRITE_ERROR'
        );
      }
    }

    return result;
  }

  /**
   * Redact a specific secret in the lines array
   * @param {string[]} lines - Array of file lines
   * @param {Finding} finding - The finding to redact
   * @param {string} redactionMask - The mask to use for redaction
   * @returns {string[]|null} Modified lines array or null if no changes
   */
  redactSecretInLines(lines, finding, redactionMask) {
    const lineIndex = finding.lineNumber - 1; // Convert to 0-based index
    
    if (lineIndex < 0 || lineIndex >= lines.length) {
      throw new Error(`Line number ${finding.lineNumber} is out of range`);
    }

    const originalLine = lines[lineIndex];
    const secretStart = finding.columnStart;
    const secretEnd = finding.columnEnd;

    // Validate column positions
    if (secretStart < 0 || secretEnd > originalLine.length || secretStart >= secretEnd) {
      throw new Error(`Invalid column range: ${secretStart}-${secretEnd} for line length ${originalLine.length}`);
    }

    // Extract the secret from the line to verify it matches
    const extractedSecret = originalLine.substring(secretStart, secretEnd);
    if (extractedSecret !== finding.match) {
      // Try to find the secret in the line (in case positions shifted)
      const secretIndex = originalLine.indexOf(finding.match);
      if (secretIndex === -1) {
        throw new Error(`Secret not found in expected position. Expected: "${finding.match}"`);
      }
      
      // Update positions based on actual location
      const actualStart = secretIndex;
      const actualEnd = secretIndex + finding.match.length;
      
      // Redact using actual positions
      const redactedLine = originalLine.substring(0, actualStart) + 
                          redactionMask + 
                          originalLine.substring(actualEnd);
      
      const newLines = [...lines];
      newLines[lineIndex] = redactedLine;
      return newLines;
    }

    // Redact the secret
    const redactedLine = originalLine.substring(0, secretStart) + 
                        redactionMask + 
                        originalLine.substring(secretEnd);

    const newLines = [...lines];
    newLines[lineIndex] = redactedLine;
    return newLines;
  }

  /**
   * Create a backup of the original file
   * @param {string} filePath - Path to the original file
   * @param {string} content - Content to backup
   * @param {string} backupSuffix - Suffix for backup file
   * @returns {string} Path to the backup file
   */
  createBackup(filePath, content, backupSuffix = '.seal-backup') {
    const backupPath = filePath + backupSuffix;
    
    try {
      fs.writeFileSync(backupPath, content, 'utf8');
      return backupPath;
    } catch (error) {
      throw new SealCommitError(
        `Failed to create backup at ${backupPath}: ${error.message}`, 
        'BACKUP_CREATION_ERROR'
      );
    }
  }

  /**
   * Restore files from backups
   * @param {string[]} filePaths - Array of file paths to restore
   * @param {string} backupSuffix - Suffix used for backup files
   * @returns {Object} Restoration results
   */
  async restoreFromBackups(filePaths, backupSuffix = '.seal-backup') {
    const results = {
      filesRestored: 0,
      errors: []
    };

    for (const filePath of filePaths) {
      const backupPath = filePath + backupSuffix;
      
      try {
        if (!fs.existsSync(backupPath)) {
          results.errors.push({
            filePath,
            error: `Backup file not found: ${backupPath}`
          });
          continue;
        }

        const backupContent = fs.readFileSync(backupPath, 'utf8');
        fs.writeFileSync(filePath, backupContent, 'utf8');
        
        // Remove backup file after successful restoration
        fs.unlinkSync(backupPath);
        
        results.filesRestored++;
      } catch (error) {
        results.errors.push({
          filePath,
          error: `Failed to restore from backup: ${error.message}`
        });
      }
    }

    return results;
  }

  /**
   * Clean up backup files
   * @param {string[]} backupPaths - Array of backup file paths to remove
   * @returns {Object} Cleanup results
   */
  async cleanupBackups(backupPaths) {
    const results = {
      backupsRemoved: 0,
      errors: []
    };

    for (const backupPath of backupPaths) {
      try {
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
          results.backupsRemoved++;
        }
      } catch (error) {
        results.errors.push({
          backupPath,
          error: `Failed to remove backup: ${error.message}`
        });
      }
    }

    return results;
  }

  /**
   * Validate redaction configuration
   * @param {Object} config - Configuration to validate
   * @returns {boolean} True if configuration is valid
   */
  validateConfig(config) {
    if (config.redactionMask && typeof config.redactionMask !== 'string') {
      throw new Error('redactionMask must be a string');
    }

    if (config.backupSuffix && typeof config.backupSuffix !== 'string') {
      throw new Error('backupSuffix must be a string');
    }

    if (config.createBackups !== undefined && typeof config.createBackups !== 'boolean') {
      throw new Error('createBackups must be a boolean');
    }

    if (config.dryRun !== undefined && typeof config.dryRun !== 'boolean') {
      throw new Error('dryRun must be a boolean');
    }

    return true;
  }

  /**
   * Get redaction statistics for a scan result
   * @param {ScanResult} scanResult - The scan results to analyze
   * @returns {Object} Statistics about what would be redacted
   */
  getRedactionStats(scanResult) {
    if (!scanResult || !scanResult.hasSecrets) {
      return {
        totalSecrets: 0,
        affectedFiles: 0,
        secretsByType: {},
        secretsByCategory: {}
      };
    }

    const findingsByFile = scanResult.groupByFile();
    const findingsByType = scanResult.groupByType();
    const findingsByCategory = scanResult.groupByCategory();

    return {
      totalSecrets: scanResult.findings.length,
      affectedFiles: Object.keys(findingsByFile).length,
      secretsByType: Object.keys(findingsByType).reduce((acc, type) => {
        acc[type] = findingsByType[type].length;
        return acc;
      }, {}),
      secretsByCategory: Object.keys(findingsByCategory).reduce((acc, category) => {
        acc[category] = findingsByCategory[category].length;
        return acc;
      }, {})
    };
  }
}