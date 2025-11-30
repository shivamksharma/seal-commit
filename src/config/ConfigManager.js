import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { PlatformUtils } from '../utils/PlatformUtils.js';

/**
 * Configuration schema definition with validation rules
 */
const CONFIG_SCHEMA = {
  patterns: {
    type: 'object',
    properties: {
      custom: {
        type: 'array',
        items: { type: 'string' },
        default: []
      },
      enabled: {
        type: 'array',
        items: { 
          type: 'string',
          enum: [
            'aws-access-key',
            'aws-secret-key',
            'google-api-key',
            'stripe-key',
            'github-token',
            'firebase-key',
            'jwt-token',
            'bearer-token',
            'private-key'
          ]
        },
        default: [
          'aws-access-key',
          'aws-secret-key',
          'google-api-key',
          'stripe-key',
          'github-token',
          'firebase-key',
          'jwt-token',
          'bearer-token',
          'private-key'
        ]
      },
      disabled: {
        type: 'array',
        items: { type: 'string' },
        default: []
      }
    },
    default: {}
  },
  entropy: {
    type: 'object',
    properties: {
      threshold: {
        type: 'number',
        minimum: 0,
        maximum: 8,
        default: 4.0
      },
      minLength: {
        type: 'integer',
        minimum: 1,
        maximum: 1000,
        default: 20
      },
      maxLength: {
        type: 'integer',
        minimum: 1,
        maximum: 10000,
        default: 100
      }
    },
    default: {}
  },
  ignore: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        items: { type: 'string' },
        default: [
          '*.min.js',
          '*.map',
          'package-lock.json',
          'yarn.lock',
          'pnpm-lock.yaml'
        ]
      },
      directories: {
        type: 'array',
        items: { type: 'string' },
        default: [
          'node_modules',
          '.git',
          'dist',
          'build',
          'coverage'
        ]
      },
      extensions: {
        type: 'array',
        items: { type: 'string' },
        default: [
          '.min.js',
          '.lock',
          '.map',
          '.log'
        ]
      }
    },
    default: {}
  },
  allowlist: {
    type: 'array',
    items: { type: 'string' },
    default: []
  },
  output: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['terminal', 'json', 'both'],
        default: 'terminal'
      },
      colors: {
        type: 'boolean',
        default: true
      },
      verbose: {
        type: 'boolean',
        default: false
      }
    },
    default: {}
  },
  workspace: {
    type: 'object',
    properties: {
      inherit: {
        type: 'boolean',
        default: true
      },
      packages: {
        type: 'array',
        items: { type: 'string' },
        default: []
      },
      rootConfig: {
        type: ['string', 'null'],
        default: null
      }
    },
    default: {}
  }
};

/**
 * Default configuration schema with all available options
 */
const DEFAULT_CONFIG = {
  patterns: {
    custom: [],
    enabled: [
      'aws-access-key',
      'aws-secret-key',
      'google-api-key',
      'stripe-key',
      'github-token',
      'firebase-key',
      'jwt-token',
      'bearer-token',
      'private-key'
    ],
    disabled: []
  },
  entropy: {
    threshold: 4.0,
    minLength: 20,
    maxLength: 100
  },
  ignore: {
    files: [
      '*.min.js',
      '*.map',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml'
    ],
    directories: [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage'
    ],
    extensions: [
      '.min.js',
      '.lock',
      '.map',
      '.log'
    ]
  },
  allowlist: [],
  output: {
    format: 'terminal',
    colors: true,
    verbose: false
  },
  workspace: {
    inherit: true,
    packages: [],
    rootConfig: null
  }
};

/**
 * Configuration file names to search for (in order of preference)
 */
const CONFIG_FILE_NAMES = [
  '.sealcommitrc',
  '.sealcommitrc.json',
  '.sealcommitrc.yaml',
  '.sealcommitrc.yml'
];

/**
 * Workspace configuration file names (for monorepo support)
 */
const WORKSPACE_CONFIG_NAMES = [
  'seal-commit.config.js',
  'seal-commit.config.json',
  'seal-commit.config.yaml',
  'seal-commit.config.yml'
];

/**
 * ConfigManager handles loading, merging, and validating configuration
 * from various sources including .sealcommitrc files and defaults.
 * Enhanced with workspace and monorepo support.
 */
export class ConfigManager {
  constructor(configPath = null, workingDirectory = null) {
    this.configPath = configPath;
    this.workingDirectory = workingDirectory || process.cwd();
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from file or use defaults
   * Supports workspace inheritance for monorepo scenarios
   * @returns {Object} Merged configuration object
   */
  loadConfig() {
    const configs = [];
    
    // 1. Start with default configuration
    configs.push(DEFAULT_CONFIG);
    
    // 2. Load workspace root configuration if in a workspace
    const workspaceConfig = this.loadWorkspaceConfig();
    if (workspaceConfig) {
      configs.push(workspaceConfig);
    }
    
    // 3. Load local configuration
    const localConfig = this.loadLocalConfig();
    if (localConfig) {
      configs.push(localConfig);
    }
    
    // 4. Merge all configurations
    let mergedConfig = configs.reduce((merged, config) => {
      return this.mergeConfigs(merged, config);
    }, {});
    
    this.validateConfig(mergedConfig);
    return mergedConfig;
  }

  /**
   * Load workspace configuration for monorepo support
   * @returns {Object|null} Workspace configuration or null
   */
  loadWorkspaceConfig() {
    const workspaceRoot = this.findWorkspaceRoot();
    if (!workspaceRoot) {
      return null;
    }
    
    // Look for workspace configuration files
    for (const fileName of WORKSPACE_CONFIG_NAMES) {
      const filePath = PlatformUtils.joinPath(workspaceRoot, fileName);
      if (fs.existsSync(filePath)) {
        try {
          const config = this.parseConfigFile(filePath);
          // Store workspace root separately to avoid validation issues
          this._workspaceRoot = workspaceRoot;
          return config;
        } catch (error) {
          console.warn(`Warning: Failed to load workspace config from ${filePath}: ${error.message}`);
        }
      }
    }
    
    return null;
  }

  /**
   * Load local configuration from the current directory
   * @returns {Object|null} Local configuration or null
   */
  loadLocalConfig() {
    const configFile = this.configPath || this.findConfigFile();
    
    if (configFile && fs.existsSync(configFile)) {
      try {
        return this.parseConfigFile(configFile);
      } catch (error) {
        throw new Error(`Failed to load configuration from ${configFile}: ${error.message}`);
      }
    }
    
    return null;
  }

  /**
   * Find workspace root by looking for workspace indicators
   * @returns {string|null} Path to workspace root or null
   */
  findWorkspaceRoot() {
    let currentDir = PlatformUtils.normalizePath(this.workingDirectory);
    const platformInfo = PlatformUtils.getPlatformInfo();
    const root = platformInfo.isWindows ? 
      currentDir.split(':')[0] + ':\\' : 
      '/';
    
    while (currentDir !== root) {
      // Check for workspace indicators
      const indicators = [
        'package.json',
        'lerna.json',
        'nx.json',
        'rush.json',
        'pnpm-workspace.yaml',
        'yarn.lock'
      ];
      
      for (const indicator of indicators) {
        const indicatorPath = PlatformUtils.joinPath(currentDir, indicator);
        if (fs.existsSync(indicatorPath)) {
          // Check if it's actually a workspace root
          if (this.isWorkspaceRoot(currentDir, indicator)) {
            return currentDir;
          }
        }
      }
      
      const parentDir = PlatformUtils.normalizePath(path.resolve(currentDir, '..'));
      if (parentDir === currentDir) {
        break; // Reached filesystem root
      }
      currentDir = parentDir;
    }
    
    return null;
  }

  /**
   * Check if a directory is a workspace root
   * @param {string} dirPath - Directory path to check
   * @param {string} indicator - The indicator file that was found
   * @returns {boolean} True if directory is a workspace root
   */
  isWorkspaceRoot(dirPath, indicator) {
    try {
      if (indicator === 'package.json') {
        const packageJsonPath = PlatformUtils.joinPath(dirPath, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        // Check for workspace indicators in package.json
        return !!(
          packageJson.workspaces ||
          packageJson.private === true && (
            fs.existsSync(PlatformUtils.joinPath(dirPath, 'packages')) ||
            fs.existsSync(PlatformUtils.joinPath(dirPath, 'apps'))
          )
        );
      }
      
      // Other indicators are generally workspace roots
      return ['lerna.json', 'nx.json', 'rush.json', 'pnpm-workspace.yaml'].includes(indicator);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get workspace packages information
   * @returns {Array} Array of workspace package information
   */
  getWorkspacePackages() {
    const workspaceRoot = this.findWorkspaceRoot();
    if (!workspaceRoot) {
      return [];
    }
    
    const packages = [];
    
    try {
      // Check package.json workspaces
      const packageJsonPath = PlatformUtils.joinPath(workspaceRoot, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        if (packageJson.workspaces) {
          const workspacePatterns = Array.isArray(packageJson.workspaces) 
            ? packageJson.workspaces 
            : packageJson.workspaces.packages || [];
          
          for (const pattern of workspacePatterns) {
            const packageDirs = this.expandWorkspacePattern(workspaceRoot, pattern);
            packages.push(...packageDirs);
          }
        }
      }
      
      // Check pnpm-workspace.yaml
      const pnpmWorkspacePath = PlatformUtils.joinPath(workspaceRoot, 'pnpm-workspace.yaml');
      if (fs.existsSync(pnpmWorkspacePath)) {
        const pnpmWorkspace = yaml.load(fs.readFileSync(pnpmWorkspacePath, 'utf8'));
        if (pnpmWorkspace && pnpmWorkspace.packages) {
          for (const pattern of pnpmWorkspace.packages) {
            const packageDirs = this.expandWorkspacePattern(workspaceRoot, pattern);
            packages.push(...packageDirs);
          }
        }
      }
      
      // Check lerna.json
      const lernaJsonPath = PlatformUtils.joinPath(workspaceRoot, 'lerna.json');
      if (fs.existsSync(lernaJsonPath)) {
        const lernaJson = JSON.parse(fs.readFileSync(lernaJsonPath, 'utf8'));
        if (lernaJson.packages) {
          for (const pattern of lernaJson.packages) {
            const packageDirs = this.expandWorkspacePattern(workspaceRoot, pattern);
            packages.push(...packageDirs);
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Failed to read workspace packages: ${error.message}`);
    }
    
    return [...new Set(packages)]; // Remove duplicates
  }

  /**
   * Expand workspace pattern to actual package directories
   * @param {string} workspaceRoot - Workspace root directory
   * @param {string} pattern - Workspace pattern (e.g., "packages/*")
   * @returns {Array} Array of package directory paths
   */
  expandWorkspacePattern(workspaceRoot, pattern) {
    const packages = [];
    
    try {
      // Simple glob expansion for common patterns
      if (pattern.endsWith('/*')) {
        const baseDir = PlatformUtils.joinPath(workspaceRoot, pattern.slice(0, -2));
        if (fs.existsSync(baseDir)) {
          const entries = fs.readdirSync(baseDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const packageDir = PlatformUtils.joinPath(baseDir, entry.name);
              const packageJsonPath = PlatformUtils.joinPath(packageDir, 'package.json');
              if (fs.existsSync(packageJsonPath)) {
                packages.push(packageDir);
              }
            }
          }
        }
      } else {
        // Direct package path
        const packageDir = PlatformUtils.joinPath(workspaceRoot, pattern);
        const packageJsonPath = PlatformUtils.joinPath(packageDir, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          packages.push(packageDir);
        }
      }
    } catch (error) {
      console.warn(`Warning: Failed to expand workspace pattern ${pattern}: ${error.message}`);
    }
    
    return packages;
  }

  /**
   * Validate configuration against schema
   * @param {Object} config - Configuration object to validate
   * @throws {Error} If configuration is invalid
   */
  validateConfig(config) {
    const errors = [];

    // Validate each top-level property
    for (const [key, schemaRule] of Object.entries(CONFIG_SCHEMA)) {
      if (config[key] !== undefined) {
        const validationErrors = this.validateProperty(config[key], schemaRule, key);
        errors.push(...validationErrors);
      }
    }

    // Validate custom regex patterns
    if (config.patterns && config.patterns.custom) {
      const regexErrors = this.validateCustomPatterns(config.patterns.custom);
      errors.push(...regexErrors);
    }

    // Validate entropy configuration consistency
    if (config.entropy) {
      const entropyErrors = this.validateEntropyConfig(config.entropy);
      errors.push(...entropyErrors);
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Validate a single property against its schema rule
   * @param {*} value - Value to validate
   * @param {Object} schemaRule - Schema rule to validate against
   * @param {string} propertyPath - Path to the property for error messages
   * @returns {Array} Array of validation errors
   */
  validateProperty(value, schemaRule, propertyPath) {
    const errors = [];

    // Type validation
    if (schemaRule.type) {
      const expectedTypes = Array.isArray(schemaRule.type) ? schemaRule.type : [schemaRule.type];
      const actualType = value === null ? 'null' : (Array.isArray(value) ? 'array' : typeof value);
      
      let typeMatches = false;
      for (const expectedType of expectedTypes) {
        // Special handling for integer type (which is a subset of number in JavaScript)
        if (expectedType === 'integer' && actualType === 'number') {
          typeMatches = true;
          break;
        } else if (actualType === expectedType) {
          typeMatches = true;
          break;
        }
      }
      
      if (!typeMatches) {
        errors.push(`${propertyPath}: expected ${expectedTypes.join(' or ')}, got ${actualType}`);
        return errors; // Skip further validation if type is wrong
      }
    }

    // Enum validation
    if (schemaRule.enum) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (!schemaRule.enum.includes(item)) {
            errors.push(`${propertyPath}: "${item}" is not a valid option. Valid options: ${schemaRule.enum.join(', ')}`);
          }
        }
      } else if (!schemaRule.enum.includes(value)) {
        errors.push(`${propertyPath}: "${value}" is not a valid option. Valid options: ${schemaRule.enum.join(', ')}`);
      }
    }

    // Number range validation
    if (schemaRule.type === 'number' || schemaRule.type === 'integer') {
      if (typeof value === 'number') {
        if (schemaRule.minimum !== undefined && value < schemaRule.minimum) {
          errors.push(`${propertyPath}: value ${value} is below minimum ${schemaRule.minimum}`);
        }
        if (schemaRule.maximum !== undefined && value > schemaRule.maximum) {
          errors.push(`${propertyPath}: value ${value} is above maximum ${schemaRule.maximum}`);
        }
        if (schemaRule.type === 'integer' && !Number.isInteger(value)) {
          errors.push(`${propertyPath}: value ${value} must be an integer`);
        }
      }
    }

    // Array items validation
    if (schemaRule.type === 'array' && schemaRule.items && Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const itemErrors = this.validateProperty(value[i], schemaRule.items, `${propertyPath}[${i}]`);
        errors.push(...itemErrors);
      }
    }

    // Object properties validation
    if (schemaRule.type === 'object' && schemaRule.properties && typeof value === 'object') {
      for (const [propKey, propValue] of Object.entries(value)) {
        if (schemaRule.properties[propKey]) {
          const propErrors = this.validateProperty(propValue, schemaRule.properties[propKey], `${propertyPath}.${propKey}`);
          errors.push(...propErrors);
        }
      }
    }

    return errors;
  }

  /**
   * Validate custom regex patterns
   * @param {Array} patterns - Array of regex pattern strings
   * @returns {Array} Array of validation errors
   */
  validateCustomPatterns(patterns) {
    const errors = [];

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      
      if (typeof pattern !== 'string') {
        errors.push(`patterns.custom[${i}]: must be a string`);
        continue;
      }

      try {
        new RegExp(pattern);
      } catch (error) {
        errors.push(`patterns.custom[${i}]: invalid regex pattern "${pattern}" - ${error.message}`);
      }
    }

    return errors;
  }

  /**
   * Validate entropy configuration for logical consistency
   * @param {Object} entropyConfig - Entropy configuration object
   * @returns {Array} Array of validation errors
   */
  validateEntropyConfig(entropyConfig) {
    const errors = [];

    if (entropyConfig.minLength && entropyConfig.maxLength) {
      if (entropyConfig.minLength > entropyConfig.maxLength) {
        errors.push('entropy.minLength cannot be greater than entropy.maxLength');
      }
    }

    return errors;
  }

  /**
   * Find the first available configuration file in the current directory
   * @returns {string|null} Path to config file or null if not found
   */
  findConfigFile() {
    for (const fileName of CONFIG_FILE_NAMES) {
      const filePath = PlatformUtils.joinPath(this.workingDirectory, fileName);
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    }
    
    return null;
  }

  /**
   * Parse configuration file based on its extension
   * @param {string} filePath - Path to configuration file
   * @returns {Object} Parsed configuration object
   */
  parseConfigFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.yaml' || ext === '.yml') {
      return yaml.load(content) || {};
    } else if (ext === '.js') {
      // For JavaScript config files, we need to use dynamic import
      // This is a simplified version - in production, you might want more sophisticated handling
      throw new Error('JavaScript configuration files are not yet supported');
    } else {
      // Default to JSON parsing for .json files and extensionless files
      return JSON.parse(content);
    }
  }

  /**
   * Deep merge two configuration objects
   * @param {Object} defaultConfig - Default configuration
   * @param {Object} userConfig - User-provided configuration
   * @returns {Object} Merged configuration
   */
  mergeConfigs(defaultConfig, userConfig) {
    const merged = JSON.parse(JSON.stringify(defaultConfig));
    
    for (const [key, value] of Object.entries(userConfig)) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        merged[key] = this.mergeConfigs(merged[key] || {}, value);
      } else if (Array.isArray(value)) {
        // Special handling for arrays - merge instead of replace for certain keys
        if (this.shouldMergeArray(key, merged)) {
          merged[key] = [...(merged[key] || []), ...value];
        } else {
          merged[key] = value;
        }
      } else {
        merged[key] = value;
      }
    }
    
    return merged;
  }

  /**
   * Determine if an array should be merged or replaced
   * @param {string} key - The configuration key
   * @param {Object} merged - The current merged configuration
   * @returns {boolean} True if array should be merged
   */
  shouldMergeArray(key, _merged) {
    // Merge arrays for custom patterns and allowlist
    const mergableArrayKeys = ['custom', 'allowlist'];
    return mergableArrayKeys.includes(key);
  }

  /**
   * Get the complete configuration object
   * @returns {Object} Current configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Get configuration schema for external validation or documentation
   * @returns {Object} Configuration schema
   */
  getSchema() {
    return CONFIG_SCHEMA;
  }

  /**
   * Get pattern configuration
   * @returns {Object} Pattern configuration with custom, enabled, and disabled patterns
   */
  getPatterns() {
    return this.config.patterns;
  }

  /**
   * Get entropy detection configuration
   * @returns {Object} Entropy configuration with threshold and length limits
   */
  getEntropyConfig() {
    return this.config.entropy;
  }

  /**
   * Get ignore rules for files, directories, and extensions
   * @returns {Object} Ignore configuration
   */
  getIgnoreRules() {
    return this.config.ignore;
  }

  /**
   * Get allowlist of strings that should not be flagged as secrets
   * @returns {Array} Array of allowed strings
   */
  getAllowlist() {
    return this.config.allowlist;
  }

  /**
   * Get output formatting configuration
   * @returns {Object} Output configuration
   */
  getOutputConfig() {
    return this.config.output;
  }

  /**
   * Get workspace configuration
   * @returns {Object} Workspace configuration
   */
  getWorkspaceConfig() {
    return this.config.workspace;
  }

  /**
   * Check if a file should be ignored based on ignore rules
   * @param {string} filePath - Path to check
   * @returns {boolean} True if file should be ignored
   */
  shouldIgnoreFile(filePath) {
    const { files, directories, extensions } = this.config.ignore;
    const normalizedPath = PlatformUtils.normalizePath(filePath);
    
    // Check file patterns
    for (const pattern of files) {
      if (this.matchesPattern(normalizedPath, pattern)) {
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
    const ext = path.extname(normalizedPath);
    if (extensions.includes(ext)) {
      return true;
    }
    
    return false;
  }

  /**
   * Simple pattern matching for file paths (supports * wildcards)
   * @param {string} filePath - File path to test
   * @param {string} pattern - Pattern to match against
   * @returns {boolean} True if pattern matches
   */
  matchesPattern(filePath, pattern) {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path.basename(filePath));
  }

  /**
   * Check if a string is in the allowlist
   * @param {string} str - String to check
   * @returns {boolean} True if string is allowed
   */
  isAllowed(str) {
    return this.config.allowlist.includes(str);
  }

  /**
   * Check if current directory is within a workspace
   * @returns {boolean} True if in a workspace
   */
  isInWorkspace() {
    return this.findWorkspaceRoot() !== null;
  }

  /**
   * Get the current package information if in a workspace
   * @returns {Object|null} Package information or null
   */
  getCurrentPackageInfo() {
    const packageJsonPath = PlatformUtils.joinPath(this.workingDirectory, 'package.json');
    
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        return {
          name: packageJson.name,
          version: packageJson.version,
          path: this.workingDirectory,
          isWorkspaceRoot: this.findWorkspaceRoot() === this.workingDirectory
        };
      } catch (error) {
        return null;
      }
    }
    
    return null;
  }
}