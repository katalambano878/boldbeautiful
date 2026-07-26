/**
 * Browser-safe Supabase-js-shaped client over same-origin shims:
 *   /rest/v1, /auth/v1, /storage/v1
 */

type Row = Record<string, unknown>;
type AuthChangeCallback = (event: string, session: Session | null) => void;

export interface AuthUser {
  id: string;
  email: string | null;
  phone?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: AuthUser;
}

interface QueryResult<T = unknown> {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number | null;
}

function trimSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

function storageKey(baseUrl: string): string {
  try {
    const host = new URL(baseUrl).hostname.replace(/\./g, "-");
    return `sb-${host}-auth-token`;
  } catch {
    return "sb-local-auth-token";
  }
}

function encodeFilterValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") return String(value);
  const s = String(value);
  if (/[,().]/.test(s)) return `"${s.replace(/"/g, '\\"')}"`;
  return s;
}

class HttpQueryBuilder implements PromiseLike<QueryResult> {
  private table: string;
  private baseUrl: string;
  private apiKey: string;
  private getAccessToken: () => string | null;

  private action: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private selectStr = "*";
  private wantCount = false;
  private headOnly = false;
  private singleMode: "none" | "single" | "maybe" = "none";
  private onConflict: string | null = null;
  private payload: Row | Row[] | null = null;
  private returnRows = false;

  private filters: Array<{ col: string; op: string; value: unknown }> = [];
  private orParts: string[] = [];
  private orders: Array<{ col: string; ascending: boolean; nullsFirst?: boolean }> = [];
  private limitN: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;

  constructor(
    table: string,
    baseUrl: string,
    apiKey: string,
    getAccessToken: () => string | null
  ) {
    this.table = table;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.getAccessToken = getAccessToken;
  }

  select(sel = "*", opts?: { count?: "exact" | "planned" | "estimated"; head?: boolean }) {
    if (this.action === "select") {
      this.selectStr = sel || "*";
    } else {
      this.returnRows = true;
      this.selectStr = sel || "*";
    }
    if (opts?.count === "exact") this.wantCount = true;
    if (opts?.head) {
      this.headOnly = true;
      this.wantCount = true;
    }
    return this;
  }

  insert(payload: Row | Row[]) {
    this.action = "insert";
    this.payload = payload;
    return this;
  }

  update(patch: Row) {
    this.action = "update";
    this.payload = patch;
    return this;
  }

  upsert(payload: Row | Row[], opts?: { onConflict?: string }) {
    this.action = "upsert";
    this.payload = payload;
    this.onConflict = opts?.onConflict ?? null;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(col: string, value: unknown) {
    return this.filter(col, "eq", value);
  }
  neq(col: string, value: unknown) {
    return this.filter(col, "neq", value);
  }
  gt(col: string, value: unknown) {
    return this.filter(col, "gt", value);
  }
  gte(col: string, value: unknown) {
    return this.filter(col, "gte", value);
  }
  lt(col: string, value: unknown) {
    return this.filter(col, "lt", value);
  }
  lte(col: string, value: unknown) {
    return this.filter(col, "lte", value);
  }
  like(col: string, value: unknown) {
    return this.filter(col, "like", value);
  }
  ilike(col: string, value: unknown) {
    return this.filter(col, "ilike", value);
  }
  is(col: string, value: unknown) {
    return this.filter(col, "is", value);
  }
  in(col: string, values: unknown[]) {
    this.filters.push({ col, op: "in", value: values });
    return this;
  }
  or(parts: string) {
    this.orParts.push(parts);
    return this;
  }
  not(col: string, op: string, value: unknown) {
    if (op === "in") {
      this.filters.push({ col, op: "not.in", value });
    } else if (op === "is") {
      this.filters.push({ col, op: "not.is", value });
    } else {
      this.filters.push({ col, op: `not.${op}`, value });
    }
    return this;
  }
  filter(col: string, op: string, value: unknown) {
    this.filters.push({ col, op, value });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({
      col,
      ascending: opts?.ascending !== false,
      nullsFirst: opts?.nullsFirst,
    });
    return this;
  }

  limit(n: number) {
    this.limitN = n;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  private buildParams(): URLSearchParams {
    const params = new URLSearchParams();
    if (this.action === "select" || this.returnRows) {
      params.set("select", this.selectStr);
    }
    for (const f of this.filters) {
      if (f.op === "in" && Array.isArray(f.value)) {
        const inner = f.value.map((v) => encodeFilterValue(v)).join(",");
        params.set(f.col, `in.(${inner})`);
      } else if (f.op === "not.in") {
        params.set(f.col, `not.in.${String(f.value)}`);
      } else if (f.op === "is") {
        params.set(f.col, f.value === null ? "is.null" : `is.${encodeFilterValue(f.value)}`);
      } else if (f.op === "not.is") {
        params.set(f.col, f.value === null ? "not.is.null" : `not.is.${encodeFilterValue(f.value)}`);
      } else {
        params.set(f.col, `${f.op}.${encodeFilterValue(f.value)}`);
      }
    }
    for (const or of this.orParts) {
      const inner = or.startsWith("(") && or.endsWith(")") ? or.slice(1, -1) : or;
      params.set("or", `(${inner})`);
    }
    if (this.orders.length) {
      params.set(
        "order",
        this.orders
          .map((o) => {
            let s = `${o.col}.${o.ascending ? "asc" : "desc"}`;
            if (o.nullsFirst === true) s += ".nullsfirst";
            else if (o.nullsFirst === false) s += ".nullslast";
            return s;
          })
          .join(",")
      );
    }
    if (this.rangeFrom !== null && this.rangeTo !== null) {
      params.set("offset", String(this.rangeFrom));
      params.set("limit", String(this.rangeTo - this.rangeFrom + 1));
    } else if (this.limitN !== null) {
      params.set("limit", String(this.limitN));
    }
    if (this.onConflict) {
      params.set("on_conflict", this.onConflict);
    }
    return params;
  }

  private headers(method: string): HeadersInit {
    const h: Record<string, string> = {
      apikey: this.apiKey,
      "Content-Type": "application/json",
    };
    const token = this.getAccessToken();
    if (token) h.Authorization = `Bearer ${token}`;

    const prefer: string[] = [];
    if (this.wantCount) prefer.push("count=exact");
    if (this.headOnly) prefer.push("head=true");
    if (this.returnRows && this.selectStr) {
      prefer.push("return=representation");
    }
    if (this.action === "upsert") {
      prefer.push("resolution=merge-duplicates");
    }
    if (prefer.length) h.Prefer = prefer.join(",");

    if (this.singleMode === "single" || this.singleMode === "maybe") {
      h.Accept = "application/vnd.pgrst.object+json";
    }

    void method;
    return h;
  }

  private parseCount(res: Response): number | null {
    const cr = res.headers.get("content-range");
    if (!cr) return null;
    const m = /\/(\d+|\*)$/.exec(cr);
    if (!m || m[1] === "*") return null;
    return parseInt(m[1], 10);
  }

  async exec(): Promise<QueryResult> {
    try {
      const params = this.buildParams();
      const qs = params.toString();
      const url = `${this.baseUrl}/rest/v1/${encodeURIComponent(this.table)}${qs ? `?${qs}` : ""}`;

      let res: Response;
      if (this.action === "select") {
        res = await fetch(url, { method: "GET", headers: this.headers("GET") });
      } else if (this.action === "insert" || this.action === "upsert") {
        res = await fetch(url, {
          method: "POST",
          headers: this.headers("POST"),
          body: JSON.stringify(this.payload),
        });
      } else if (this.action === "update") {
        res = await fetch(url, {
          method: "PATCH",
          headers: this.headers("PATCH"),
          body: JSON.stringify(this.payload),
        });
      } else {
        res = await fetch(url, { method: "DELETE", headers: this.headers("DELETE") });
      }

      const count = this.parseCount(res);
      let body: unknown = null;
      const text = await res.text();
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }

      if (!res.ok) {
        const errObj = body as { message?: string; error?: string; code?: string };
        return {
          data: null,
          error: {
            message: errObj?.message || errObj?.error || res.statusText || "Request failed",
            code: errObj?.code,
          },
          count,
        };
      }

      if (this.headOnly) {
        return { data: null, error: null, count };
      }

      let data: unknown = body;
      if (this.singleMode === "single") {
        if (data === null || data === undefined) {
          return {
            data: null,
            error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" },
            count,
          };
        }
        if (Array.isArray(data)) {
          if (data.length !== 1) {
            return {
              data: null,
              error: {
                message:
                  data.length === 0
                    ? "JSON object requested, multiple (or no) rows returned"
                    : "Results contain more than one row",
                code: data.length === 0 ? "PGRST116" : "PGRST114",
              },
              count,
            };
          }
          data = data[0];
        }
      } else if (this.singleMode === "maybe") {
        if (Array.isArray(data)) {
          if (data.length > 1) {
            return {
              data: null,
              error: { message: "Results contain more than one row", code: "PGRST116" },
              count,
            };
          }
          data = data[0] ?? null;
        }
      }

      return { data: data as QueryResult["data"], error: null, count };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { data: null, error: { message: msg }, count: null };
    }
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected);
  }
}

function createAuthApi(
  baseUrl: string,
  apiKey: string,
  storage: SessionStorageLike
) {
  const listeners = new Set<AuthChangeCallback>();

  function notify(event: string, session: Session | null) {
    for (const cb of listeners) {
      try {
        cb(event, session);
      } catch {
        /* ignore */
      }
    }
  }

  function persistSession(session: Session | null) {
    const key = storageKey(baseUrl);
    if (typeof document !== "undefined") {
      if (session?.access_token) {
        document.cookie = `sb-access-token=${encodeURIComponent(session.access_token)}; path=/; SameSite=Lax; max-age=${session.expires_in || 604800}`;
      } else {
        document.cookie = "sb-access-token=; path=/; max-age=0";
      }
    }
    if (session) {
      storage.setItem(key, JSON.stringify(session));
    } else {
      storage.removeItem(key);
    }
    notify(session ? "SIGNED_IN" : "SIGNED_OUT", session);
  }

  function readSession(): Session | null {
    const raw = storage.getItem(storageKey(baseUrl));
    if (!raw) return null;
    try {
      const session = JSON.parse(raw) as Session;
      if (session.expires_at && session.expires_at * 1000 < Date.now()) {
        persistSession(null);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  async function authFetch(path: string, init?: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      apikey: apiKey,
      ...(init?.headers as Record<string, string>),
    };
    return fetch(`${baseUrl}/auth/v1/${path}`, { ...init, headers });
  }

  return {
    async signInWithPassword(credentials: { email: string; password: string }) {
      const res = await authFetch("token?grant_type=password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          data: { user: null, session: null },
          error: { message: body.error_description || body.msg || body.message || "Login failed" },
        };
      }
      const session = body as Session;
      persistSession(session);
      return { data: { user: session.user, session }, error: null };
    },

    async signUp(opts: { email: string; password: string; options?: { data?: Record<string, unknown> } }) {
      const res = await authFetch("signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: opts.email,
          password: opts.password,
          data: opts.options?.data,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          data: { user: null, session: null },
          error: { message: body.error_description || body.msg || body.message || "Signup failed" },
        };
      }
      const session = body as Session;
      if (session.access_token) persistSession(session);
      return { data: { user: session.user, session: session.access_token ? session : null }, error: null };
    },

    async getSession() {
      const session = readSession();
      return { data: { session }, error: null };
    },

    async getUser(jwt?: string) {
      const token = jwt || readSession()?.access_token;
      if (!token) {
        return { data: { user: null }, error: { message: "No JWT provided" } };
      }
      const res = await authFetch("user", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          data: { user: null },
          error: { message: body.error_description || body.message || "Invalid JWT" },
        };
      }
      return { data: { user: body }, error: null };
    },

    async signOut() {
      await authFetch("logout", { method: "POST" }).catch(() => {});
      persistSession(null);
      return { error: null };
    },

    async updateUser(attrs: { password?: string; data?: Record<string, unknown> }) {
      const session = readSession();
      if (!session?.access_token) {
        return { data: { user: null }, error: { message: "Not authenticated" } };
      }
      const body: Record<string, unknown> = {};
      if (attrs.password) body.password = attrs.password;
      if (attrs.data) body.data = attrs.data;
      const res = await authFetch("user", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const user = await res.json().catch(() => null);
      if (!res.ok) {
        return {
          data: { user: null },
          error: { message: (user as { message?: string })?.message || "Update failed" },
        };
      }
      const next = { ...session, user };
      persistSession(next);
      return { data: { user }, error: null };
    },

    onAuthStateChange(callback: AuthChangeCallback) {
      listeners.add(callback);
      const session = readSession();
      queueMicrotask(() => callback(session ? "INITIAL_SESSION" : "INITIAL_SESSION", session));
      return {
        data: {
          subscription: {
            unsubscribe() {
              listeners.delete(callback);
            },
          },
        },
      };
    },

    admin: {
      createUser: async () => ({
        data: { user: null },
        error: { message: "auth.admin.createUser is server-only; use /api/seed-admin or supabaseAdmin" },
      }),
      listUsers: async () => ({
        data: { users: [] },
        error: { message: "auth.admin.listUsers is server-only" },
      }),
    },
  };
}

function createStorageApi(baseUrl: string, apiKey: string, getAccessToken: () => string | null) {
  const root = trimSlash(baseUrl);
  return {
    from(bucket: string) {
      return {
        async upload(
          objectPath: string,
          file: Blob | File | ArrayBuffer,
          opts?: { cacheControl?: string; upsert?: boolean; contentType?: string }
        ) {
          const clean = objectPath.replace(/^\/+/, "");
          const headers: Record<string, string> = {
            apikey: apiKey,
          };
          const token = getAccessToken();
          if (token) headers.Authorization = `Bearer ${token}`;
          if (opts?.upsert) headers["x-upsert"] = "true";
          const contentType =
            opts?.contentType ||
            (file instanceof File ? file.type : undefined) ||
            "application/octet-stream";
          headers["Content-Type"] = contentType;

          const body =
            file instanceof ArrayBuffer
              ? file
              : file instanceof Blob
              ? file
              : new Blob([file]);

          const res = await fetch(
            `${root}/storage/v1/object/${encodeURIComponent(bucket)}/${clean
              .split("/")
              .map(encodeURIComponent)
              .join("/")}`,
            { method: "POST", headers, body }
          );
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            return { data: null, error: { message: json.error || json.message || "Upload failed" } };
          }
          return { data: json, error: null };
        },
        getPublicUrl(objectPath: string) {
          const clean = objectPath.replace(/^\/+/, "");
          return {
            data: {
              publicUrl: `${root}/storage/v1/object/public/${encodeURIComponent(bucket)}/${clean
                .split("/")
                .map(encodeURIComponent)
                .join("/")}`,
            },
          };
        },
      };
    },
  };
}

interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): SessionStorageLike {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  const mem = new Map<string, string>();
  return {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      mem.set(k, v);
    },
    removeItem: (k) => {
      mem.delete(k);
    },
  };
}

export interface SupabaseHttpClient {
  from(table: string): HttpQueryBuilder;
  auth: ReturnType<typeof createAuthApi>;
  storage: ReturnType<typeof createStorageApi>;
  rpc(fn: string, args?: Record<string, unknown>): Promise<QueryResult>;
}

export function createSupabaseHttpClient(baseUrl: string, anonKey: string): SupabaseHttpClient {
  const root = trimSlash(baseUrl);
  const storage = defaultStorage();

  const getAccessToken = () => {
    try {
      const raw = storage.getItem(storageKey(root));
      if (!raw) return null;
      const session = JSON.parse(raw) as Session;
      return session.access_token || null;
    } catch {
      return null;
    }
  };

  const auth = createAuthApi(root, anonKey, storage);

  return {
    from(table: string) {
      return new HttpQueryBuilder(table, root, anonKey, getAccessToken);
    },
    auth,
    storage: createStorageApi(root, anonKey, getAccessToken),
    async rpc(fn: string, args: Record<string, unknown> = {}) {
      try {
        const headers: Record<string, string> = {
          apikey: anonKey,
          "Content-Type": "application/json",
        };
        const token = getAccessToken();
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${root}/rest/v1/rpc/${encodeURIComponent(fn)}`, {
          method: "POST",
          headers,
          body: JSON.stringify(args),
        });
        const text = await res.text();
        let data: unknown = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        }
        if (!res.ok) {
          const err = data as { message?: string };
          return { data: null, error: { message: err?.message || "RPC failed" }, count: null };
        }
        return { data: data as QueryResult["data"], error: null, count: null };
      } catch (e: unknown) {
        return { data: null, error: { message: e instanceof Error ? e.message : String(e) }, count: null };
      }
    },
  };
}
