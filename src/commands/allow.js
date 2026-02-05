/**
 * Seal-Commit v2 - Allow Command (Pattern Management)
 * 
 * Features:
 * - Add patterns with hashing
 * - Verify integrity
 * - List patterns
 */

import fs from 'fs';
import path from 'path';
import { log, addToSealignore, verifySealignoreIntegrity, loadConfig } from '../utils.js';

export function cmdAllow(pattern, options = {}) {
    if (!pattern || pattern.length < 3) {
        log.error('Please provide a valid pattern (min 3 characters).');
        log.info('Usage: seal-commit allow "<pattern>"');
        return;
    }
    
    const ignorePath = path.resolve('.sealignore');
    
    try {
        addToSealignore(pattern, { hash: true });
        
        log.success('Added "' + pattern + '" to .sealignore');
        log.info('This pattern will be ignored in scans.');
        
        const integrity = verifySealignoreIntegrity();
        if (integrity.valid) {
            log.success('Integrity check passed.');
        }
        
        log.dim('\nTip: Use glob patterns like "*.test.js" to ignore files');
        
    } catch (err) {
        log.error('Failed to write to .sealignore: ' + err.message);
        
        if (err.code === 'ENOENT') {
            try {
                fs.writeFileSync(ignorePath, '# seal-commit ignore rules\n\n' + pattern + '\n');
                log.success('Created .sealignore and added pattern.');
            } catch (e) {
                log.error('Failed to create .sealignore: ' + e.message);
            }
        }
    }
}

export function cmdVerify() {
    const ignorePath = path.resolve('.sealignore');
    
    if (!fs.existsSync(ignorePath)) {
        log.warn('No .sealignore file found.');
        log.info('Run "seal-commit allow <pattern>" to add ignored patterns.');
        return;
    }
    
    const integrity = verifySealignoreIntegrity();
    
    if (integrity.valid) {
        log.success('.sealignore integrity verified.');
        log.info(integrity.message);
    } else {
        log.error('.sealignore integrity check FAILED!');
        log.error(integrity.message);
        log.warn('Possible tampering detected. Review your .sealignore file.');
    }
}

export function cmdList() {
    const ignorePath = path.resolve('.sealignore');
    
    if (!fs.existsSync(ignorePath)) {
        log.warn('No .sealignore file found.');
        return;
    }
    
    try {
        const content = fs.readFileSync(ignorePath, 'utf-8');
        const lines = content.split('\n');
        
        log.title('Ignored Patterns');
        console.log('');
        
        let count = 0;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            if (trimmed.startsWith('HASH:')) {
                console.log('  ' + trimmed);
            } else {
                console.log('  ' + trimmed);
                count++;
            }
        }
        
        if (count === 0) {
            log.info('No patterns configured.');
        } else {
            log.info('Total: ' + count + ' pattern(s)');
        }
        
    } catch (err) {
        log.error('Failed to read .sealignore: ' + err.message);
    }
}

export function cmdConfig(options = {}) {
    const configPath = path.resolve('.sealconfig.json');
    
    if (options.get) {
        const config = loadConfig();
        console.log(config[options.get] || 'Not set');
        return;
    }
    
    if (options.set) {
        const parts = options.set.split(' ');
        const key = parts[0];
        const value = parts.slice(1).join(' ');
        
        let config = loadConfig();
        
        if (!isNaN(value)) {
            config[key] = parseFloat(value);
        } else if (value === 'true' || value === 'false') {
            config[key] = value === 'true';
        } else {
            config[key] = value;
        }
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('Set ' + key + '=' + value);
        return;
    }
    
    if (options.reset) {
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
            console.log('Configuration reset to defaults.');
        } else {
            console.log('No configuration to reset.');
        }
        return;
    }
    
    // Display current config
    const config = loadConfig();
    
    log.title('Configuration');
    console.log('');
    
    if (Object.keys(config).length === 0) {
        console.log('  No custom configuration.');
        console.log('  Using default settings.\n');
    } else {
        for (const [key, value] of Object.entries(config)) {
            console.log('  ' + key + ': ' + JSON.stringify(value));
        }
        console.log('');
    }
    
    console.log('  Available settings:');
    console.log('    entropyThreshold    - Entropy threshold (default: 5.2)');
    console.log('    maxFileSize         - Max file size in bytes (default: 10485760)');
    console.log('    enableCache         - Enable caching (default: true)');
    console.log('\n  Usage:');
    console.log('    seal-commit config --set entropyThreshold 5.5');
    console.log('    seal-commit config --get entropyThreshold');
    console.log('    seal-commit config --reset');
}
