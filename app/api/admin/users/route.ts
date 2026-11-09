import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { authorizeAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type CreateUserBody = {
  email?: unknown;
  password?: unknown;
  maxAliases?: unknown;
};

type AliasLimit = {
  user_id: string;
  max_aliases: number;
};

type AliasOwner = {
  user_id: string;
};

function unauthorized(status: 401 | 403, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function formatUser(user: User, limits: Map<string, number>, counts: Map<string, number>) {
  const maxAliases = limits.get(user.id) ?? null;
  const aliasesUsed = counts.get(user.id) ?? 0;

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: user.user_metadata?.display_name ?? null,
    emailConfirmed: Boolean(user.email_confirmed_at),
    createdAt: user.created_at,
    maxAliases,
    aliasesUsed,
    aliasesRemaining: maxAliases === null ? null : Math.max(maxAliases - aliasesUsed, 0)
  };
}

async function listAllAuthUsers(admin: Awaited<ReturnType<typeof authorizeAdmin>> & { authorized: true }) {
  const users: User[] = [];

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.admin.auth.admin.listUsers({ page, perPage: 1000 });

    if (error) {
      throw error;
    }

    users.push(...data.users);

    if (data.users.length < 1000) {
      break;
    }
  }

  return users;
}

async function listAllAliasOwners(admin: Awaited<ReturnType<typeof authorizeAdmin>> & { authorized: true }) {
  const owners: AliasOwner[] = [];

  for (let from = 0; from < 100000; from += 1000) {
    const { data, error } = await admin.admin
      .from("aliases")
      .select("user_id")
      .range(from, from + 999);

    if (error) {
      throw error;
    }

    const page = (data ?? []) as AliasOwner[];
    owners.push(...page);

    if (page.length < 1000) {
      break;
    }
  }

  return owners;
}

export async function GET(request: Request) {
  const authorization = await authorizeAdmin(request);

  if (!authorization.authorized) {
    return unauthorized(authorization.status, authorization.message);
  }

  try {
    const [users, limitsResult, aliases] = await Promise.all([
      listAllAuthUsers(authorization),
      authorization.admin.from("user_alias_limits").select("user_id,max_aliases"),
      listAllAliasOwners(authorization)
    ]);

    if (limitsResult.error) {
      throw limitsResult.error;
    }

    const limits = new Map(
      ((limitsResult.data ?? []) as AliasLimit[]).map((limit) => [limit.user_id, limit.max_aliases])
    );
    const counts = aliases.reduce((map, alias) => {
      map.set(alias.user_id, (map.get(alias.user_id) ?? 0) + 1);
      return map;
    }, new Map<string, number>());

    return NextResponse.json({
      users: users
        .map((user) => formatUser(user, limits, counts))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    });
  } catch (error) {
    console.error("Could not load admin users", error);
    return NextResponse.json({ error: "Could not load user accounts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeAdmin(request);

  if (!authorization.authorized) {
    return unauthorized(authorization.status, authorization.message);
  }

  let body: CreateUserBody;

  try {
    body = (await request.json()) as CreateUserBody;
  } catch {
    return NextResponse.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const maxAliases = typeof body.maxAliases === "number" ? body.maxAliases : Number(body.maxAliases);

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: "Password must be between 8 and 128 characters." }, { status: 400 });
  }

  if (!Number.isSafeInteger(maxAliases) || maxAliases < 1 || maxAliases > 100000) {
    return NextResponse.json({ error: "Alias limit must be a whole number between 1 and 100,000." }, { status: 400 });
  }

  const displayName = email.split("@")[0];
  const { data, error: createError } = await authorization.admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName }
  });

  if (createError || !data.user) {
    const duplicate = createError?.message.toLowerCase().includes("already") ?? false;
    return NextResponse.json(
      { error: duplicate ? "An account with this email already exists." : createError?.message ?? "Could not create account." },
      { status: duplicate ? 409 : 400 }
    );
  }

  const user = data.user;
  const { error: limitError } = await authorization.admin.from("user_alias_limits").insert({
    user_id: user.id,
    max_aliases: maxAliases
  });

  if (limitError) {
    const { error: rollbackError } = await authorization.admin.auth.admin.deleteUser(user.id);
    if (rollbackError) {
      console.error("Could not roll back user after quota failure", rollbackError);
    }
    console.error("Could not assign alias quota", limitError);
    return NextResponse.json({ error: "The account could not be assigned an alias limit." }, { status: 500 });
  }

  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email ?? email,
        displayName,
        emailConfirmed: Boolean(user.email_confirmed_at),
        createdAt: user.created_at,
        maxAliases,
        aliasesUsed: 0,
        aliasesRemaining: maxAliases
      }
    },
    { status: 201 }
  );
}
