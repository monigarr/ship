/**
 * @version 0.1.0
 * @date 2026-05-25
 * @author Monica Peters <monica.peters@gfachallenger.gauntletai.com>
 *
 * Purpose: Optional LLM synthesis for FleetGraph on-demand runs when detectors surface signals.
 *
 * Usage: Called from runtime.executeFleetGraphRun for on_demand trigger with user prompt.
 *
 * Example:
 *   const result = await synthesizeFleetGraphResponse({ prompt, signals, contextLabel });
 *
 * Dependencies: AWS Bedrock (Claude via BedrockRuntimeClient), same model path as ai-analysis.
 *
 * Security/PHI: Scoped to user-visible signal summaries only.
 * HIPAA: N/A — no PHI.
 * FHIR: N/A — not interoperability.
 * Accessibility: N/A — non-UI.
 * Performance: Skipped when Bedrock unavailable; bounded max_tokens.
 * Stability: Falls back to deterministic summary on failure.
 * Legal/compliance: N/A.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { FleetGraphContext, FleetGraphSignal } from './types.js';

const MODEL_ID = 'global.anthropic.claude-opus-4-5-20251101-v1:0';
const REGION = 'us-east-1';
const INPUT_COST_PER_1K = 0.015;
const OUTPUT_COST_PER_1K = 0.075;

let bedrockClient: BedrockRuntimeClient | null = null;
let clientInitFailed = false;

export interface FleetGraphSynthesisResult {
  summary: string;
  inputTokens: number;
  outputTokens: number;
  costEstimateUsd: number;
  billedSpendUsd: number | null;
  synthesized: boolean;
  modelId: string | null;
  tokenSource: 'actual_model_usage' | 'heuristic_estimate';
}

function synthesisEnabled(): boolean {
  if (process.env.FLEETGRAPH_SYNTHESIS_ENABLED === '0') {
    return false;
  }
  return process.env.FLEETGRAPH_SYNTHESIS_ENABLED === '1' || process.env.NODE_ENV === 'production';
}

function getClient(): BedrockRuntimeClient | null {
  if (clientInitFailed) return null;
  if (bedrockClient) return bedrockClient;
  try {
    bedrockClient = new BedrockRuntimeClient({ region: REGION });
    return bedrockClient;
  } catch {
    clientInitFailed = true;
    return null;
  }
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  return Number(
    (
      (inputTokens / 1000) * INPUT_COST_PER_1K +
      (outputTokens / 1000) * OUTPUT_COST_PER_1K
    ).toFixed(6)
  );
}

async function callBedrock(systemPrompt: string, userPrompt: string): Promise<{
  text: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
}> {
  const client = getClient();
  if (!client) {
    return { text: null, inputTokens: null, outputTokens: null };
  }

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: new TextEncoder().encode(body),
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const inputTokens = Number(responseBody?.usage?.input_tokens);
  const outputTokens = Number(responseBody?.usage?.output_tokens);
  return {
    text: responseBody.content?.[0]?.text ?? null,
    inputTokens: Number.isFinite(inputTokens) ? inputTokens : null,
    outputTokens: Number.isFinite(outputTokens) ? outputTokens : null,
  };
}

export async function synthesizeFleetGraphResponse(input: {
  prompt?: string;
  signals: FleetGraphSignal[];
  context: FleetGraphContext;
  fallbackSummary: string;
}): Promise<FleetGraphSynthesisResult> {
  const userPrompt = input.prompt?.trim() ?? '';
  if (!synthesisEnabled() || input.signals.length === 0) {
    return {
      summary: input.fallbackSummary,
      inputTokens: 0,
      outputTokens: 0,
      costEstimateUsd: 0,
      billedSpendUsd: null,
      synthesized: false,
      modelId: null,
      tokenSource: 'heuristic_estimate',
    };
  }

  const signalBrief = input.signals
    .slice(0, 5)
    .map(
      (signal, index) =>
        `${index + 1}. [${signal.type}/${signal.severity}] ${signal.title}: ${signal.summary} Evidence: ${signal.evidence.slice(0, 4).join('; ')}`
    )
    .join('\n');

  const systemPrompt = `You are FleetGraph, a project intelligence agent embedded in Ship. Answer using only the provided signals and context. Be specific, cite evidence, state uncertainty when data is missing, and recommend the next human action. Do not claim approvals or compliance passes. Keep under 120 words.`;

  const composedUserPrompt = [
    `Context: ${input.context.documentType ?? 'workspace'} ${input.context.documentId ?? 'n/a'}`,
    userPrompt ? `User question: ${userPrompt}` : 'User asked for a context summary.',
    `Detected signals:\n${signalBrief}`,
  ].join('\n\n');

  const inputTokens = estimateTokens(systemPrompt + composedUserPrompt);

  try {
    const response = await callBedrock(systemPrompt, composedUserPrompt);
    if (!response.text?.trim()) {
      return {
        summary: input.fallbackSummary,
        inputTokens,
        outputTokens: 0,
        costEstimateUsd: 0,
        billedSpendUsd: null,
        synthesized: false,
        modelId: null,
        tokenSource: 'heuristic_estimate',
      };
    }

    const outputTokens = response.outputTokens ?? estimateTokens(response.text);
    const resolvedInputTokens = response.inputTokens ?? inputTokens;
    const spendEstimateUsd = estimateCost(resolvedInputTokens, outputTokens);
    const billedSpendUsd =
      response.inputTokens !== null && response.outputTokens !== null ? spendEstimateUsd : null;
    return {
      summary: response.text.trim(),
      inputTokens: resolvedInputTokens,
      outputTokens,
      costEstimateUsd: spendEstimateUsd,
      billedSpendUsd,
      synthesized: true,
      modelId: MODEL_ID,
      tokenSource:
        response.inputTokens !== null && response.outputTokens !== null
          ? 'actual_model_usage'
          : 'heuristic_estimate',
    };
  } catch (error) {
    console.warn('FleetGraph synthesis failed:', error);
    return {
      summary: input.fallbackSummary,
      inputTokens,
      outputTokens: 0,
      costEstimateUsd: 0,
      billedSpendUsd: null,
      synthesized: false,
      modelId: null,
      tokenSource: 'heuristic_estimate',
    };
  }
}
