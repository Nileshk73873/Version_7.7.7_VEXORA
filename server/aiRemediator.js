/**
 * aiRemediator.js
 * Calls the Google Gemini API to generate developer-friendly
 * remediation guidance for each detected vulnerability.
 */

require('dotenv').config();
const axios  = require('axios');
const logger = require('./utils/logger');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL   = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Builds a structured prompt for a given vulnerability finding.
 * @param {object} finding
 * @returns {string}
 */
function buildPrompt(finding) {
  return `You are a senior web security engineer providing remediation guidance.

A vulnerability scan detected the following issue:

Vulnerability: ${finding.name} (${finding.cwe || 'N/A'})
OWASP Category: ${finding.owasp || 'N/A'}
Severity: ${finding.severity}
CVSS Score: ${finding.cvss || 'N/A'}
Evidence: ${finding.evidence || 'Detected via automated scanning'}
Description: ${finding.description}

Provide remediation guidance for a developer who may not be a security expert.

Return ONLY a valid JSON object with this exact structure (no markdown, no code fences):
{
  "explanation": "2-3 sentence plain English explanation of why this is dangerous",
  "steps": ["step 1", "step 2", "step 3"],
  "code_fix": "copy-pasteable code snippet (most relevant language: Node.js/Express, Python/Flask, PHP, Apache config, Nginx config, or HTML as appropriate)",
  "code_language": "nodejs|python|php|nginx|apache|html|generic",
  "prevention": ["best practice 1", "best practice 2", "best practice 3"]
}`;
}

/**
 * Calls Gemini API for a single finding.
 * @param {object} finding
 * @returns {Promise<object|null>} Parsed remediation object or null on failure
 */
async function remediateFinding(finding) {
  if (!GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY not set — skipping AI remediation');
    return null;
  }

  const prompt = buildPrompt(finding);

  try {
    const response = await axios.post(
      `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature:     0.3,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      },
      { timeout: 20000 }
    );

    const raw = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) throw new Error('Empty response from Gemini');

    // Strip markdown fences if present (fallback)
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed  = JSON.parse(cleaned);

    const usageMetadata = response.data?.usageMetadata || {};

    return {
      explanation:        parsed.explanation        || null,
      steps:              Array.isArray(parsed.steps) ? parsed.steps : [],
      code_fix:           parsed.code_fix           || null,
      code_language:      parsed.code_language      || 'generic',
      prevention:         Array.isArray(parsed.prevention) ? parsed.prevention : [],
      ai_model:           GEMINI_MODEL,
      prompt_tokens:      usageMetadata.promptTokenCount      || null,
      completion_tokens:  usageMetadata.candidatesTokenCount  || null,
    };

  } catch (err) {
    logger.error('AI remediation failed', { finding: finding.id, error: err.message });
    return null;
  }
}

/**
 * Generates AI remediation for all HIGH and CRITICAL findings (batched).
 * @param {object[]} findings
 * @returns {Promise<Map<string, object>>} Map of finding.id → remediation
 */
async function generateRemediations(findings) {
  const remediations = new Map();
  const targets      = findings.filter(f => f.found && ['CRITICAL', 'HIGH', 'MEDIUM'].includes(f.severity));

  logger.info(`Generating AI remediation for ${targets.length} findings…`);

  // Process sequentially to respect rate limits
  for (const finding of targets) {
    const result = await remediateFinding(finding);
    if (result) {
      remediations.set(finding.id, result);
    }
    // Small delay between calls to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  logger.info(`AI remediation complete — ${remediations.size}/${targets.length} successful`);
  return remediations;
}

module.exports = { generateRemediations, remediateFinding };
