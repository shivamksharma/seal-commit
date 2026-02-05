/**
 * Seal-Commit v2 - Production-Grade Secret Detection Engine
 * 
 * Features:
 * - AST-based parsing for JS/TS files
 * - Multi-layer detection (regex + entropy + AST)
 * - Bypass technique detection
 * - Severity scoring
 * - Educational messages
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

export const CONFIG = {
    // Detection thresholds
    entropyThreshold: 5.2,
    minSecretLength: 8,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxAstFileSize: 2 * 1024 * 1024, // 2MB for AST parsing
    
    // File types for AST parsing
    astExtensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
    
    // Cache settings
    enableCache: true,
    cacheDir: '.seal-cache',
    
    // Severity weights
    severityWeights: {
        critical: 10,
        high: 7,
        medium: 4,
        low: 1,
        info: 0
    }
};

// ============================================================================
// SECRET PATTERNS DATABASE
// ============================================================================

export const PATTERNS = {
    // AWS
    awsAccessKey: {
        name: 'AWS Access Key ID',
        regex: /\bAKIA[0-9A-Z]{16}\b/g,
        severity: 'critical',
        message: 'AWS Access Keys can be used to access all AWS resources. Rotate immediately.',
        fix: 'Use AWS IAM roles or environment variables with AWS SDK.'
    },
    awsSecretKey: {
        name: 'AWS Secret Access Key',
        regex: /\b[A-Za-z0-9/+=]{40}\b/g,
        severity: 'critical',
        context: ['aws', 'secret', 'credential', 'key'],
        message: 'AWS Secret Keys provide full access to AWS accounts. This is critical.',
        fix: 'Store in AWS Secrets Manager or use IAM roles.'
    },
    
    // Google
    googleApiKey: {
        name: 'Google API Key',
        regex: /\bAIza[0-9A-Za-z-_]{35}\b/g,
        severity: 'high',
        message: 'Google API keys can incur billing charges and access Google services.',
        fix: 'Restrict API key to specific services in Google Cloud Console.'
    },
    googleOAuth: {
        name: 'Google OAuth Client ID',
        regex: /\b[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com\b/g,
        severity: 'high',
        message: 'OAuth Client IDs can be used to impersonate your application.',
        fix: 'Use Google Identity Platform for authentication.'
    },
    
    // Slack
    slackToken: {
        name: 'Slack Token',
        regex: /\bxox[baprs]-([0-9a-zA-Z]{10,48})\b/g,
        severity: 'critical',
        message: 'Slack tokens can read all messages and perform actions in your workspace.',
        fix: 'Use Slack OAuth tokens with minimal scopes.'
    },
    slackWebhook: {
        name: 'Slack Webhook URL',
        regex: /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Z]+\/B[0-9A-Z]+\/[0-9A-Za-z]+/g,
        severity: 'high',
        message: 'Slack webhooks allow posting messages to channels. Limit channel access.',
        fix: 'Use Slack App permissions instead of webhooks.'
    },
    
    // JWT
    jwtToken: {
        name: 'JWT Token',
        regex: /\beyJ[a-zA-Z0-9-_]*\.eyJ[a-zA-Z0-9-_]*\.[a-zA-Z0-9-_]*\b/g,
        severity: 'high',
        message: 'JWT tokens contain user session data. Ensure tokens are short-lived.',
        fix: 'Use short-lived tokens and refresh tokens securely.'
    },
    
    // Private Keys
    privateKey: {
        name: 'Private Key',
        regex: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g,
        severity: 'critical',
        message: 'Private keys provide authentication as the entity. Never commit these.',
        fix: 'Use SSH agent or key management services.'
    },
    opensshKey: {
        name: 'OpenSSH Private Key',
        regex: /-----BEGIN OPENSSH PRIVATE KEY-----/g,
        severity: 'critical',
        message: 'SSH private keys allow server access. Use ssh-agent.',
        fix: 'Add key to ssh-agent and use certificate authentication.'
    },
    
    // Stripe
    stripeSecret: {
        name: 'Stripe Secret Key',
        regex: /\b(?:sk|pk)_(?:test|live)_[0-9a-zA-Z]{24,}\b/g,
        severity: 'critical',
        message: 'Stripe secret keys allow full access to payment processing.',
        fix: 'Use Stripe webhook signatures and limited API keys.'
    },
    
    // GitHub
    githubToken: {
        name: 'GitHub Token',
        regex: /\b(?:gh[pousr]|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,255}\b/g,
        severity: 'critical',
        message: 'GitHub tokens provide access to repositories and organizations.',
        fix: 'Use GitHub Fine-Grained Personal Access Tokens with limited scope.'
    },
    
    // Database
    postgresUrl: {
        name: 'PostgreSQL Connection',
        regex: /postgres(?:ql)?:\/\/[^\s"'<>]+/gi,
        severity: 'high',
        message: 'Database URLs contain credentials. Use connection pooling services.',
        fix: 'Use environment variables and database connection managers.'
    },
    mysqlUrl: {
        name: 'MySQL Connection',
        regex: /mysql:\/\/[^\s"'<>]+/gi,
        severity: 'high',
        message: 'MySQL credentials provide direct database access.',
        fix: 'Use ORM with connection pooling and environment variables.'
    },
    mongoUrl: {
        name: 'MongoDB Connection',
        regex: /mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi,
        severity: 'high',
        message: 'MongoDB connection strings include authentication.',
        fix: 'Use MongoDB Atlas secrets management or environment variables.'
    },
    redisUrl: {
        name: 'Redis Connection',
        regex: /redis:\/\/[^\s"'<>]+/gi,
        severity: 'high',
        message: 'Redis credentials allow cache and data access.',
        fix: 'Use Redis ACLs and TLS connections.'
    },
    
    // URLs with credentials
    urlWithAuth: {
        name: 'URL with Embedded Credentials',
        regex: /https?:\/\/[^\s"'<>]+:[^\s"'<>]+@/gi,
        severity: 'high',
        message: 'URLs with credentials expose secrets in logs and history.',
        fix: 'Use Authorization header or query parameters with proper encoding.'
    },
    
    // Twilio
    twilioKey: {
        name: 'Twilio API Key',
        regex: /\bSK[0-9a-f]{32}\b/g,
        severity: 'high',
        message: 'Twilio API keys allow sending SMS and making phone calls.',
        fix: 'Restrict API key permissions in Twilio Console.'
    },
    twilioSid: {
        name: 'Twilio Account SID',
        regex: /\bAC[0-9a-f]{32}\b/g,
        severity: 'medium',
        message: 'Account SID identifies your Twilio account.',
        fix: 'Combine with auth token for authentication.'
    },
    
    // Email services
    sendgridKey: {
        name: 'SendGrid API Key',
        regex: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g,
        severity: 'critical',
        message: 'SendGrid keys allow sending emails from your account.',
        fix: 'Use restricted API keys with limited email sender permissions.'
    },
    mailgunKey: {
        name: 'Mailgun API Key',
        regex: /\bkey-[0-9A-Za-z]{32}\b/g,
        severity: 'high',
        message: 'Mailgun keys allow sending emails.',
        fix: 'Use Mailgun webhooks for inbound, restricted keys for outbound.'
    },
    mailchimpKey: {
        name: 'Mailchimp API Key',
        regex: /[0-9a-f]{32}-us[0-9]{1,2}/g,
        severity: 'high',
        message: 'Mailchimp keys provide access to your mailing lists.',
        fix: 'Use Mailchimp API keys with limited permissions.'
    },
    
    // OpenAI
    openaiKey: {
        name: 'OpenAI API Key',
        regex: /sk-[A-Za-z0-9]{48,}/g,
        severity: 'high',
        message: 'OpenAI API keys incur usage charges and access AI models.',
        fix: 'Set usage limits in OpenAI dashboard and monitor usage.'
    },
    
    // Generic secrets
    genericApiKey: {
        name: 'Generic API Key',
        regex: /(?:api[_-]?key|apikey|api[_-]?secret)[a-zA-Z0-9_]*\s*[:=]\s*["']([^"'\s]{16,})["']/gi,
        matchGroup: 1,
        severity: 'medium',
        message: 'Generic API keys should be stored securely.',
        fix: 'Use environment variables or secrets management services.'
    },
    genericSecret: {
        name: 'Generic Secret',
        regex: /(?:secret|password|passwd|pwd|token|auth[_-]?token|access[_-]?token|client[_-]?secret)[a-zA-Z0-9_]*\s*[:=]\s*["']([^"'\s]{8,})["']/gi,
        matchGroup: 1,
        severity: 'medium',
        message: 'Passwords and secrets should never be hardcoded.',
        fix: 'Use environment variables or OAuth flows.'
    },
    
    // Docker
    dockerHubToken: {
        name: 'Docker Hub Token',
        regex: /\b[dhu][A-Za-z0-9_]{58,}\b/g,
        severity: 'high',
        message: 'Docker Hub tokens allow image pulls and pushes.',
        fix: 'Use scoped tokens with limited repository access.'
    },
    
    // Square
    squareToken: {
        name: 'Square Access Token',
        regex: /\bsq0atp-[0-9A-Za-z-_]{22}\b/g,
        severity: 'critical',
        message: 'Square tokens provide payment processing access.',
        fix: 'Use OAuth with limited permissions in Square Dashboard.'
    },
    
    // Shopify
    shopifyToken: {
        name: 'Shopify Access Token',
        regex: /shpat_[a-fA-F0-9]{32}/g,
        severity: 'critical',
        message: 'Shopify tokens provide access to store data and orders.',
        fix: 'Use Shopify API keys with specific OAuth scopes.'
    }
};

// ============================================================================
// FALSE POSITIVE PATTERNS
// ============================================================================

const FALSE_POSITIVES = [
    /example/i,
    /sample/i,
    /test/i,
    /placeholder/i,
    /dummy/i,
    /mock/i,
    /fake/i,
    /xxx/i,
    /0000/i,
    /1234/i,
    /replace[_-]?me/i,
    /your[_-]?key/i,
    /your[_-]?secret/i,
    /your[_-]?password/i,
    /changeme/i,
    /default/i,
    /localhost/i,
    /127\.0\.0\.1/i,
    /process\.env/i,
    /\$\{/,
    /%\{/,
    /undefined/i,
    /null/i
];

// ============================================================================
// ENTROPY CALCULATION
// ============================================================================

export function calculateEntropy(str) {
    const len = str.length;
    if (len === 0) return 0;
    
    const frequencies = {};
    for (let i = 0; i < len; i++) {
        const char = str[i];
        frequencies[char] = (frequencies[char] || 0) + 1;
    }
    
    return Object.values(frequencies).reduce((sum, count) => {
        const p = count / len;
        return sum - (p * Math.log2(p));
    }, 0);
}

// ============================================================================
// AST-BASED PARSING FOR JS/TS
// ============================================================================

export class JSASTParser {
    constructor() {
        this.stringLiterals = [];
        this.templateLiterals = [];
        this.concatenatedStrings = [];
    }
    
    parse(content) {
        // Remove comments first
        const cleanedContent = this.removeComments(content);
        
        // Extract all string literals
        this.extractStrings(cleanedContent);
        
        // Detect concatenations
        this.detectConcatenations(cleanedContent);
        
        // Detect template literals
        this.detectTemplateLiterals(content);
        
        return {
            strings: this.stringLiterals,
            templates: this.templateLiterals,
            concatenations: this.concatenatedStrings
        };
    }
    
    removeComments(content) {
        content = content.replace(/\/\/.*$/gm, '');
        content = content.replace(/\/\*[\s\S]*?\*\//g, '');
        return content;
    }
    
    extractStrings(content) {
        const patterns = [
            /"(?:[^"\\]|\\.)*"/g,
            /'(?:[^'\\]|\\.)*'/g,
            /`(?:[^`\\]|\\.)*`/g
        ];
        
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const raw = match[0];
                const value = this.normalizeString(raw);
                
                this.stringLiterals.push({
                    raw,
                    value,
                    index: match.index,
                    isTemplate: raw.startsWith('`')
                });
            }
        }
    }
    
    normalizeString(raw) {
        let value = raw.slice(1, -1);
        value = value.replace(/\\n/g, '\n')
                     .replace(/\\t/g, '\t')
                     .replace(/\\r/g, '\r')
                     .replace(/\\\\/g, '\\')
                     .replace(/\\'/g, "'")
                     .replace(/\\"/g, '"');
        value = value.replace(/\$\{[^}]*\}/g, '');
        return value;
    }
    
    detectConcatenations(content) {
        const concatPattern = /["']\s*\+\s*["']/g;
        let match;
        while ((match = concatPattern.exec(content)) !== null) {
            const lines = content.substring(0, match.index).split('\n');
            const lineNum = lines.length;
            const line = lines[lineNum - 1] || '';
            
            this.concatenatedStrings.push({
                line: lineNum,
                content: line.trim(),
                index: match.index
            });
        }
    }
    
    detectTemplateLiterals(content) {
        const templatePattern = /`(?:[^`\\]|\\.)*`/g;
        let match;
        while ((match = templatePattern.exec(content)) !== null) {
            const raw = match[0];
            
            if (raw.includes('${')) {
                const lines = content.substring(0, match.index).split('\n');
                const lineNum = lines.length;
                
                this.templateLiterals.push({
                    raw,
                    value: this.normalizeString(raw),
                    line: lineNum,
                    hasExpressions: true
                });
            }
        }
    }
}

// ============================================================================
// BYPASS TECHNIQUE DETECTION
// ============================================================================

export class BypassDetector {
    constructor() {
        this.techniques = [];
    }
    
    detect(content) {
        this.techniques = [];
        this.detectBase64(content);
        this.detectHexEncoding(content);
        this.detectReversedStrings(content);
        this.detectZeroWidthChars(content);
        return this.techniques;
    }
    
    detectBase64(content) {
        const base64Pattern = /\b[A-Za-z0-9+/]{20,}={0,2}\b/g;
        let match;
        while ((match = base64Pattern.exec(content)) !== null) {
            if (this.isLikelyBase64(match[0])) {
                this.techniques.push({
                    type: 'base64_encoding',
                    match: match[0].substring(0, 20) + '...',
                    message: 'Base64 encoded string detected. Decoded value may contain secrets.'
                });
            }
        }
    }
    
    isLikelyBase64(str) {
        if (str.length % 4 !== 0) return false;
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(str)) return false;
        try {
            const decoded = Buffer.from(str, 'base64').toString('utf8');
            return decoded.length > 4 && /[a-zA-Z]/.test(decoded) && /[0-9]/.test(decoded);
        } catch {
            return false;
        }
    }
    
    detectHexEncoding(content) {
        const hexPattern = /\b[0-9a-fA-F]{20,}\b/g;
        let match;
        while ((match = hexPattern.exec(content)) !== null) {
            if (/^[0-9a-fA-F]{40,}$/.test(match[0])) {
                this.techniques.push({
                    type: 'hex_encoding',
                    match: match[0].substring(0, 20) + '...',
                    message: 'Hex-encoded string detected. May contain obfuscated secrets.'
                });
            }
        }
    }
    
    detectReversedStrings(content) {
        if (/\.split\(['"]\1['"]\)\.reverse\(\)\.join\(['"]\1['"]\)/.test(content)) {
            this.techniques.push({
                type: 'reversed_strings',
                match: 'String reversal pattern detected',
                message: 'Code contains string reversal. Reversed strings may contain secrets.'
            });
        }
    }
    
    detectZeroWidthChars(content) {
        const zeroWidthPattern = /[\u200B-\u200F\u2028-\u2029\uFEFF]/;
        if (zeroWidthPattern.test(content)) {
            this.techniques.push({
                type: 'zero_width_chars',
                match: 'Zero-width character detected',
                message: 'Zero-width Unicode characters may be used to obfuscate secrets.'
            });
        }
    }
}

// ============================================================================
// MAIN DETECTOR CLASS
// ============================================================================

export class SecretDetector {
    constructor(options = {}) {
        this.config = { ...CONFIG, ...options };
        this.astParser = new JSASTParser();
        this.bypassDetector = new BypassDetector();
        this.cache = new Map();
    }
    
    scan(content, filePath, ignoreManager = null) {
        const findings = [];
        const fileExt = path.extname(filePath).toLowerCase();
        
        if (content.length > this.config.maxFileSize) {
            return [{
                type: 'FILE_TOO_LARGE',
                severity: 'info',
                message: 'File exceeds maximum size',
                file: filePath,
                line: 1,
                fix: 'Consider splitting into smaller files.'
            }];
        }
        
        const cacheKey = this.getCacheKey(content, filePath);
        if (this.config.enableCache && this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        // AST parsing for JS/TS files
        if (this.config.astExtensions.includes(fileExt)) {
            const astResult = this.astParser.parse(content);
            findings.push(...this.analyzeAST(astResult, filePath));
        }
        
        // Regex patterns
        findings.push(...this.scanWithPatterns(content, filePath, ignoreManager));
        
        // Bypass techniques
        const bypassFindings = this.bypassDetector.detect(content);
        findings.push(...bypassFindings.map(b => ({
            type: `BYPASS_${b.type.toUpperCase()}`,
            severity: 'low',
            message: b.message,
            match: b.match,
            file: filePath,
            line: 1,
            fix: 'Review code for potential secret obfuscation.'
        })));
        
        if (this.config.enableCache) {
            this.cache.set(cacheKey, findings);
        }
        
        return findings;
    }
    
    scanWithPatterns(content, filePath, ignoreManager) {
        const findings = [];
        const lines = content.split('\n');
        
        for (const [key, pattern] of Object.entries(PATTERNS)) {
            const regex = new RegExp(pattern.regex);
            let match;
            
            while ((match = regex.exec(content)) !== null) {
                const fullMatch = match[0];
                const capturedValue = pattern.matchGroup ? match[pattern.matchGroup] : fullMatch;
                
                if (this.isFalsePositive(capturedValue)) continue;
                
                const linesBefore = content.substring(0, match.index).split('\n');
                const lineNum = linesBefore.length;
                const lineContent = lines[lineNum - 1] || '';
                
                findings.push({
                    type: pattern.name,
                    severity: pattern.severity,
                    message: pattern.message,
                    match: capturedValue.length > 30 ? capturedValue.substring(0, 30) + '...' : capturedValue,
                    file: filePath,
                    line: lineNum,
                    content: lineContent.trim(),
                    fix: pattern.fix
                });
            }
        }
        
        return findings;
    }
    
    analyzeAST(astResult, filePath) {
        const findings = [];
        
        for (const concat of astResult.concatenations) {
            findings.push({
                type: 'STRING_CONCATENATION',
                severity: 'medium',
                message: 'String concatenation detected. Secrets may be split across lines.',
                file: filePath,
                line: concat.line,
                content: concat.content,
                fix: 'Use template literals or environment variables.'
            });
        }
        
        for (const template of astResult.templates) {
            findings.push({
                type: 'DYNAMIC_TEMPLATE',
                severity: 'low',
                message: 'Template literal with dynamic expressions.',
                file: filePath,
                line: template.line,
                match: template.value.substring(0, 30) + '...',
                fix: 'Ensure template expressions use only safe variables.'
            });
        }
        
        for (const str of astResult.strings) {
            if (str.value.length < this.config.minSecretLength) continue;
            if (this.isFalsePositive(str.value)) continue;
            
            const entropy = calculateEntropy(str.value);
            if (entropy > this.config.entropyThreshold) {
                findings.push({
                    type: 'HIGH_ENTROPY_STRING',
                    severity: 'medium',
                    message: 'High entropy string detected. May be a secret.',
                    file: filePath,
                    line: 1,
                    match: str.value.substring(0, 30) + '...',
                    fix: 'Verify this is not a secret.'
                });
            }
        }
        
        return findings;
    }
    
    calculateRiskScore(findings) {
        let score = 0;
        for (const finding of findings) {
            score += this.config.severityWeights[finding.severity] || 0;
        }
        return score;
    }
    
    getCacheKey(content, filePath) {
        const hash = crypto.createHash('sha256');
        hash.update(content + filePath);
        return hash.digest('hex');
    }
    
    isFalsePositive(value) {
        if (!value || typeof value !== 'string') return true;
        if (value.length < this.config.minSecretLength) return true;
        if (value.includes('PROCESS.ENV') || value.includes('process.env')) return true;
        if (value.startsWith('${') || value.startsWith('%{')) return true;
        
        for (const pattern of FALSE_POSITIVES) {
            if (pattern.test(value)) return true;
        }
        
        return false;
    }
}

// ============================================================================
// BINARY FILE DETECTION
// ============================================================================

export function isBinary(filePath) {
    const binaryExtensions = [
        '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.exe', '.bin',
        '.node', '.dll', '.so', '.dylib', '.zip', '.tar', '.gz',
        '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.wav'
    ];
    return binaryExtensions.includes(path.extname(filePath).toLowerCase());
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

export function getPatterns() {
    return Object.entries(PATTERNS).map(([key, p]) => ({
        id: key,
        name: p.name,
        severity: p.severity
    }));
}

export function updateConfig(newConfig) {
    Object.assign(CONFIG, newConfig);
}
