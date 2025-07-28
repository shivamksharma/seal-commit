#!/usr/bin/env node

import { HuskyInstaller } from '../src/git/HuskyInstaller.js';
import { ErrorHandler, SealCommitError, ErrorCodes } from '../src/errors/SealCommitError.js';
import { GitUtils } from '../src/git/GitUtils.js';
import { PlatformUtils } from '../src/utils/PlatformUtils.js';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Postinstall script for automatic Husky setup
 * Runs after npm install to automatically configure Git hooks
 */
async function postinstall() {
  const errorHandler = new ErrorHandler({ verbose: false, exitOnError: false });
  const gitUtils = new GitUtils();
  
  try {
    console.log('🔒 Setting up seal-commit Git hooks...');
    
    // Pre-installation validation
    const validationResult = await validateEnvironment(gitUtils);
    if (!validationResult.valid) {
      console.log('⚠️  Setup skipped due to environment issues:');
      validationResult.warnings.forEach(warning => {
        console.log(`   • ${warning}`);
      });
      
      if (validationResult.canContinue) {
        console.log('\n💡 You can manually set up hooks later using: npx seal-commit --setup');
      }
      return;
    }
    
    // Perform installation
    const installer = new HuskyInstaller({ verbose: true });
    const result = await installer.install();
    
    // Handle installation results
    if (result.errors.length > 0) {
      console.log('⚠️  Setup completed with errors:');
      result.errors.forEach(error => {
        errorHandler.handle(error);
      });
      
      // Provide recovery instructions
      console.log('\n🔧 To fix these issues:');
      console.log('   • Ensure you have write permissions to the project directory');
      console.log('   • Make sure Git is properly installed and configured');
      console.log('   • Try running: npx seal-commit --setup');
      
    } else {
      console.log('✅ seal-commit setup completed successfully!');
      
      // Display warnings if any
      if (result.warnings.length > 0) {
        console.log('\n📝 Notes:');
        result.warnings.forEach(warning => {
          console.log(`   • ${warning}`);
        });
      }
      
      // Success summary
      console.log('\n🚀 Your repository is now protected against secret commits!');
      const features = [];
      if (result.hookCreated) features.push('Pre-commit hook installed');
      if (result.huskyInstalled) features.push('Husky installed and configured');
      if (result.packageJsonUpdated) features.push('Package.json updated with prepare script');
      
      features.forEach(feature => {
        console.log(`   ✓ ${feature}`);
      });
      
      console.log('\n🎯 Next steps:');
      console.log('   • Try committing a file to test the hook');
      console.log('   • Configure custom rules in .sealcommitrc if needed');
      console.log('   • Run "npx seal-commit --help" for more options');
    }
    
    // Post-installation validation
    const postValidation = await validateInstallation();
    if (!postValidation.valid) {
      console.log('\n⚠️  Installation validation failed:');
      postValidation.errors.forEach(error => {
        console.log(`   • ${error}`);
      });
    }
    
  } catch (error) {
    console.log('❌ Failed to set up seal-commit hooks');
    
    // Enhanced error reporting
    const handledError = errorHandler.handle(error);
    
    // Provide context-specific recovery instructions
    if (error.code === ErrorCodes.GIT_NOT_FOUND) {
      console.log('\n💡 This doesn\'t appear to be a Git repository.');
      console.log('   Initialize Git first: git init');
      console.log('   Then reinstall: npm install');
    } else if (error.code === ErrorCodes.FILE_ACCESS_DENIED) {
      console.log('\n💡 Permission issues detected.');
      console.log('   Try running with appropriate permissions');
      console.log('   Or set up hooks manually later');
    } else {
      console.log('\n🔧 Manual setup instructions:');
      console.log('   1. Install Husky: npm install --save-dev husky');
      console.log('   2. Initialize Husky: npx husky install');
      console.log('   3. Add pre-commit hook: npx husky add .husky/pre-commit "npx seal-commit"');
      console.log('   4. Add prepare script to package.json: "prepare": "husky install"');
    }
    
    console.log('\n📞 Need help? Check the documentation or report issues at:');
    console.log('   https://github.com/your-org/seal-commit/issues');
    
    // Don't exit with error code to avoid breaking npm install
    // Users can still use the tool manually
  }
}

/**
 * Validates the environment before attempting installation
 * @param {GitUtils} gitUtils - Git utilities instance
 * @returns {Object} Validation result
 */
async function validateEnvironment(gitUtils) {
  const result = {
    valid: true,
    canContinue: true,
    warnings: []
  };
  
  // Get platform information for platform-specific validation
  const platformInfo = PlatformUtils.getPlatformInfo();
  
  try {
    // Check if we're in a Git repository
    gitUtils.validateGitRepository();
  } catch (error) {
    result.valid = false;
    result.canContinue = false;
    result.warnings.push('Not in a Git repository - hooks cannot be installed');
    return result;
  }
  
  // Validate system dependencies
  const depValidation = PlatformUtils.validateSystemDependencies(['git', 'node']);
  if (!depValidation.valid) {
    result.valid = false;
    result.warnings.push(`Missing required dependencies: ${depValidation.missing.join(', ')}`);
    
    // Provide platform-specific installation instructions
    if (platformInfo.isWindows) {
      result.warnings.push('Install Git from https://git-scm.com/download/win');
    } else if (platformInfo.isMacOS) {
      result.warnings.push('Install Git using: brew install git');
    } else {
      result.warnings.push('Install Git using your package manager (e.g., apt install git)');
    }
  }
  
  // Check if package.json exists
  if (!existsSync('package.json')) {
    result.warnings.push('No package.json found - some features may not work correctly');
  }
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion < 16) {
    result.valid = false;
    result.warnings.push(`Node.js ${nodeVersion} is not supported. Please upgrade to Node.js 16 or higher`);
  }
  
  // Check if we can write to the current directory
  try {
    const testFile = PlatformUtils.joinPath(process.cwd(), '.seal-commit-test');
    const fs = await import('fs');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (error) {
    result.valid = false;
    result.warnings.push('Cannot write to current directory - permission issues detected');
    
    // Add platform-specific permission guidance
    if (platformInfo.isWindows) {
      result.warnings.push('Try running as Administrator or check folder permissions');
    } else {
      result.warnings.push('Check directory permissions or try running with sudo');
    }
  }
  
  return result;
}

/**
 * Validates that the installation was successful
 * @returns {Object} Validation result
 */
async function validateInstallation() {
  const result = {
    valid: true,
    errors: []
  };
  
  // Check if .husky directory exists
  if (!existsSync('.husky')) {
    result.valid = false;
    result.errors.push('Husky directory not created');
    return result;
  }
  
  // Check if pre-commit hook exists
  const hookPath = PlatformUtils.joinPath('.husky', 'pre-commit');
  if (!existsSync(hookPath)) {
    result.valid = false;
    result.errors.push('Pre-commit hook not created');
    return result;
  }
  
  // Check if hook contains our command
  try {
    const fs = await import('fs');
    const hookContent = fs.readFileSync(hookPath, 'utf8');
    if (!hookContent.includes('npx seal-commit')) {
      result.valid = false;
      result.errors.push('Pre-commit hook does not contain seal-commit command');
    }
  } catch (error) {
    result.valid = false;
    result.errors.push('Cannot read pre-commit hook file');
  }
  
  return result;
}

// Export for testing
export { postinstall, validateEnvironment, validateInstallation };

// Only run if this script is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  postinstall();
}