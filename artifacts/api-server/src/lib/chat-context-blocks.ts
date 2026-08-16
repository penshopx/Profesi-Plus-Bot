/**
 * Canonical priority table for the chat message-handler's 8 context blocks.
 *
 * Exporting this keeps the test honest: any priority or slot change in the
 * production code is automatically reflected in the integration tests because
 * both import the same function.
 */

import type { ContextBlock } from "./context-budget";

export interface ChatContextInputs {
  profileContext: string;
  competencyContext: string;
  quizContext: string;
  watchedModulesContext: string;
  kegiatanContext: string;
  knowledgeContext: string;
  projectBrainContext: string;
  historicalPKBContext: string;
}

/**
 * Assembles the 8 context blocks with their canonical priorities exactly as the
 * chat message handler passes them to `applySharedContextBudget`.
 *
 * Priority legend (higher = preserved first when budget is tight):
 *   7 profile | 6 competency | 5 quiz | 4.5 watchedModules
 *   4 kegiatan | 3 knowledge | 2 projectBrain | 1 historical
 */
export function buildChatContextBlocks(inputs: ChatContextInputs): ContextBlock[] {
  return [
    { content: inputs.profileContext,        priority: 7   },
    { content: inputs.competencyContext,     priority: 6   },
    { content: inputs.quizContext,           priority: 5   },
    { content: inputs.watchedModulesContext, priority: 4.5 },
    { content: inputs.kegiatanContext,       priority: 4   },
    { content: inputs.knowledgeContext,      priority: 3   },
    { content: inputs.projectBrainContext,   priority: 2   },
    { content: inputs.historicalPKBContext,  priority: 1   },
  ];
}

export interface ExumContextInputs extends ChatContextInputs {
  /** Approved outline blueprint — highest priority: it drives document structure. */
  outlineContext: string;
}

/**
 * Assembles the Exum generator's 9 context blocks (approved outline + the same
 * 8 blocks as chat) with their canonical priorities exactly as the
 * /chat/generate-exum handler passes them to `applySharedContextBudget`.
 *
 * Priority legend (higher = preserved first when budget is tight):
 *   8 outline | 7 profile | 6 competency | 5 quiz | 4.5 watchedModules
 *   4 kegiatan | 3 knowledge | 2 projectBrain | 1 historical
 */
export function buildExumContextBlocks(inputs: ExumContextInputs): ContextBlock[] {
  return [
    { content: inputs.outlineContext, priority: 8 },
    ...buildChatContextBlocks(inputs),
  ];
}
