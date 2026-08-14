export const MATERIAL_TYPES = [
  "book",
  "textbook",
  "lecture_notes",
  "slides",
  "research_paper",
  "school_material",
  "business_report",
  "document",
] as const;

export type MaterialType = (typeof MATERIAL_TYPES)[number];

export const MATERIAL_FILE_TYPES = ["pdf", "docx", "pptx", "txt", "markdown"] as const;
export type MaterialFileType = (typeof MATERIAL_FILE_TYPES)[number];

export const MATERIAL_UNIT_TYPES = ["page", "slide", "section"] as const;
export type MaterialUnitType = (typeof MATERIAL_UNIT_TYPES)[number];

export const MATERIAL_PROCESSING_STATES = [
  "uploaded",
  "ready",
  "processing",
  "complete",
  "paused",
  "failed",
] as const;
export type MaterialProcessingState = (typeof MATERIAL_PROCESSING_STATES)[number];

export const LEARNER_MASTERY_STATES = ["new", "learning", "familiar", "strong"] as const;
export type LearnerMasteryState = (typeof LEARNER_MASTERY_STATES)[number];

export type SourceRef = {
  unitType: MaterialUnitType;
  unitIndex: number;
  page?: number;
  slide?: number;
  section?: number;
  headingPath?: string[];
  startOffset?: number;
  endOffset?: number;
};

export type MaterialEvidence = {
  source: SourceRef;
  excerpt: string;
};

export type NormalizedMaterialUnit = {
  index: number;
  type: MaterialUnitType;
  title?: string | null;
  text: string;
  sourceRef: SourceRef;
  headings: string[];
};

export type NormalizedMaterial = {
  title: string;
  source?: string | null;
  materialType: MaterialType;
  fileType: MaterialFileType;
  mimeType: string;
  units: NormalizedMaterialUnit[];
  metadata: Record<string, unknown>;
};
