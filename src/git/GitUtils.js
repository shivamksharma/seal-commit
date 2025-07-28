import { execSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { SealCommitError, ErrorCodes, ErrorFactory } from '../errors/SealCommitError.js';
import { PlatformUtils } from '../utils/PlatformUtils.js';

/**
 * Git utility functions for repository validation and file operations
 */
export class GitUtils {
  constructor() {
    this.gitPath = this.findGitExecutable();
  }

  /**
   * Find the Git executable path
   * @returns {string} Path to Git executable
   * @throws {SealCommitError} If Git is not found
   */
  findGitExecutable() {
    const gitPath = PlatformUtils.findExecutable('git');
    
    if (!gitPath) {
      throw ErrorFactory.gitError('Git executable not found in PATH', {
        suggestion: 'Please install Git and ensure it is available in your PATH',
        platform: PlatformUtils.getPlatformInfo().platform
      });
    }
    
    return gitPath;
  }

  /**
   * Check if the current directory is within a Git repository
   * @param {string} [cwd=process.cwd()] - Directory to check
   * @returns {boolean} True if in a Git repository
   */
  isGitRepository(cwd = process.cwd()) {
    try {
      // Look for .git directory or file (for worktrees)
      let currentDir = PlatformUtils.normalizePath(cwd);
      const platformInfo = PlatformUtils.getPlatformInfo();
      
      // Get the root directory for the platform
      const root = platformInfo.isWindows ? 
        currentDir.split(':')[0] + ':\\' : // Windows drive root (e.g., C:\)
        '/'; // Unix root
      
      while (currentDir !== root) {
        const gitPath = PlatformUtils.joinPath(currentDir, '.git');
        if (existsSync(gitPath)) {
          return true;
        }
        currentDir = PlatformUtils.normalizePath(resolve(currentDir, '..'));
        
        // Safety check to prevent infinite loops
        if (currentDir === resolve(currentDir, '..')) {
          break;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate that we're in a Git repository and Git is available
   * @param {string} [cwd=process.cwd()] - Directory to validate
   * @throws {SealCommitError} If validation fails
   */
  validateGitRepository(cwd = process.cwd()) {
    if (!this.isGitRepository(cwd)) {
      throw ErrorFactory.gitError('Not in a Git repository', {
        cwd,
        suggestion: 'Run this command from within a Git repository or initialize one with "git init"'
      });
    }
  }

  /**
   * Execute a Git command synchronously
   * @param {string[]} args - Git command arguments
   * @param {Object} options - Execution options
   * @returns {string} Command output
   * @throws {SealCommitError} If command fails
   */
  execGitSync(args, options = {}) {
    const { cwd = process.cwd(), encoding = 'utf8' } = options;
    
    try {
      const result = execSync(`"${this.gitPath}" ${args.join(' ')}`, {
        cwd,
        encoding,
        stdio: 'pipe',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      return result.trim();
    } catch (error) {
      throw ErrorFactory.gitError(`Git command failed: git ${args.join(' ')}`, {
        command: `git ${args.join(' ')}`,
        exitCode: error.status,
        stderr: error.stderr?.toString(),
        stdout: error.stdout?.toString(),
        cwd
      });
    }
  }

  /**
   * Get list of staged files (files in the index)
   * @param {string} [cwd=process.cwd()] - Repository directory
   * @returns {string[]} Array of staged file paths relative to repository root
   */
  getStagedFiles(cwd = process.cwd()) {
    this.validateGitRepository(cwd);
    
    try {
      // Use git diff --cached --name-only to get staged files
      const output = this.execGitSync(['diff', '--cached', '--name-only'], { cwd });
      
      if (!output) {
        return [];
      }
      
      return output.split('\n').filter(file => file.trim().length > 0);
    } catch (error) {
      if (error instanceof SealCommitError) {
        throw error;
      }
      throw ErrorFactory.gitError('Failed to get staged files', {
        originalError: error.message,
        cwd
      });
    }
  }

  /**
   * Get list of all tracked files in the repository
   * @param {string} [cwd=process.cwd()] - Repository directory
   * @returns {string[]} Array of tracked file paths relative to repository root
   */
  getAllTrackedFiles(cwd = process.cwd()) {
    this.validateGitRepository(cwd);
    
    try {
      // Use git ls-files to get all tracked files
      const output = this.execGitSync(['ls-files'], { cwd });
      
      if (!output) {
        return [];
      }
      
      return output.split('\n').filter(file => file.trim().length > 0);
    } catch (error) {
      if (error instanceof SealCommitError) {
        throw error;
      }
      throw ErrorFactory.gitError('Failed to get tracked files', {
        originalError: error.message,
        cwd
      });
    }
  }

  /**
   * Get the repository root directory
   * @param {string} [cwd=process.cwd()] - Directory to start search from
   * @returns {string} Absolute path to repository root
   */
  getRepositoryRoot(cwd = process.cwd()) {
    this.validateGitRepository(cwd);
    
    try {
      const output = this.execGitSync(['rev-parse', '--show-toplevel'], { cwd });
      return output;
    } catch (error) {
      if (error instanceof SealCommitError) {
        throw error;
      }
      throw ErrorFactory.gitError('Failed to get repository root', {
        originalError: error.message,
        cwd
      });
    }
  }

  /**
   * Check if there are any staged changes
   * @param {string} [cwd=process.cwd()] - Repository directory
   * @returns {boolean} True if there are staged changes
   */
  hasStagedChanges(cwd = process.cwd()) {
    this.validateGitRepository(cwd);
    
    try {
      // Use git diff --cached --quiet to check for staged changes
      this.execGitSync(['diff', '--cached', '--quiet'], { cwd });
      return false; // No staged changes if command succeeds
    } catch (error) {
      // git diff --quiet returns exit code 1 if there are differences
      if (error.details?.exitCode === 1) {
        return true;
      }
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Get the current branch name
   * @param {string} [cwd=process.cwd()] - Repository directory
   * @returns {string} Current branch name
   */
  getCurrentBranch(cwd = process.cwd()) {
    this.validateGitRepository(cwd);
    
    try {
      const output = this.execGitSync(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
      return output;
    } catch (error) {
      if (error instanceof SealCommitError) {
        throw error;
      }
      throw ErrorFactory.gitError('Failed to get current branch', {
        originalError: error.message,
        cwd
      });
    }
  }

  /**
   * Check if a file is tracked by Git
   * @param {string} filePath - Path to file relative to repository root
   * @param {string} [cwd=process.cwd()] - Repository directory
   * @returns {boolean} True if file is tracked
   */
  isFileTracked(filePath, cwd = process.cwd()) {
    this.validateGitRepository(cwd);
    
    try {
      // Use git ls-files to check if file is tracked
      this.execGitSync(['ls-files', '--error-unmatch', filePath], { cwd });
      return true;
    } catch (error) {
      // Exit code 1 means file is not tracked
      if (error.details?.exitCode === 1) {
        return false;
      }
      // Re-throw other errors
      throw error;
    }
  }
}

// Export singleton instance
export const gitUtils = new GitUtils();