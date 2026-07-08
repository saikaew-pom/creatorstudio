export class AiError extends Error {
  constructor(
    message: string,
    public code: "provider" | "schema" | "auth" | "quota",
    public detail?: unknown
  ) {
    super(message);
  }
}
