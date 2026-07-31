export function normalizePrefix(value: string) {
  return value.trim().toLowerCase();
}

export function validatePrefix(value: string) {
  const prefix = normalizePrefix(value);

  if (!/^[a-z0-9][a-z0-9._-]{1,62}[a-z0-9]$/.test(prefix)) {
    return {
      prefix,
      error:
        "Use 3-64 lowercase letters, numbers, dots, underscores, or hyphens. Start and end with a letter or number."
    };
  }

  if (prefix.includes("..")) {
    return { prefix, error: "Prefixes cannot contain consecutive dots." };
  }

  return { prefix, error: null };
}
