// Safety and content filtering service
// Detects prompt injection, malicious code, and content policy violations

export interface SafetyCheckResult {
  passed: boolean;
  findings: SafetyFinding[];
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
}

export interface SafetyFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  message: string;
  pattern?: string;
}

// Prompt injection patterns
const INJECTION_PATTERNS = [
  { pattern: /ignore\s+(all\s+)?previous\s+instructions/i, severity: 'critical' as const, message: 'Prompt injection: ignore previous instructions' },
  { pattern: /you\s+are\s+now\s+(a|an)\s+/i, severity: 'high' as const, message: 'Prompt injection: role reassignment attempt' },
  { pattern: /disregard\s+(all\s+)?prior/i, severity: 'critical' as const, message: 'Prompt injection: disregard prior context' },
  { pattern: /system\s*prompt\s*:\s*/i, severity: 'high' as const, message: 'Prompt injection: system prompt override' },
  { pattern: /\[INST\]|\[\/INST\]|<<SYS>>|<<\/SYS>>/i, severity: 'high' as const, message: 'Prompt injection: LLM instruction tags' },
  { pattern: /act\s+as\s+if\s+you\s+(have|had)\s+no\s+restrictions/i, severity: 'critical' as const, message: 'Prompt injection: restriction bypass' },
  { pattern: /pretend\s+you\s+are\s+DAN|do\s+anything\s+now/i, severity: 'critical' as const, message: 'Prompt injection: DAN jailbreak' },
  { pattern: /from\s+now\s+on\s+you\s+will/i, severity: 'high' as const, message: 'Prompt injection: behavioral override' },
];

// Malicious code patterns
const MALICIOUS_PATTERNS = [
  { pattern: /rm\s+-rf\s+\//i, severity: 'critical' as const, category: 'destructive', message: 'Destructive: recursive delete from root' },
  { pattern: /rm\s+-rf\s+~\//i, severity: 'critical' as const, category: 'destructive', message: 'Destructive: recursive delete from home' },
  { pattern: /mkfs\.|format\s+[cC]:|dd\s+if=\/dev\/zero/i, severity: 'critical' as const, category: 'destructive', message: 'Destructive: disk formatting' },
  { pattern: /:\(\)\s*\{\s*\:\|:\s*&\s*\};\s*:/i, severity: 'critical' as const, category: 'destructive', message: 'Destructive: fork bomb' },
  { pattern: /eval\s*\(\s*base64_decode/i, severity: 'high' as const, category: 'injection', message: 'Code injection: eval base64' },
  { pattern: /exec\s*\(\s*['"]\s*\/bin\/(ba)?sh/i, severity: 'high' as const, category: 'injection', message: 'Code injection: shell exec' },
  { pattern: /subprocess\.(call|run|Popen)\s*\(\s*\[.*['"]\/bin\/(ba)?sh/i, severity: 'high' as const, category: 'injection', message: 'Code injection: Python subprocess shell' },
  { pattern: /child_process\.(exec|spawn)\s*\(\s*['"]\/bin\/(ba)?sh/i, severity: 'high' as const, category: 'injection', message: 'Code injection: Node.js child process shell' },
  { pattern: /curl\s+.*\|\s*(ba)?sh/i, severity: 'high' as const, category: 'injection', message: 'Code injection: pipe to shell' },
  { pattern: /wget\s+.*\|\s*(ba)?sh/i, severity: 'high' as const, category: 'injection', message: 'Code injection: pipe to shell' },
];

// Suspicious patterns (lower severity)
const SUSPICIOUS_PATTERNS = [
  { pattern: /chmod\s+777/i, severity: 'medium' as const, category: 'permissions', message: 'Overly permissive file permissions' },
  { pattern: /chmod\s+\+s/i, severity: 'high' as const, category: 'permissions', message: 'Setuid bit applied' },
  { pattern: /\/etc\/passwd|\/etc\/shadow/i, severity: 'high' as const, category: 'access', message: 'Accessing system credential files' },
  { pattern: /private_key|secret_key|api_key\s*=\s*['"][^'"]+['"]/i, severity: 'medium' as const, category: 'secrets', message: 'Potential hardcoded secret' },
  { pattern: /crypto\s*miner|xmrig|stratum\+tcp/i, severity: 'critical' as const, category: 'malware', message: 'Cryptocurrency miner detected' },
  { pattern: /reverse\s+shell|bind\s+shell|nc\s+-e/i, severity: 'critical' as const, category: 'malware', message: 'Reverse/bind shell pattern' },
  { pattern: /\/dev\/tcp\/|ncat\s+.*-e/i, severity: 'critical' as const, category: 'malware', message: 'Network backdoor pattern' },
];

// Content policy: restricted file types
const RESTRICTED_FILES = [
  /\.env$/i,
  /\.env\.\w+$/i,
  /credentials\.json/i,
  /service-account.*\.json/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /id_ed25519/i,
];

export function runSafetyCheck(instruction: string, safetyLevel: 'strict' | 'standard' | 'permissive' = 'standard'): SafetyCheckResult {
  const findings: SafetyFinding[] = [];

  // Check for prompt injection
  for (const { pattern, severity, message } of INJECTION_PATTERNS) {
    if (pattern.test(instruction)) {
      findings.push({ severity, category: 'injection', message, pattern: pattern.source });
    }
  }

  // Check for malicious patterns (only in strict/standard mode)
  if (safetyLevel !== 'permissive') {
    for (const { pattern, severity, category, message } of MALICIOUS_PATTERNS) {
      if (pattern.test(instruction)) {
        findings.push({ severity, category, message, pattern: pattern.source });
      }
    }
  }

  // Check for suspicious patterns (only in strict mode)
  if (safetyLevel === 'strict') {
    for (const { pattern, severity, category, message } of SUSPICIOUS_PATTERNS) {
      if (pattern.test(instruction)) {
        findings.push({ severity, category, message, pattern: pattern.source });
      }
    }
  }

  // Determine risk level
  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const highCount = findings.filter(f => f.severity === 'high').length;

  let riskLevel: SafetyCheckResult['riskLevel'] = 'safe';
  if (criticalCount > 0) riskLevel = 'critical';
  else if (highCount > 0) riskLevel = 'high';
  else if (findings.length > 0) riskLevel = 'medium';

  // In strict mode, medium findings also fail
  const passed = safetyLevel === 'strict'
    ? findings.filter(f => f.severity !== 'info').length === 0
    : criticalCount === 0 && highCount === 0;

  return { passed, findings, riskLevel };
}

export function checkFileAccess(filePath: string): { allowed: boolean; reason?: string } {
  for (const pattern of RESTRICTED_FILES) {
    if (pattern.test(filePath)) {
      return { allowed: false, reason: `Access to ${filePath} is restricted (potential secret/credential file)` };
    }
  }

  // Check for path traversal
  if (filePath.includes('..') || filePath.startsWith('/')) {
    return { allowed: false, reason: 'Path traversal detected' };
  }

  return { allowed: true };
}

export function validateInstructionLength(instruction: string): { valid: boolean; error?: string } {
  if (instruction.length < 10) {
    return { valid: false, error: 'Instruction too short (minimum 10 characters)' };
  }
  if (instruction.length > 10000) {
    return { valid: false, error: 'Instruction too long (maximum 10,000 characters)' };
  }
  return { valid: true };
}
