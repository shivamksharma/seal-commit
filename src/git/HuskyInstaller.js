import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { GitUtils } from './GitUtils.js';
import { SealCommitError, ErrorCodes, ErrorFactory } from '../errors/SealCommitError.js';
import { PlatformUtils } from '../utils/PlatformUtils.js';

/**
 * Husky hook installation and management system
 */
export class HuskyInstaller {
  constructor(options = {}) {
    this.gitUtils = new GitUtils();
    this.verbose = options.verbose || false;
    this.dryRun = options.dryRun || false;
  }

  /**
   * Install Husky and set up pre-commit hook
   * @param {string} [cwd=process.cwd()] - Project directory
   * @returns {Object} Installation result
   */
  async install(cwd = process.cwd()) {
    const result = {
      huskyInstalled: false,
      hookCreated: false,
      packageJsonUpdated: false,
      errors: [],
      warnings: []
    };

    try {
      // Validate we're in a Git repository
      this.gitUtils.validateGitRepository(cwd);

      // Check if Husky is already installed
      const huskyStatus = this.checkHuskyInstallation(cwd);
      
      if (!huskyStatus.installed) {
        this.log('Installing Husky...');
        await this.installHusky(cwd);
        result.huskyInstalled = true;
      } else {
        this.log('Husky is already installed');
      }

      // Initialize Husky if needed
      if (!huskyStatus.initialized) {
        this.log('Initializing Husky...');
        await this.initializeHusky(cwd);
      }

      // Create or update pre-commit hook
      this.log('Setting up pre-commit hook...');
      const hookResult = this.createPreCommitHook(cwd);
      result.hookCreated = hookResult.created;
      
      if (hookResult.warnings.length > 0) {
        result.warnings.push(...hookResult.warnings);
      }

      // Update package.json scripts if needed
      const packageResult = this.updatePackageJsonScripts(cwd);
      result.packageJsonUpdated = packageResult.updated;
      
      if (packageResult.warnings.length > 0) {
        result.warnings.push(...packageResult.warnings);
      }

      // Validate installation
      const validation = this.validateInstallation(cwd);
      if (!validation.valid) {
        result.errors.push(...validation.errors);
      }

      this.log('Husky setup completed successfully!');
      return result;

    } catch (error) {
      const sealError = error instanceof SealCommitError ? error : 
        ErrorFactory.gitError('Husky installation failed', {
          originalError: error.message,
          cwd
        });
      
      result.errors.push(sealError);
      throw sealError;
    }
  }

  /**
   * Check if Husky is installed and initialized
   * @param {string} cwd - Project directory
   * @returns {Object} Husky status
   */
  checkHuskyInstallation(cwd) {
    const packageJsonPath = PlatformUtils.joinPath(cwd, 'package.json');
    const huskyDirPath = PlatformUtils.joinPath(cwd, '.husky');
    
    let installed = false;
    let initialized = false;

    // Check if Husky is in package.json dependencies
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        installed = !!(
          (packageJson.dependencies && packageJson.dependencies.husky) ||
          (packageJson.devDependencies && packageJson.devDependencies.husky)
        );
      } catch (error) {
        this.log(`Warning: Could not read package.json: ${error.message}`);
      }
    }

    // Check if .husky directory exists and is initialized
    if (existsSync(huskyDirPath)) {
      const huskyShPath = PlatformUtils.joinPath(huskyDirPath, '_', 'husky.sh');
      initialized = existsSync(huskyShPath);
    }

    return { installed, initialized };
  }

  /**
   * Install Husky as a dev dependency
   * @param {string} cwd - Project directory
   */
  async installHusky(cwd) {
    if (this.dryRun) {
      this.log('[DRY RUN] Would install Husky');
      return;
    }

    try {
      // Determine package manager
      const packageManager = this.detectPackageManager(cwd);
      
      let installCommand;
      switch (packageManager) {
      case 'yarn':
        installCommand = 'yarn add --dev husky';
        break;
      case 'pnpm':
        installCommand = 'pnpm add --save-dev husky';
        break;
      case 'npm':
      default:
        installCommand = 'npm install --save-dev husky';
        break;
      }

      this.log(`Installing Husky using: ${installCommand}`);
      
      execSync(installCommand, {
        cwd,
        stdio: this.verbose ? 'inherit' : 'pipe',
        encoding: 'utf8'
      });

    } catch (error) {
      throw ErrorFactory.gitError('Failed to install Husky', {
        command: 'npm install --save-dev husky',
        originalError: error.message,
        cwd
      });
    }
  }

  /**
   * Initialize Husky in the project
   * @param {string} cwd - Project directory
   */
  async initializeHusky(cwd) {
    if (this.dryRun) {
      this.log('[DRY RUN] Would initialize Husky');
      return;
    }

    try {
      const initCommand = 'npx husky install';
      
      this.log(`Initializing Husky: ${initCommand}`);
      
      execSync(initCommand, {
        cwd,
        stdio: this.verbose ? 'inherit' : 'pipe',
        encoding: 'utf8'
      });

    } catch (error) {
      throw ErrorFactory.gitError('Failed to initialize Husky', {
        command: 'npx husky install',
        originalError: error.message,
        cwd
      });
    }
  }

  /**
   * Create or update the pre-commit hook
   * @param {string} cwd - Project directory
   * @returns {Object} Hook creation result
   */
  createPreCommitHook(cwd) {
    const result = {
      created: false,
      warnings: []
    };

    const hookPath = PlatformUtils.joinPath(cwd, '.husky', 'pre-commit');
    const hookContent = this.generatePreCommitHookContent();

    try {
      // Ensure .husky directory exists
      const huskyDir = PlatformUtils.joinPath(cwd, '.husky');
      if (!existsSync(huskyDir)) {
        if (this.dryRun) {
          this.log('[DRY RUN] Would create .husky directory');
        } else {
          mkdirSync(huskyDir, { recursive: true });
        }
      }

      // Check if hook already exists
      if (existsSync(hookPath)) {
        const existingContent = readFileSync(hookPath, 'utf8');
        
        // Check if our seal-commit command is already present
        if (existingContent.includes('npx seal-commit')) {
          this.log('Pre-commit hook already contains seal-commit');
          return result;
        }

        // If hook exists but doesn't contain our command, we need to merge
        const mergedContent = this.mergeHookContent(existingContent, hookContent);
        
        if (this.dryRun) {
          this.log('[DRY RUN] Would update existing pre-commit hook');
        } else {
          writeFileSync(hookPath, mergedContent, 'utf8');
          // Use cross-platform method to make executable
          PlatformUtils.makeExecutable(hookPath);
        }
        
        result.warnings.push('Existing pre-commit hook was updated to include seal-commit');
      } else {
        // Create new hook
        if (this.dryRun) {
          this.log('[DRY RUN] Would create new pre-commit hook');
        } else {
          writeFileSync(hookPath, hookContent, 'utf8');
          // Use cross-platform method to make executable
          PlatformUtils.makeExecutable(hookPath);
        }
      }

      result.created = true;
      this.log(`Pre-commit hook created/updated: ${hookPath}`);

    } catch (error) {
      throw ErrorFactory.gitError('Failed to create pre-commit hook', {
        hookPath,
        originalError: error.message,
        cwd
      });
    }

    return result;
  }

  /**
   * Generate the content for the pre-commit hook
   * @returns {string} Hook content
   */
  generatePreCommitHookContent() {
    const platformInfo = PlatformUtils.getPlatformInfo();
    
    // Generate platform-appropriate hook content
    let hookContent;
    
    if (platformInfo.isWindows) {
      // Windows batch file format
      hookContent = `@echo off
REM seal-commit: Scan staged files for secrets before commit
call npx seal-commit
if %errorlevel% neq 0 exit /b %errorlevel%

REM seal-commit: Detect bypass attempts for audit logging
call node scripts/detect-bypass.js
`;
    } else {
      // Unix shell script format
      hookContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# seal-commit: Scan staged files for secrets before commit
npx seal-commit

# seal-commit: Detect bypass attempts for audit logging
node scripts/detect-bypass.js
`;
    }
    
    // Convert line endings to platform-appropriate format
    return PlatformUtils.convertLineEndings(hookContent);
  }

  /**
   * Merge existing hook content with our seal-commit command
   * @param {string} existingContent - Current hook content
   * @param {string} newContent - Our hook content
   * @returns {string} Merged content
   */
  mergeHookContent(existingContent, newContent) {
    const platformInfo = PlatformUtils.getPlatformInfo();
    let merged = existingContent;
    
    if (platformInfo.isWindows) {
      // Windows batch file merging
      if (!merged.startsWith('@echo off')) {
        merged = `@echo off
${merged}`;
      }
      
      // Add our seal-commit command at the end
      merged += `
REM seal-commit: Scan staged files for secrets before commit
call npx seal-commit
if %errorlevel% neq 0 exit /b %errorlevel%

REM seal-commit: Detect bypass attempts for audit logging
call node scripts/detect-bypass.js
`;
    } else {
      // Unix shell script merging
      if (!merged.startsWith('#!/usr/bin/env sh')) {
        merged = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

${merged}`;
      }

      // Add our seal-commit command at the end
      merged += `
# seal-commit: Scan staged files for secrets before commit
npx seal-commit

# seal-commit: Detect bypass attempts for audit logging
node scripts/detect-bypass.js
`;
    }

    // Convert line endings to platform-appropriate format
    return PlatformUtils.convertLineEndings(merged);
  }

  /**
   * Update package.json scripts to include Husky prepare script
   * @param {string} cwd - Project directory
   * @returns {Object} Update result
   */
  updatePackageJsonScripts(cwd) {
    const result = {
      updated: false,
      warnings: []
    };

    const packageJsonPath = PlatformUtils.joinPath(cwd, 'package.json');
    
    if (!existsSync(packageJsonPath)) {
      result.warnings.push('package.json not found, skipping script update');
      return result;
    }

    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      
      // Ensure scripts object exists
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }

      // Add prepare script if it doesn't exist or doesn't include husky install
      const currentPrepare = packageJson.scripts.prepare || '';
      
      if (!currentPrepare.includes('husky install')) {
        const newPrepare = currentPrepare ? 
          `${currentPrepare} && husky install` : 
          'husky install';
        
        if (this.dryRun) {
          this.log('[DRY RUN] Would update package.json prepare script');
        } else {
          packageJson.scripts.prepare = newPrepare;
          writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
        }
        
        result.updated = true;
        this.log('Updated package.json prepare script to include husky install');
      }

    } catch (error) {
      result.warnings.push(`Failed to update package.json: ${error.message}`);
    }

    return result;
  }

  /**
   * Detect the package manager being used
   * @param {string} cwd - Project directory
   * @returns {string} Package manager name
   */
  detectPackageManager(cwd) {
    if (existsSync(PlatformUtils.joinPath(cwd, 'yarn.lock'))) {
      return 'yarn';
    }
    if (existsSync(PlatformUtils.joinPath(cwd, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }
    return 'npm';
  }

  /**
   * Validate that the installation was successful
   * @param {string} cwd - Project directory
   * @returns {Object} Validation result
   */
  validateInstallation(cwd) {
    const result = {
      valid: true,
      errors: []
    };

    try {
      // Check if .husky directory exists
      const huskyDir = PlatformUtils.joinPath(cwd, '.husky');
      if (!existsSync(huskyDir)) {
        result.valid = false;
        result.errors.push('Husky directory (.husky) not found');
      }

      // Check if pre-commit hook exists and is executable
      const hookPath = PlatformUtils.joinPath(huskyDir, 'pre-commit');
      if (!existsSync(hookPath)) {
        result.valid = false;
        result.errors.push('Pre-commit hook not found');
      } else {
        // Check if hook contains our command
        const hookContent = readFileSync(hookPath, 'utf8');
        if (!hookContent.includes('npx seal-commit')) {
          result.valid = false;
          result.errors.push('Pre-commit hook does not contain seal-commit command');
        }
      }

      // Check if Husky is properly initialized
      const huskyShPath = PlatformUtils.joinPath(huskyDir, '_', 'husky.sh');
      if (!existsSync(huskyShPath)) {
        result.valid = false;
        result.errors.push('Husky not properly initialized (husky.sh not found)');
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Uninstall Husky hooks (for testing or cleanup)
   * @param {string} [cwd=process.cwd()] - Project directory
   * @returns {Object} Uninstall result
   */
  async uninstall(cwd = process.cwd()) {
    const result = {
      hookRemoved: false,
      huskyUninstalled: false,
      errors: []
    };

    try {
      // Remove pre-commit hook or just our part of it
      const hookPath = PlatformUtils.joinPath(cwd, '.husky', 'pre-commit');
      if (existsSync(hookPath)) {
        const hookContent = readFileSync(hookPath, 'utf8');
        const platformInfo = PlatformUtils.getPlatformInfo();
        
        // Remove our seal-commit lines (platform-specific patterns)
        let cleanedContent;
        if (platformInfo.isWindows) {
          cleanedContent = hookContent
            .replace(/REM seal-commit: Scan staged files for secrets before commit\r?\n/g, '')
            .replace(/call npx seal-commit\r?\n/g, '')
            .replace(/if %errorlevel% neq 0 exit \/b %errorlevel%\r?\n/g, '')
            .trim();
        } else {
          cleanedContent = hookContent
            .replace(/# seal-commit: Scan staged files for secrets before commit\r?\n/g, '')
            .replace(/npx seal-commit\r?\n/g, '')
            .trim();
        }

        if (cleanedContent.length > 0 && !cleanedContent.match(/^#!/) && !cleanedContent.match(/^@echo off/)) {
          // Other content exists, just remove our part
          writeFileSync(hookPath, cleanedContent + '\n', 'utf8');
        } else {
          // Remove the entire hook file if it only contained our content
          const fs = await import('fs');
          fs.unlinkSync(hookPath);
        }
        
        result.hookRemoved = true;
      }

    } catch (error) {
      result.errors.push(ErrorFactory.gitError('Failed to uninstall hooks', {
        originalError: error.message,
        cwd
      }));
    }

    return result;
  }

  /**
   * Log message if verbose mode is enabled
   * @param {string} message - Message to log
   */
  log(message) {
    if (this.verbose) {
      console.log(`[HuskyInstaller] ${message}`);
    }
  }
}

// Export singleton instance
export const huskyInstaller = new HuskyInstaller();