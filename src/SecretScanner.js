import fs from 'fs';
import path from 'path';
import { PatternEngine } from './engines/PatternEngine.js';
import { EntropyEngine } from './engines/EntropyEngine.js';
import { Finding } from './models/Finding.js';
import { ScanResult } from './models/ScanResult.js';

/**
 * SecretScanner - Main orchestration engine for secret detection
 * Coordinates pattern and entropy engines to scan files for secrets
 */
export class SecretScanner {
  constructor(config = {}) {
    this.config = config;
    this.patternEngine = new PatternEngine(config.patterns?.custom || []);
    this.entropyEngine = new EntropyEngine(config.entropy || {});
    this.maxConcurrency = config.maxConcurrency || 10;
  }

  /**
   * Scan multiple files for secrets
   * @param {string[]} filePaths - Array of file paths to scan
   * @returns {Promise<ScanResult>} Scan results with all findings
   */
  async scanFiles(filePaths) {
    const scanResult = new ScanResult();
    
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      scanResult.markCompleted();
      return scanResult;
    }

    // Filter out files that should be ignored
    const filteredPaths = filePaths.filter(filePath => !this.shouldIgnoreFile(filePath));
    
    if (filteredPaths.length === 0) {
      scanResult.markCompleted();
      return scanResult;
    }

    // Process files in parallel with concurrency limit
    const results = await this.processFilesInParallel(filteredPaths);
    
    // Aggregate results
    let totalLines = 0;
    for (const result of results) {
      if (result.findings) {
        scanResult.addFindings(result.findings);
      }
      totalLines += result.lineCount || 0;
    }

    // Update scan statistics
    scanResult.updateStats({
      filesScanned: filteredPaths.length,
      totalLines
    });

    // Remove duplicates
    scanResult.deduplicateFindings();
    scanResult.markCompleted();

    return scanResult;
  }

  /**
   * Process files in parallel with concurrency control
   * @param {string[]} filePaths - Array of file paths to process
   * @returns {Promise<Array>} Array of scan results for each file
   */
  async processFilesInParallel(filePaths) {
    const semaphore = new Semaphore(this.maxConcurrency);

    const promises = filePaths.map(async (filePath) => {
      await semaphore.acquire();
      try {
        return await this.scanFile(filePath);
      } finally {
        semaphore.release();
      }
    });

    return Promise.all(promises);
  }

  /**
   * Scan a single file for secrets
   * @param {string} filePath - Path to the file to scan
   * @returns {Promise<Object>} Object containing findings and metadata
   */
  async scanFile(filePath) {
    try {
      // Check if file exists and is readable
      if (!fs.existsSync(filePath)) {
        return { findings: [], lineCount: 0, error: `File not found: ${filePath}` };
      }

      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return { findings: [], lineCount: 0, error: `Not a file: ${filePath}` };
      }

      // Skip binary files
      if (this.isBinaryFile(filePath)) {
        return { findings: [], lineCount: 0, skipped: 'binary file' };
      }

      // Read file content
      const content = fs.readFileSync(filePath, 'utf8');
      const lineCount = content.split('\n').length;

      // Scan content for secrets
      const findings = await this.scanContent(content, filePath);

      return { findings, lineCount };
    } catch (error) {
      return { 
        findings: [], 
        lineCount: 0, 
        error: `Error scanning ${filePath}: ${error.message}` 
      };
    }
  }

  /**
   * Scan content for secrets using both pattern and entropy engines
   * @param {string} content - Content to scan
   * @param {string} filePath - Path to the file being scanned
   * @returns {Promise<Finding[]>} Array of findings
   */
  async scanContent(content, filePath) {
    const findings = [];

    try {
      // Run pattern detection
      const patternFindings = this.patternEngine.detectSecrets(content, filePath);
      findings.push(...patternFindings.map(finding => new Finding(finding)));

      // Run entropy detection
      const entropyFindings = this.entropyEngine.detectHighEntropyStrings(content, filePath);
      findings.push(...entropyFindings.map(finding => new Finding(finding)));

      // Filter findings through allowlist
      const filteredFindings = findings.filter(finding => !this.isAllowed(finding.match));

      return filteredFindings;
    } catch (error) {
      // Log error but don't fail the entire scan
      console.warn(`Warning: Error scanning content in ${filePath}: ${error.message}`);
      return [];
    }
  }

  /**
   * Check if a file should be ignored based on configuration
   * @param {string} filePath - Path to check
   * @returns {boolean} True if file should be ignored
   */
  shouldIgnoreFile(filePath) {
    if (!this.config.ignore) {
      return false;
    }

    const { files = [], directories = [], extensions = [] } = this.config.ignore;
    const normalizedPath = path.normalize(filePath);
    const fileName = path.basename(normalizedPath);
    const fileExt = path.extname(normalizedPath);

    // Check file patterns
    for (const pattern of files) {
      if (this.matchesGlobPattern(fileName, pattern)) {
        return true;
      }
    }

    // Check directory patterns
    for (const dirPattern of directories) {
      if (normalizedPath.includes(dirPattern)) {
        return true;
      }
    }

    // Check extensions
    if (extensions.includes(fileExt)) {
      return true;
    }

    return false;
  }

  /**
   * Check if a string is in the allowlist
   * @param {string} str - String to check
   * @returns {boolean} True if string is allowed
   */
  isAllowed(str) {
    if (!this.config.allowlist || !Array.isArray(this.config.allowlist)) {
      return false;
    }
    
    // Support both exact matches and regex patterns in allowlist
    for (const allowedItem of this.config.allowlist) {
      if (typeof allowedItem === 'string') {
        // Exact match
        if (str === allowedItem) {
          return true;
        }
        
        // Check if allowedItem is a regex pattern (starts and ends with /)
        if (allowedItem.startsWith('/') && allowedItem.endsWith('/')) {
          try {
            const regexPattern = allowedItem.slice(1, -1);
            const regex = new RegExp(regexPattern);
            if (regex.test(str)) {
              return true;
            }
          } catch (error) {
            // Invalid regex, treat as literal string
            continue;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Simple glob pattern matching
   * @param {string} str - String to test
   * @param {string} pattern - Glob pattern
   * @returns {boolean} True if pattern matches
   */
  matchesGlobPattern(str, pattern) {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(str);
  }

  /**
   * Check if a file is likely binary based on extension
   * @param {string} filePath - Path to check
   * @returns {boolean} True if likely binary
   */
  isBinaryFile(filePath) {
    const binaryExtensions = [
      '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico',
      '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.tar', '.gz', '.rar', '.7z',
      '.class', '.jar', '.war', '.ear',
      '.woff', '.woff2', '.ttf', '.eot'
    ];

    const ext = path.extname(filePath).toLowerCase();
    return binaryExtensions.includes(ext);
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration object
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Recreate engines with new config
    this.patternEngine = new PatternEngine(this.config.patterns?.custom || []);
    this.entropyEngine = new EntropyEngine(this.config.entropy || {});
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Get scan statistics
   * @returns {Object} Scanner statistics
   */
  getStats() {
    return {
      maxConcurrency: this.maxConcurrency,
      patternEngineStats: {
        builtInPatterns: this.patternEngine.getBuiltInPatterns().length,
        customPatterns: this.config.patterns?.custom?.length || 0,
        categories: this.patternEngine.getCategories()
      },
      entropyEngineStats: this.entropyEngine.getConfig()
    };
  }
}

/**
 * Simple semaphore implementation for concurrency control
 */
class Semaphore {
  constructor(maxConcurrency) {
    this.maxConcurrency = maxConcurrency;
    this.currentConcurrency = 0;
    this.queue = [];
  }

  async acquire() {
    return new Promise((resolve) => {
      if (this.currentConcurrency < this.maxConcurrency) {
        this.currentConcurrency++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release() {
    this.currentConcurrency--;
    if (this.queue.length > 0) {
      const resolve = this.queue.shift();
      this.currentConcurrency++;
      resolve();
    }
  }
}