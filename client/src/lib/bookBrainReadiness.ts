export type BrainStepState = "complete" | "active" | "pending";

/**
 * V2.1 product rule: a book can be read immediately after extraction.
 * Deep Book Brain work is a progressive enhancement, never a gate.
 */
export function isReadyToRead(uploadCompleted: boolean) {
  return uploadCompleted;
}

export function getBrainStepState(passCompleted: number, index: number): BrainStepState {
  if (index < passCompleted) return "complete";
  if (index === passCompleted && passCompleted < 4) return "active";
  return "pending";
}

export function isBookBrainComplete(passCompleted: number) {
  return passCompleted >= 4;
}
