import chalk from 'chalk';

/**
 * TerminalFormatter class for creating colored and formatted terminal output
 * Handles progress indicators, error messages, and finding displays
 */
export class TerminalFormatter {
  constructor(options = {}) {
    this.colors = options.colors !== false; // Default to true unless explicitly disabled
    this.verbose = options.verbose || false;
    this.showProgress = options.showProgress !== false;
  }

  /**
   * Formats a scan result for terminal display
   * @param {ScanResult} scanResult - The scan result to format
   * @returns {string} Formatted terminal output
   */
  formatScanResult(scanResult) {
    if (!scanResult.hasSecrets) {
      return this.formatSuccessResult(scanResult);
    }

    return this.formatFailureResult(scanResult);
  }

  /**
   * Formats a successful scan result (no secrets found)
   * @param {ScanResult} scanResult - The scan result
   * @returns {string} Formatted success message
   */
  formatSuccessResult(scanResult) {
    const summary = scanResult.getSummary();
    const checkmark = this.colors ? chalk.green('✅') : '[OK]';
    const stats = this.colors ? 
      chalk.gray(`(${summary.filesScanned} files, ${summary.totalLines} lines, ${summary.scanDuration}ms)`) :
      `(${summary.filesScanned} files, ${summary.totalLines} lines, ${summary.scanDuration}ms)`;

    return `${checkmark} No secrets detected ${stats}`;
  }

  /**
   * Formats a failed scan result (secrets found)
   * @param {ScanResult} scanResult - The scan result
   * @returns {string} Formatted failure message with findings
   */
  formatFailureResult(scanResult) {
    const summary = scanResult.getSummary();
    const crossmark = this.colors ? chalk.red('❌') : '[FAIL]';
    const header = `${crossmark} Found ${summary.totalFindings} secret(s) in ${summary.filesWithSecrets} file(s):\n`;

    const findingsOutput = this.formatFindings(scanResult);
    const summaryOutput = this.formatSummary(scanResult);

    return `${header}\n${findingsOutput}\n${summaryOutput}`;
  }

  /**
   * Formats individual findings grouped by file
   * @param {ScanResult} scanResult - The scan result
   * @returns {string} Formatted findings output
   */
  formatFindings(scanResult) {
    const byFile = scanResult.groupByFile();
    let output = '';

    Object.entries(byFile).forEach(([filePath, findings]) => {
      const fileIcon = this.colors ? chalk.blue('📁') : '[FILE]';
      const fileName = this.colors ? chalk.bold.blue(filePath) : filePath;
      const count = this.colors ? chalk.gray(`(${findings.length} finding(s))`) : `(${findings.length} finding(s))`;
      
      output += `${fileIcon} ${fileName} ${count}\n`;
      
      findings.forEach(finding => {
        output += this.formatFinding(finding);
      });
      
      output += '\n';
    });

    return output.trim();
  }

  /**
   * Formats a single finding
   * @param {Finding} finding - The finding to format
   * @returns {string} Formatted finding output
   */
  formatFinding(finding) {
    const indent = '  ';
    const location = `${finding.filePath}:${finding.lineNumber}:${finding.columnStart}`;
    const typeLabel = this.getTypeLabel(finding.type);
    const categoryLabel = this.getCategoryLabel(finding.category);
    const confidenceStr = finding.confidence !== undefined ? 
      ` ${this.formatConfidence(finding.confidence)}` : '';

    let output = `${indent}${typeLabel} ${categoryLabel} at ${this.formatLocation(location)}${confidenceStr}\n`;
    output += `${indent}${this.formatMatch(finding.truncatedMatch)}\n`;

    if (this.verbose && finding.context && finding.context.length > 0) {
      output += this.formatContext(finding.context, finding.lineNumber);
    }

    return output;
  }

  /**
   * Gets a colored type label for the finding type
   * @param {string} type - The finding type ('pattern' or 'entropy')
   * @returns {string} Formatted type label
   */
  getTypeLabel(type) {
    if (!this.colors) {
      return `[${type.toUpperCase()}]`;
    }

    switch (type) {
    case 'pattern':
      return chalk.yellow.bold('[PATTERN]');
    case 'entropy':
      return chalk.magenta.bold('[ENTROPY]');
    default:
      return chalk.gray.bold(`[${type.toUpperCase()}]`);
    }
  }

  /**
   * Gets a formatted category label
   * @param {string} category - The finding category
   * @returns {string} Formatted category label
   */
  getCategoryLabel(category) {
    if (!this.colors) {
      return category;
    }

    // Color-code common categories
    const categoryColors = {
      'aws-key': chalk.orange,
      'google-key': chalk.blue,
      'github-token': chalk.black.bgWhite,
      'stripe-key': chalk.purple,
      'jwt': chalk.cyan,
      'bearer-token': chalk.green,
      'private-key': chalk.red,
      'high-entropy': chalk.magenta
    };

    const colorFn = categoryColors[category] || chalk.white;
    return colorFn(category);
  }

  /**
   * Formats the file location
   * @param {string} location - The location string (file:line:column)
   * @returns {string} Formatted location
   */
  formatLocation(location) {
    if (!this.colors) {
      return location;
    }

    return chalk.gray(location);
  }

  /**
   * Formats the matched secret string
   * @param {string} match - The truncated match string
   * @returns {string} Formatted match
   */
  formatMatch(match) {
    const prefix = this.colors ? chalk.gray('Match: ') : 'Match: ';
    const matchText = this.colors ? chalk.red.bold(match) : match;
    
    return `${prefix}${matchText}`;
  }

  /**
   * Formats confidence score
   * @param {number} confidence - Confidence score (0.0 - 1.0)
   * @returns {string} Formatted confidence
   */
  formatConfidence(confidence) {
    const percentage = (confidence * 100).toFixed(1);
    
    if (!this.colors) {
      return `(confidence: ${percentage}%)`;
    }

    let color;
    if (confidence >= 0.8) {
      color = chalk.red;
    } else if (confidence >= 0.6) {
      color = chalk.yellow;
    } else {
      color = chalk.gray;
    }

    return color(`(confidence: ${percentage}%)`);
  }

  /**
   * Formats context lines around a finding
   * @param {string[]} context - Array of context lines
   * @param {number} findingLineNumber - Line number of the finding
   * @returns {string} Formatted context
   */
  formatContext(context, findingLineNumber) {
    if (!context || context.length === 0) {
      return '';
    }

    const indent = '    ';
    let output = `${indent}${this.colors ? chalk.gray('Context:') : 'Context:'}\n`;

    context.forEach((line, index) => {
      const lineNumber = findingLineNumber - Math.floor(context.length / 2) + index;
      const linePrefix = this.colors ? 
        chalk.gray(`${lineNumber.toString().padStart(4)}: `) :
        `${lineNumber.toString().padStart(4)}: `;
      
      const lineContent = lineNumber === findingLineNumber && this.colors ?
        chalk.red(line) : line;

      output += `${indent}${linePrefix}${lineContent}\n`;
    });

    return output;
  }

  /**
   * Formats scan summary statistics
   * @param {ScanResult} scanResult - The scan result
   * @returns {string} Formatted summary
   */
  formatSummary(scanResult) {
    const summary = scanResult.getSummary();
    const icon = this.colors ? chalk.blue('📊') : '[STATS]';
    
    let output = `${icon} Scan Summary:\n`;
    output += `  Files scanned: ${summary.filesScanned}\n`;
    output += `  Lines processed: ${summary.totalLines}\n`;
    output += `  Scan duration: ${summary.scanDuration}ms\n`;
    output += `  Total findings: ${summary.totalFindings}\n`;
    
    if (summary.findingsByType.pattern > 0) {
      output += `  Pattern-based: ${summary.findingsByType.pattern}\n`;
    }
    
    if (summary.findingsByType.entropy > 0) {
      output += `  Entropy-based: ${summary.findingsByType.entropy}\n`;
    }

    if (summary.averageConfidence !== null) {
      const avgConfidence = (summary.averageConfidence * 100).toFixed(1);
      output += `  Average confidence: ${avgConfidence}%\n`;
    }

    return output.trim();
  }

  /**
   * Formats an error message
   * @param {Error} error - The error to format
   * @returns {string} Formatted error message
   */
  formatError(error) {
    const errorIcon = this.colors ? chalk.red('❌') : '[ERROR]';
    const errorTitle = this.colors ? chalk.red.bold('Error:') : 'Error:';
    
    let output = `${errorIcon} ${errorTitle} ${error.message}\n`;

    if (error.code) {
      const codeLabel = this.colors ? chalk.gray('Code:') : 'Code:';
      output += `${codeLabel} ${error.code}\n`;
    }

    if (error.details && Object.keys(error.details).length > 0) {
      const detailsLabel = this.colors ? chalk.gray('Details:') : 'Details:';
      output += `${detailsLabel}\n`;
      
      Object.entries(error.details).forEach(([key, value]) => {
        output += `  ${key}: ${value}\n`;
      });
    }

    if (this.verbose && error.stack) {
      const stackLabel = this.colors ? chalk.gray('Stack trace:') : 'Stack trace:';
      output += `\n${stackLabel}\n${error.stack}`;
    }

    return output.trim();
  }

  /**
   * Formats a warning message
   * @param {string} message - The warning message
   * @returns {string} Formatted warning
   */
  formatWarning(message) {
    const warningIcon = this.colors ? chalk.yellow('⚠️') : '[WARN]';
    const warningTitle = this.colors ? chalk.yellow.bold('Warning:') : 'Warning:';
    
    return `${warningIcon} ${warningTitle} ${message}`;
  }

  /**
   * Formats an info message
   * @param {string} message - The info message
   * @returns {string} Formatted info message
   */
  formatInfo(message) {
    const infoIcon = this.colors ? chalk.blue('ℹ️') : '[INFO]';
    
    return `${infoIcon} ${message}`;
  }

  /**
   * Creates a progress indicator
   * @param {number} current - Current progress value
   * @param {number} total - Total progress value
   * @param {string} label - Progress label
   * @returns {string} Formatted progress indicator
   */
  formatProgress(current, total, label = 'Progress') {
    if (!this.showProgress) {
      return '';
    }

    const percentage = Math.round((current / total) * 100);
    const barLength = 20;
    const filledLength = Math.round((current / total) * barLength);
    
    if (!this.colors) {
      const bar = '='.repeat(filledLength) + '-'.repeat(barLength - filledLength);
      return `${label}: [${bar}] ${percentage}% (${current}/${total})`;
    }

    const filledBar = chalk.green('█'.repeat(filledLength));
    const emptyBar = chalk.gray('░'.repeat(barLength - filledLength));
    const percentageText = chalk.bold(`${percentage}%`);
    const countText = chalk.gray(`(${current}/${total})`);
    
    return `${label}: [${filledBar}${emptyBar}] ${percentageText} ${countText}`;
  }

  /**
   * Formats bypass instructions when secrets are found
   * @returns {string} Formatted bypass instructions
   */
  formatBypassInstructions() {
    const warningIcon = this.colors ? chalk.yellow('⚠️') : '[WARN]';
    const title = this.colors ? chalk.yellow.bold('Commit Blocked') : 'Commit Blocked';
    const command = this.colors ? chalk.cyan('git commit --no-verify') : 'git commit --no-verify';
    
    let output = `\n${warningIcon} ${title}\n`;
    output += 'Secrets detected in your staged files. Your commit has been blocked for security.\n\n';
    output += 'To bypass this check (NOT RECOMMENDED), use:\n';
    output += `  ${command}\n\n`;
    output += 'Please review and remove the detected secrets before committing.';
    
    return output;
  }

  /**
   * Formats a success message for completed operations
   * @param {string} message - The success message
   * @returns {string} Formatted success message
   */
  formatSuccess(message) {
    const successIcon = this.colors ? chalk.green('✅') : '[OK]';
    
    return `${successIcon} ${message}`;
  }
}