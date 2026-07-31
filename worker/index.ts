import PostalMime from "postal-mime";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

type EmailMessage = {
  from: string;
  to: string;
  raw: ReadableStream<Uint8Array>;
};

type ParsedAddress = {
  address?: string;
  name?: string;
};

const ALIAS_DOMAIN = "switdb.com";

export default {
  async email(message: EmailMessage, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(captureMessage(message, env));
  }
};

async function captureMessage(message: EmailMessage, env: Env) {
  const parsed = await PostalMime.parse(message.raw);
  const headers = normalizeHeaders(parsed.headers);
  const toAddress = findAliasAddress(message.to, parsed.to as ParsedAddress[] | undefined);
  const prefix = extractPrefix(toAddress);

  if (!prefix) {
    console.log(`Dropped email without ${ALIAS_DOMAIN} recipient`, { envelopeTo: message.to });
    return;
  }

  const alias = await findAlias(prefix, env);

  if (!alias) {
    console.log("Dropped email for unclaimed alias", { prefix, toAddress });
    return;
  }

  await insertMessage(
    {
      alias_id: alias.id,
      to_address: toAddress || null,
      from_address: parsed.from?.address || message.from || null,
      subject: parsed.subject || null,
      body_text: parsed.text || null,
      body_html: parsed.html || null,
      raw_headers: headers,
      spam_verdict: detectSpamVerdict(headers),
      spam_score: getHeader(headers, "x-spam-score") || getHeader(headers, "x-cf-spam-score"),
      received_at: new Date().toISOString()
    },
    env
  );
}

function findAliasAddress(envelopeTo: string, parsedTo?: ParsedAddress[]) {
  const candidates = [envelopeTo, ...(parsedTo || []).map((item) => item.address || "")];
  return candidates.find((address) => address.trim().toLowerCase().endsWith(`@${ALIAS_DOMAIN}`));
}

function extractPrefix(address?: string) {
  const normalized = address?.trim().toLowerCase();

  if (!normalized?.endsWith(`@${ALIAS_DOMAIN}`)) {
    return null;
  }

  const match = normalized.match(/^([^@\s]+)@[^@\s]+$/);
  return match?.[1] || null;
}

async function findAlias(prefix: string, env: Env): Promise<{ id: string } | null> {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/aliases?select=id&prefix=eq.${encodeURIComponent(prefix)}&limit=1`,
    {
      headers: supabaseHeaders(env)
    }
  );

  if (!response.ok) {
    throw new Error(`Alias lookup failed: ${response.status} ${await response.text()}`);
  }

  const rows = (await response.json()) as Array<{ id: string }>;
  return rows[0] || null;
}

async function insertMessage(
  payload: {
    alias_id: string;
    to_address: string | null;
    from_address: string | null;
    subject: string | null;
    body_text: string | null;
    body_html: string | null;
    raw_headers: Record<string, string>;
    spam_verdict: string | null;
    spam_score: string | null;
    received_at: string;
  },
  env: Env
) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/messages`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(env),
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Message insert failed: ${response.status} ${await response.text()}`);
  }
}

function supabaseHeaders(env: Env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
  };
}

function normalizeHeaders(headers?: Array<{ key?: string; value?: string }> | Map<string, string>) {
  const normalized: Record<string, string> = {};

  if (!headers) {
    return normalized;
  }

  const entries = headers instanceof Map ? Array.from(headers.entries()) : headers.map((header) => [header.key, header.value]);

  for (const [key, value] of entries) {
    if (key && value) {
      normalized[key.toLowerCase()] = value;
    }
  }

  return normalized;
}

function getHeader(headers: Record<string, string>, name: string) {
  return headers[name.toLowerCase()] || null;
}

function detectSpamVerdict(headers: Record<string, string>) {
  const candidates = [
    "x-spam-status",
    "x-spam-flag",
    "x-cf-spam",
    "x-cf-spam-verdict",
    "cf-spam-verdict",
    "x-mailchannels-spam-status"
  ];

  for (const name of candidates) {
    const value = getHeader(headers, name);

    if (value) {
      return value;
    }
  }

  return null;
}
