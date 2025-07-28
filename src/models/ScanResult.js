import { Finding } from './Finding.js';

/**
 * ScanResult model class for aggregating and managing findings
 * Provides methods for grouping, filtering, and reporting scan results
 */
export class ScanResult {
  constructor() {
    this.findings = [];
    this.filesScanned = 0;
    this.totalLines = 0;
    this.scanDuration = 0;
    this.hasSecrets = false;
    this.startTime = Date.now();
    this.endTime = null;
  }

  /**
   * Adds a finding to the scan result
   * @param {Finding} finding - The finding to add
   */
  addFinding(finding) {
    if (!(finding instanceof Finding)) {
      throw new Error('Only Finding instances can be added to ScanResult');
    }

    this.findings.push(finding);
    this.hasSecrets = true;
  }

  /**
   * Adds multiple findings to the scan result
   * @param {Finding[]} findings - Array of findings to add
   */
  addFindings(findings) {
    if (!Array.isArray(findings)) {
      throw new Error('Findings must be an array');
    }

    findings.forEach(finding => this.addFinding(finding));
  }

  /**
   * Removes duplicate findings based on their hash key
   */
  deduplicateFindings() {
    const seen = new Set();
    this.findings = this.findings.filter(finding => {
      const hashKey = finding.getHashKey();
      if (seen.has(hashKey)) {
        return false;
      }
      seen.add(hashKey);
      return true;
    });

    this.hasSecrets = this.findings.length > 0;
  }

  /**
   * Groups findings by file path
   * @returns {Object} Object with file paths as keys and arrays of findings as values
   */
  groupByFile() {
    const grouped = {};
    
    this.findings.forEach(finding => {
      if (!grouped[finding.filePath]) {
        grouped[finding.filePath] = [];
      }
      grouped[finding.filePath].push(finding);
    });

    return grouped;
  }

  /**
   * Groups findings by category
   * @returns {Object} Object with categories as keys and arrays of findings as values
   */
  groupByCategory() {
    const grouped = {};
    
    this.findings.forEach(finding => {
      if (!grouped[finding.category]) {
        grouped[finding.category] = [];
      }
      grouped[finding.category].push(finding);
    });

    return grouped;
  }

  /**
   * Groups findings by type (pattern or entropy)
   * @returns {Object} Object with types as keys and arrays of findings as values
   */
  groupByType() {
    const grouped = {};
    
    this.findings.forEach(finding => {
      if (!grouped[finding.type]) {
        grouped[finding.type] = [];
      }
      grouped[finding.type].push(finding);
    });

    return grouped;
  }

  /**
   * Filters findings by confidence threshold
   * @param {number} threshold - Minimum confidence level (0.0 - 1.0)
   * @returns {Finding[]} Array of findings above the threshold
   */
  filterByConfidence(threshold) {
    if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) {
      throw new Error('Confidence threshold must be a number between 0 and 1');
    }

    return this.findings.filter(finding => 
      finding.confidence !== undefined && finding.confidence >= threshold
    );
  }

  /**
   * Filters findings by file path pattern
   * @param {RegExp|string} pattern - Pattern to match against file paths
   * @returns {Finding[]} Array of findings matching the pattern
   */
  filterByFilePath(pattern) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    return this.findings.filter(finding => regex.test(finding.filePath));
  }

  /**
   * Filters findings by category
   * @param {string|string[]} categories - Category or array of categories to filter by
   * @returns {Finding[]} Array of findings matching the categories
   */
  filterByCategory(categories) {
    const categoryArray = Array.isArray(categories) ? categories : [categories];
    return this.findings.filter(finding => categoryArray.includes(finding.category));
  }

  /**
   * Gets summary statistics about the scan results
   * @returns {Object} Summary statistics
   */
  getSummary() {
    const byType = this.groupByType();
    const byCategory = this.groupByCategory();
    const byFile = this.groupByFile();

    return {
      totalFindings: this.findings.length,
      hasSecrets: this.hasSecrets,
      filesScanned: this.filesScanned,
      filesWithSecrets: Object.keys(byFile).length,
      totalLines: this.totalLines,
      scanDuration: this.scanDuration,
      findingsByType: {
        pattern: byType.pattern?.length || 0,
        entropy: byType.entropy?.length || 0
      },
      findingsByCategory: Object.keys(byCategory).reduce((acc, category) => {
        acc[category] = byCategory[category].length;
        return acc;
      }, {}),
      averageConfidence: this.getAverageConfidence()
    };
  }

  /**
   * Calculates the average confidence of all findings with confidence scores
   * @returns {number|null} Average confidence or null if no findings have confidence
   */
  getAverageConfidence() {
    const findingsWithConfidence = this.findings.filter(f => f.confidence !== undefined);
    
    if (findingsWithConfidence.length === 0) {
      return null;
    }

    const sum = findingsWithConfidence.reduce((acc, finding) => acc + finding.confidence, 0);
    return sum / findingsWithConfidence.length;
  }

  /**
   * Marks the scan as completed and calculates duration
   */
  markCompleted() {
    this.endTime = Date.now();
    this.scanDuration = this.endTime - this.startTime;
  }

  /**
   * Updates scan statistics
   * @param {Object} stats - Statistics object
   * @param {number} stats.filesScanned - Number of files scanned
   * @param {number} stats.totalLines - Total lines processed
   */
  updateStats({ filesScanned, totalLines }) {
    if (typeof filesScanned === 'number' && filesScanned >= 0) {
      this.filesScanned = filesScanned;
    }
    
    if (typeof totalLines === 'number' && totalLines >= 0) {
      this.totalLines = totalLines;
    }
  }

  /**
   * Converts the scan result to JSON format for reporting
   * @returns {Object} JSON representation of the scan result
   */
  toJSON() {
    return {
      summary: this.getSummary(),
      findings: this.findings.map(finding => finding.toJSON()),
      metadata: {
        startTime: new Date(this.startTime).toISOString(),
        endTime: this.endTime ? new Date(this.endTime).toISOString() : null,
        scanDuration: this.scanDuration
      }
    };
  }

  /**
   * Formats the scan result for terminal display
   * @returns {string} Formatted string for terminal output
   */
  toString() {
    if (!this.hasSecrets) {
      return `✅ No secrets detected in ${this.filesScanned} files (${this.totalLines} lines scanned)`;
    }

    const summary = this.getSummary();
    const byFile = this.groupByFile();
    
    let output = `❌ Found ${summary.totalFindings} secret(s) in ${summary.filesWithSecrets} file(s):\n\n`;
    
    Object.entries(byFile).forEach(([filePath, findings]) => {
      output += `📁 ${filePath} (${findings.length} finding(s)):\n`;
      findings.forEach(finding => {
        output += `  ${finding.toString()}\n`;
      });
      output += '\n';
    });

    output += `📊 Scan completed in ${this.scanDuration}ms (${this.filesScanned} files, ${this.totalLines} lines)`;
    
    return output;
  }

  /**
   * Checks if the scan result is empty (no findings)
   * @returns {boolean} True if no findings exist
   */
  isEmpty() {
    return this.findings.length === 0;
  }

  /**
   * Gets the total count of findings
   * @returns {number} Number of findings
   */
  getCount() {
    return this.findings.length;
  }

  /**
   * Clears all findings and resets the scan result
   */
  clear() {
    this.findings = [];
    this.hasSecrets = false;
    this.filesScanned = 0;
    this.totalLines = 0;
    this.scanDuration = 0;
    this.startTime = Date.now();
    this.endTime = null;
  }

  /**
   * Merges another ScanResult into this one
   * @param {ScanResult} other - Another ScanResult to merge
   */
  merge(other) {
    if (!(other instanceof ScanResult)) {
      throw new Error('Can only merge with another ScanResult instance');
    }

    this.addFindings(other.findings);
    this.filesScanned += other.filesScanned;
    this.totalLines += other.totalLines;
    
    // Keep the earliest start time and latest end time
    this.startTime = Math.min(this.startTime, other.startTime);
    if (other.endTime) {
      this.endTime = this.endTime ? Math.max(this.endTime, other.endTime) : other.endTime;
      this.scanDuration = this.endTime - this.startTime;
    }
  }
}