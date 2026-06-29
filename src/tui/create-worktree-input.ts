export type CreateFocusField = "branch" | "source" | "focus";

export const DEFAULT_CREATE_SOURCE_BASE = "origin/main";

export function resolveCreateSourceBase(input: string): string | undefined {
  const base = input.trim();
  return base.length > 0 ? base : undefined;
}

export function formatCreateSourceBase(input: string, fallbackBase: string | undefined): string {
  return resolveCreateSourceBase(input) ?? fallbackBase ?? DEFAULT_CREATE_SOURCE_BASE;
}

export function createSourceBaseOption(input: string, fallbackBase: string | undefined): { readonly base: string } {
  return { base: formatCreateSourceBase(input, fallbackBase) };
}

export function nextCreateFocusField(field: CreateFocusField): CreateFocusField {
  switch (field) {
    case "branch":
      return "source";
    case "source":
      return "focus";
    case "focus":
      return "branch";
  }
  const exhaustive: never = field;
  return exhaustive;
}
