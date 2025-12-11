import fs from 'fs';
import path from 'path';
import { log } from '../utils.js';

export function cmdAllow(pattern) {
    if (!pattern) {
        log.error('Please provide a pattern to allow.');
        log.info('Usage: seal-commit allow "pattern"');
        process.exit(1);
    }

    const ignorePath = path.resolve('.sealignore');
    try {
        fs.appendFileSync(ignorePath, `${pattern}\n`);
        log.success(`Added "${pattern}" to .sealignore`);
        log.info('This pattern will now be ignored in scans.');
    } catch (err) {
        log.error('Failed to write to .sealignore');
    }
}
