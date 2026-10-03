interface ServiceErrorLike {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

function isServiceErrorLike(value: unknown): value is ServiceErrorLike {
  if (
    typeof value !== "object" ||
    value === null ||
    !("message" in value) ||
    typeof value.message !== "string"
  ) {
    return false;
  }

  return (
    (!("code" in value) || typeof value.code === "string") &&
    (!("details" in value) ||
      value.details === undefined ||
      value.details === null ||
      typeof value.details === "string") &&
    (!("hint" in value) ||
      value.hint === undefined ||
      value.hint === null ||
      typeof value.hint === "string")
  );
}

export function formatServiceError(error: unknown, fallback: string): string {
  if (!isServiceErrorLike(error)) {
    const message = error instanceof Error ? error.message : String(error);
    return `${fallback}: ${message}`;
  }

  const parts = [error.code ? `${fallback} (${error.code})` : fallback, error.message];
  if (error.details) parts.push(`Details: ${error.details}`);
  if (error.hint) parts.push(`Hint: ${error.hint}`);
  return parts.join(" — ");
}
