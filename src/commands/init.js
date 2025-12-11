import fs from 'fs';
import path from 'path';
import { log, assertGitRepo } from '../utils.js';

export function cmdInit() {
    assertGitRepo(); // Ensure we are in a git repo before installing hooks

    const gitDir = path.resolve('.git');
    const hooksDir = path.join(gitDir, 'hooks');
    const preCommitPath = path.join(hooksDir, 'pre-commit');

    if (!fs.existsSync(hooksDir)) {
        fs.mkdirSync(hooksDir, { recursive: true });
    }

    const hookContent = `#!/bin/sh
# seal-commit-hook
# This hook was installed by seal-commit to prevent secret leaks.

echo "🦭 seal-commit: Scanning staged files..."
npx seal-commit run
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "🦭 seal-commit: Secrets detected. Commit blocked."
  exit 1
fi

exit 0
`;

    fs.writeFileSync(preCommitPath, hookContent);
    fs.chmodSync(preCommitPath, '755');

    log.success('Seal-Commit installed successfully!');
    log.info(`Pre-commit hook created at ${preCommitPath}`);
    log.info('Your commits are now protected.');
}
