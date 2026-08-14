/**
 * LLM Provider Abstraction
 *
 * Defines a common interface for all LLM providers so the Book Brain pipeline
 * is not tied to a single vendor. New providers can be added without touching
 * business logic.
 */

export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMRequest = {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
};

export type LLMResponse = {
  text: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
};

export interface LLMProvider {
  name: string;
  call(req: LLMRequest): Promise<LLMResponse>;
  embed(text: string): Promise<number[]>;
}

/**
 * Task types that map to different provider/model combinations.
 * This lets us route cheap tasks (chunk analysis) to fast/cheap models
 * and expensive tasks (whole-book synthesis) to stronger models.
 */
export type LLMTask =
  | "chunk_analysis"     // Analyze a 5-10 page chunk: summary, entities, concepts
  | "chapter_synthesis"  // Combine chunk analyses into a chapter summary
  | "book_synthesis"     // Combine chapter summaries into a whole-book brain
  | "material_analysis"  // Source-grounded Material Intelligence concepts and study objectives
  | "lesson_planning"    // Compact source-grounded teaching plan assembled after concepts are validated
  | "study_generation"   // Source-grounded notes, flashcards, quizzes, and lessons
  | "embedding"          // Generate an embedding vector for a text
  | "reading_buddy"      // Answer a live reading question
  | "reading_buddy_hard" // Fallback for complex reading questions
