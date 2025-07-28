import fs from 'fs/promises';
import path from 'path';

/**
 * JSONReportGenerator class for creating structured JSON reports
 * Suitable for CI/CD integration and automated processing
 */
export class JSONReportGenerator {
  constructor(options = {}) {
    this.includeMetadata = options.includeMetadata !== false; // Default to true
    this.includeContext = options.includeContext || false;
    this.prettyPrint = options.prettyPrint !== false; // Default to true
    this.includeStats = options.includeStats !== false; // Default to true
  }

  /**
   * Generates a JSON report from scan results
   * @param {ScanResult} scanResult - The scan result to generate report from
   * @param {Object} options - Additional options for report generation
   * @returns {Object} JSON report object
   */
  generateReport(scanResult, options = {}) {
    const report = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      status: scanResult.hasSecrets ? 'FAILED' : 'PASSED',
      summary: this.generateSummary(scanResult)
    };

    if (this.includeStats) {
      report.statistics = this.generateStatistics(scanResult);
    }

    if (scanResult.hasSecrets) {
      report.findings = this.generateFindings(scanResult);
      report.groupedFindings = this.generateGroupedFindings(scanResult);
    }

    if (this.includeMetadata) {
      report.metadata = this.generateMetadata(scanResult, options);
    }

    return report;
  }

  /**
   * Generates summary section of the report
   * @param {ScanResult} scanResult - The scan result
   * @returns {Object} Summary object
   */
  generateSummary(scanResult) {
    const summary = scanResult.getSummary();
    
    return {
      totalFindings: summary.totalFindings,
      hasSecrets: summary.hasSecrets,
      filesScanned: summary.filesScanned,
      filesWithSecrets: summary.filesWithSecrets,
      totalLines: summary.totalLines,
      scanDuration: summary.scanDuration,
      exitCode: summary.hasSecrets ? 1 : 0
    };
  }

  /**
   * Generates statistics section of the report
   * @param {ScanResult} scanResult - The scan result
   * @returns {Object} Statistics object
   */
  generateStatistics(scanResult) {
    const summary = scanResult.getSummary();
    
    const stats = {
      findingsByType: summary.findingsByType,
      findingsByCategory: summary.findingsByCategory,
      averageConfidence: summary.averageConfidence,
      confidenceDistribution: this.calculateConfidenceDistribution(scanResult),
      fileDistribution: this.calculateFileDistribution(scanResult)
    };

    return stats;
  }

  /**
   * Generates findings array for the report
   * @param {ScanResult} scanResult - The scan result
   * @returns {Array} Array of finding objects
   */
  generateFindings(scanResult) {
    return scanResult.findings.map(finding => {
      const findingData = {
        id: this.generateFindingId(finding),
        type: finding.type,
        category: finding.category,
        severity: this.calculateSeverity(finding),
        location: {
          filePath: finding.filePath,
          lineNumber: finding.lineNumber,
          columnStart: finding.columnStart,
          columnEnd: finding.columnEnd
        },
        match: {
          full: finding.match,
          truncated: finding.truncatedMatch,
          length: finding.match.length
        },
        timestamp: finding.timestamp
      };

      if (finding.confidence !== undefined) {
        findingData.confidence = {
          score: finding.confidence,
          level: this.getConfidenceLevel(finding.confidence)
        };
      }

      if (this.includeContext && finding.context && finding.context.length > 0) {
        findingData.context = {
          lines: finding.context,
          contextLineNumber: finding.lineNumber - Math.floor(finding.context.length / 2)
        };
      }

      return findingData;
    });
  }

  /**
   * Generates grouped findings for easier analysis
   * @param {ScanResult} scanResult - The scan result
   * @returns {Object} Grouped findings object
   */
  generateGroupedFindings(scanResult) {
    return {
      byFile: this.groupFindingsByFile(scanResult),
      byCategory: this.groupFindingsByCategory(scanResult),
      byType: this.groupFindingsByType(scanResult),
      bySeverity: this.groupFindingsBySeverity(scanResult)
    };
  }

  /**
   * Groups findings by file path
   * @param {ScanResult} scanResult - The scan result
   * @returns {Object} Findings grouped by file
   */
  groupFindingsByFile(scanResult) {
    const byFile = scanResult.groupByFile();
    const result = {};

    Object.entries(byFile).forEach(([filePath, findings]) => {
      result[filePath] = {
        count: findings.length,
        findings: findings.map(f => this.generateFindingId(f)),
        categories: [...new Set(findings.map(f => f.category))],
        severities: [...new Set(findings.map(f => this.calculateSeverity(f)))]
      };
    });

    return result;
  }

  /**
   * Groups findings by category
   * @param {ScanResult} scanResult - The scan result
   * @returns {Object} Findings grouped by category
   */
  groupFindingsByCategory(scanResult) {
    const byCategory = scanResult.groupByCategory();
    const result = {};

    Object.entries(byCategory).forEach(([category, findings]) => {
      result[category] = {
        count: findings.length,
        findings: findings.map(f => this.generateFindingId(f)),
        files: [...new Set(findings.map(f => f.filePath))],
        averageConfidence: this.calculateAverageConfidence(findings)
      };
    });

    return result;
  }

  /**
   * Groups findings by type
   * @param {ScanResult} scanResult - The scan result
   * @returns {Object} Findings grouped by type
   */
  groupFindingsByType(scanResult) {
    const byType = scanResult.groupByType();
    const result = {};

    Object.entries(byType).forEach(([type, findings]) => {
      result[type] = {
        count: findings.length,
        findings: findings.map(f => this.generateFindingId(f)),
        categories: [...new Set(findings.map(f => f.category))],
        averageConfidence: this.calculateAverageConfidence(findings)
      };
    });

    return result;
  }

  /**
   * Groups findings by severity level
   * @param {ScanResult} scanResult - The scan result
   * @returns {Object} Findings grouped by severity
   */
  groupFindingsBySeverity(scanResult) {
    const result = {
      high: { count: 0, findings: [] },
      medium: { count: 0, findings: [] },
      low: { count: 0, findings: [] }
    };

    scanResult.findings.forEach(finding => {
      const severity = this.calculateSeverity(finding);
      const id = this.generateFindingId(finding);
      
      result[severity].count++;
      result[severity].findings.push(id);
    });

    return result;
  }

  /**
   * Generates metadata section of the report
   * @param {ScanResult} scanResult - The scan result
   * @param {Object} options - Additional options
   * @returns {Object} Metadata object
   */
  generateMetadata(scanResult, options = {}) {
    return {
      tool: {
        name: 'seal-commit',
        version: '1.0.0'
      },
      scan: {
        startTime: new Date(scanResult.startTime).toISOString(),
        endTime: scanResult.endTime ? new Date(scanResult.endTime).toISOString() : null,
        duration: scanResult.scanDuration,
        mode: options.scanMode || 'staged-files'
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cwd: process.cwd()
      },
      configuration: options.config ? this.sanitizeConfig(options.config) : undefined
    };
  }

  /**
   * Calculates confidence distribution
   * @param {ScanResult} scanResult - The scan result
   * @returns {Object} Confidence distribution
   */
  calculateConfidenceDistribution(scanResult) {
    const distribution = {
      high: 0,    // >= 0.8
      medium: 0,  // 0.6 - 0.79
      low: 0,     // < 0.6
      unknown: 0  // no confidence score
    };

    scanResult.findings.forEach(finding => {
      if (finding.confidence === undefined) {
        distribution.unknown++;
      } else if (finding.confidence >= 0.8) {
        distribution.high++;
      } else if (finding.confidence >= 0.6) {
        distribution.medium++;
      } else {
        distribution.low++;
      }
    });

    return distribution;
  }

  /**
   * Calculates file distribution statistics
   * @param {ScanResult} scanResult - The scan result
   * @returns {Object} File distribution
   */
  calculateFileDistribution(scanResult) {
    const byFile = scanResult.groupByFile();
    const fileCounts = Object.values(byFile).map(findings => findings.length);
    
    return {
      totalFiles: Object.keys(byFile).length,
      averageFindingsPerFile: fileCounts.length > 0 ? 
        fileCounts.reduce((sum, count) => sum + count, 0) / fileCounts.length : 0,
      maxFindingsInFile: fileCounts.length > 0 ? Math.max(...fileCounts) : 0,
      minFindingsInFile: fileCounts.length > 0 ? Math.min(...fileCounts) : 0
    };
  }

  /**
   * Generates a unique ID for a finding
   * @param {Finding} finding - The finding
   * @returns {string} Unique finding ID
   */
  generateFindingId(finding) {
    const hash = finding.getHashKey();
    return Buffer.from(hash).toString('base64').substring(0, 12);
  }

  /**
   * Calculates severity level based on finding properties
   * @param {Finding} finding - The finding
   * @returns {string} Severity level ('high', 'medium', 'low')
   */
  calculateSeverity(finding) {
    // High severity categories
    const highSeverityCategories = [
      'aws-key', 'aws-secret', 'google-key', 'private-key', 
      'github-token', 'stripe-key'
    ];

    // Medium severity categories
    const mediumSeverityCategories = [
      'jwt', 'bearer-token', 'oauth-token', 'api-key'
    ];

    if (highSeverityCategories.includes(finding.category)) {
      return 'high';
    }

    if (mediumSeverityCategories.includes(finding.category)) {
      return 'medium';
    }

    // For entropy-based findings, use confidence score
    if (finding.type === 'entropy' && finding.confidence !== undefined) {
      if (finding.confidence >= 0.8) return 'high';
      if (finding.confidence >= 0.6) return 'medium';
      return 'low';
    }

    // Default to medium for pattern-based findings
    return finding.type === 'pattern' ? 'medium' : 'low';
  }

  /**
   * Gets confidence level description
   * @param {number} confidence - Confidence score (0.0 - 1.0)
   * @returns {string} Confidence level
   */
  getConfidenceLevel(confidence) {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  }

  /**
   * Calculates average confidence for an array of findings
   * @param {Finding[]} findings - Array of findings
   * @returns {number|null} Average confidence or null
   */
  calculateAverageConfidence(findings) {
    const withConfidence = findings.filter(f => f.confidence !== undefined);
    
    if (withConfidence.length === 0) {
      return null;
    }

    const sum = withConfidence.reduce((acc, finding) => acc + finding.confidence, 0);
    return sum / withConfidence.length;
  }

  /**
   * Sanitizes configuration object for inclusion in report
   * @param {Object} config - Configuration object
   * @returns {Object} Sanitized configuration
   */
  sanitizeConfig(config) {
    // Remove sensitive information and keep only structure
    const sanitized = {
      patterns: {
        customCount: config.patterns?.custom?.length || 0,
        enabledCount: config.patterns?.enabled?.length || 0,
        disabledCount: config.patterns?.disabled?.length || 0
      },
      entropy: config.entropy || {},
      ignore: {
        filesCount: config.ignore?.files?.length || 0,
        directoriesCount: config.ignore?.directories?.length || 0,
        extensionsCount: config.ignore?.extensions?.length || 0
      },
      allowlistCount: config.allowlist?.length || 0,
      output: config.output || {}
    };

    return sanitized;
  }

  /**
   * Converts report object to JSON string
   * @param {Object} report - Report object
   * @returns {string} JSON string
   */
  toJSON(report) {
    return this.prettyPrint ? 
      JSON.stringify(report, null, 2) : 
      JSON.stringify(report);
  }

  /**
   * Writes report to file
   * @param {Object} report - Report object
   * @param {string} filePath - Output file path
   * @returns {Promise<void>}
   */
  async writeToFile(report, filePath) {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Write report to file
      const jsonString = this.toJSON(report);
      await fs.writeFile(filePath, jsonString, 'utf8');
    } catch (error) {
      throw new Error(`Failed to write report to ${filePath}: ${error.message}`);
    }
  }

  /**
   * Generates a complete report and writes it to file
   * @param {ScanResult} scanResult - The scan result
   * @param {string} filePath - Output file path
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} The generated report object
   */
  async generateAndWriteReport(scanResult, filePath, options = {}) {
    const report = this.generateReport(scanResult, options);
    await this.writeToFile(report, filePath);
    return report;
  }

  /**
   * Validates a report object structure
   * @param {Object} report - Report object to validate
   * @returns {boolean} True if valid
   * @throws {Error} If report is invalid
   */
  validateReport(report) {
    const requiredFields = ['version', 'timestamp', 'status', 'summary'];
    
    for (const field of requiredFields) {
      if (!(field in report)) {
        throw new Error(`Report missing required field: ${field}`);
      }
    }

    if (!['PASSED', 'FAILED'].includes(report.status)) {
      throw new Error(`Invalid report status: ${report.status}`);
    }

    if (typeof report.summary !== 'object') {
      throw new Error('Report summary must be an object');
    }

    const requiredSummaryFields = ['totalFindings', 'hasSecrets', 'filesScanned'];
    for (const field of requiredSummaryFields) {
      if (!(field in report.summary)) {
        throw new Error(`Report summary missing required field: ${field}`);
      }
    }

    return true;
  }

  /**
   * Creates a minimal report for CI/CD systems
   * @param {ScanResult} scanResult - The scan result
   * @returns {Object} Minimal report object
   */
  generateMinimalReport(scanResult) {
    const summary = scanResult.getSummary();
    
    return {
      status: scanResult.hasSecrets ? 'FAILED' : 'PASSED',
      exitCode: scanResult.hasSecrets ? 1 : 0,
      totalFindings: summary.totalFindings,
      filesScanned: summary.filesScanned,
      scanDuration: summary.scanDuration,
      timestamp: new Date().toISOString()
    };
  }
}