import { execSync } from 'child_process';
import { platform, arch } from 'os';
import { sep, resolve, join, normalize, isAbsolute } from 'path';
import { constants, accessSync } from 'fs';

/**
 * Cross-platform utility functions for handling OS-specific operations
 */
export class PlatformUtils {
  /**
   * Get the current platform information
   * @returns {Object} Platform details
   */
  static getPlatformInfo() {
    const platformName = platform();
    const architecture = arch();
    
    return {
      platform: platformName,
      arch: architecture,
      isWindows: platformName === 'win32',
      isMacOS: platformName === 'darwin',
      isLinux: platformName === 'linux',
      isUnix: platformName !== 'win32',
      pathSeparator: sep,
      lineEnding: platformName === 'win32' ? '\r\n' : '\n'
    };
  }

  /**
   * Find an executable in the system PATH
   * @param {string} executable - Name of the executable to find
   * @returns {string|null} Path to executable or null if not found
   */
  static findExecutable(executable) {
    const { isWindows } = this.getPlatformInfo();
    
    try {
      let command;
      if (isWindows) {
        // On Windows, use 'where' command
        command = `where ${executable}`;
      } else {
        // On Unix-like systems, use 'which' command
        command = `which ${executable}`;
      }
      
      const result = execSync(command, { 
        encoding: 'utf8', 
        stdio: 'pipe',
        timeout: 5000 // 5 second timeout
      }).trim();
      
      if (isWindows && result.includes('\n')) {
        // Windows 'where' can return multiple paths, take the first one
        return result.split('\n')[0].trim();
      }
      
      return result;
    } catch (error) {
      return null;
    }
  }

  /**
   * Normalize a file path for the current platform
   * @param {string} filePath - Path to normalize
   * @returns {string} Normalized path
   */
  static normalizePath(filePath) {
    if (!filePath) return filePath;
    
    // Convert to platform-specific separators and resolve
    return normalize(resolve(filePath));
  }

  /**
   * Join path segments using the correct separator for the platform
   * @param {...string} segments - Path segments to join
   * @returns {string} Joined path
   */
  static joinPath(...segments) {
    return join(...segments);
  }

  /**
   * Convert a relative path to absolute, handling platform differences
   * @param {string} relativePath - Relative path
   * @param {string} [basePath=process.cwd()] - Base path for resolution
   * @returns {string} Absolute path
   */
  static toAbsolutePath(relativePath, basePath = process.cwd()) {
    if (isAbsolute(relativePath)) {
      return this.normalizePath(relativePath);
    }
    
    return this.normalizePath(resolve(basePath, relativePath));
  }

  /**
   * Check if a file is executable on the current platform
   * @param {string} filePath - Path to file
   * @returns {boolean} True if file is executable
   */
  static isExecutable(filePath) {
    try {
      const { isWindows } = this.getPlatformInfo();
      
      if (isWindows) {
        // On Windows, check if file exists and has executable extension
        accessSync(filePath, constants.F_OK);
        const ext = filePath.toLowerCase().split('.').pop();
        return ['exe', 'bat', 'cmd', 'com', 'ps1'].includes(ext);
      } else {
        // On Unix-like systems, check execute permission
        accessSync(filePath, constants.F_OK | constants.X_OK);
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Make a file executable on the current platform
   * @param {string} filePath - Path to file
   * @param {number} [mode=0o755] - Unix permissions mode (ignored on Windows)
   */
  static makeExecutable(filePath, mode = 0o755) {
    const { isWindows } = this.getPlatformInfo();
    
    if (isWindows) {
      // On Windows, executability is determined by file extension
      // No need to set permissions, but we can verify the file exists
      try {
        accessSync(filePath, constants.F_OK);
      } catch (error) {
        throw new Error(`Cannot access file: ${filePath}`);
      }
    } else {
      // On Unix-like systems, set execute permissions
      try {
        // Use execSync to call chmod command for cross-platform compatibility
        execSync(`chmod ${mode.toString(8)} "${filePath}"`, { stdio: 'pipe' });
      } catch (error) {
        throw new Error(`Cannot set execute permissions on ${filePath}: ${error.message}`);
      }
    }
  }

  /**
   * Get the appropriate shell command for the platform
   * @returns {Object} Shell information
   */
  static getShellInfo() {
    const { isWindows } = this.getPlatformInfo();
    
    if (isWindows) {
      return {
        shell: 'cmd.exe',
        shellFlag: '/c',
        scriptExtension: '.bat',
        shebang: '@echo off',
        commandSeparator: ' && '
      };
    } else {
      return {
        shell: '/bin/sh',
        shellFlag: '-c',
        scriptExtension: '.sh',
        shebang: '#!/usr/bin/env sh',
        commandSeparator: ' && '
      };
    }
  }

  /**
   * Execute a command with platform-appropriate shell
   * @param {string} command - Command to execute
   * @param {Object} options - Execution options
   * @returns {string} Command output
   */
  static execCommand(command, options = {}) {
    const { shell, shellFlag } = this.getShellInfo();
    const { cwd = process.cwd(), encoding = 'utf8', timeout = 30000 } = options;
    
    try {
      return execSync(`${shell} ${shellFlag} "${command}"`, {
        cwd,
        encoding,
        stdio: 'pipe',
        timeout,
        ...options
      });
    } catch (error) {
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  }

  /**
   * Get environment variable with platform-specific handling
   * @param {string} name - Environment variable name
   * @param {string} [defaultValue] - Default value if not found
   * @returns {string|undefined} Environment variable value
   */
  static getEnvVar(name, defaultValue) {
    const { isWindows } = this.getPlatformInfo();
    
    // On Windows, environment variables are case-insensitive
    if (isWindows) {
      const upperName = name.toUpperCase();
      return process.env[upperName] || process.env[name] || defaultValue;
    }
    
    return process.env[name] || defaultValue;
  }

  /**
   * Get the user's home directory path
   * @returns {string} Home directory path
   */
  static getHomeDirectory() {
    const { isWindows } = this.getPlatformInfo();
    
    if (isWindows) {
      return this.getEnvVar('USERPROFILE') || this.getEnvVar('HOMEPATH');
    } else {
      return this.getEnvVar('HOME');
    }
  }

  /**
   * Get temporary directory path for the platform
   * @returns {string} Temporary directory path
   */
  static getTempDirectory() {
    const { isWindows } = this.getPlatformInfo();
    
    if (isWindows) {
      return this.getEnvVar('TEMP') || this.getEnvVar('TMP') || 'C:\\temp';
    } else {
      return this.getEnvVar('TMPDIR') || '/tmp';
    }
  }

  /**
   * Convert line endings to platform-appropriate format
   * @param {string} content - Content to convert
   * @param {string} [targetPlatform] - Target platform ('win32', 'unix', or auto-detect)
   * @returns {string} Content with converted line endings
   */
  static convertLineEndings(content, targetPlatform) {
    if (!content) return content;
    
    const { isWindows } = this.getPlatformInfo();
    const useWindowsEndings = targetPlatform === 'win32' || 
                             (targetPlatform === undefined && isWindows);
    
    // First normalize all line endings to \n
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Then convert to target format
    return useWindowsEndings ? normalized.replace(/\n/g, '\r\n') : normalized;
  }

  /**
   * Check if the current process has administrative/root privileges
   * @returns {boolean} True if running with elevated privileges
   */
  static hasElevatedPrivileges() {
    const { isWindows } = this.getPlatformInfo();
    
    try {
      if (isWindows) {
        // On Windows, try to access a system directory
        const { accessSync, constants } = require('fs');
        accessSync('C:\\Windows\\System32\\config', constants.R_OK);
        return true;
      } else {
        // On Unix-like systems, check if running as root
        return process.getuid && process.getuid() === 0;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Get platform-specific file patterns for ignoring
   * @returns {string[]} Array of ignore patterns
   */
  static getPlatformIgnorePatterns() {
    const { isWindows } = this.getPlatformInfo();
    
    const commonPatterns = [
      '.git/**',
      'node_modules/**',
      '.DS_Store',
      'Thumbs.db'
    ];
    
    if (isWindows) {
      return [
        ...commonPatterns,
        'desktop.ini',
        '*.lnk',
        '$RECYCLE.BIN/**'
      ];
    } else {
      return [
        ...commonPatterns,
        '.Trash/**',
        '*.swp',
        '*.swo',
        '*~'
      ];
    }
  }

  /**
   * Validate that required system dependencies are available
   * @param {string[]} dependencies - List of required executables
   * @returns {Object} Validation result
   */
  static validateSystemDependencies(dependencies = ['git', 'node']) {
    const result = {
      valid: true,
      missing: [],
      found: {}
    };
    
    for (const dep of dependencies) {
      const path = this.findExecutable(dep);
      if (path) {
        result.found[dep] = path;
      } else {
        result.valid = false;
        result.missing.push(dep);
      }
    }
    
    return result;
  }
}

// Export singleton instance for convenience
export const platformUtils = new PlatformUtils();