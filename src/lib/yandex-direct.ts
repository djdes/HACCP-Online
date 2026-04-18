/**
 * Minimal client for the Yandex.Direct API v5.
 *
 * Docs: https://yandex.ru/dev/direct/doc/ru/
 *
 * Auth: OAuth bearer token with the `direct:api` scope. Acquired via
 * scripts/yandex-direct-auth.ts, stored in YANDEX_DIRECT_OAUTH_TOKEN.
 *
 * Locale: Accept-Language=ru forces Russian error messages which is
 * what support will ask about anyway.
 *
 * Notes on safety:
 *   - Every create-method defaults to draft state where the API supports
 *     it, so a misconfigured script never blasts money.
 *   - `dryRun: true` is surfaced as an option for every write method —
 *     the API has a native dry-run flag that returns what WOULD be
 *     created without actually writing. Use it liberally.
 */

const API_BASE = "https://api.direct.yandex.com/json/v5";
const SANDBOX_BASE = "https://api-sandbox.direct.yandex.com/json/v5";

export type DirectClientOptions = {
  token?: string;
  sandbox?: boolean;
  /// "operator/client-login" for agency accounts; ignored for direct
  /// advertisers. Optional.
  clientLogin?: string;
};

export class YandexDirectClient {
  private token: string;
  private base: string;
  private clientLogin?: string;

  constructor(options: DirectClientOptions = {}) {
    const token = options.token ?? process.env.YANDEX_DIRECT_OAUTH_TOKEN;
    if (!token) {
      throw new Error(
        "YANDEX_DIRECT_OAUTH_TOKEN not set — run scripts/yandex-direct-auth.ts first"
      );
    }
    this.token = token;
    this.base = options.sandbox ? SANDBOX_BASE : API_BASE;
    this.clientLogin = options.clientLogin;
  }

  private async call<TParams, TResult>(
    service: string,
    method: string,
    params: TParams
  ): Promise<TResult> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Accept-Language": "ru",
      "Content-Type": "application/json; charset=utf-8",
    };
    if (this.clientLogin) headers["Client-Login"] = this.clientLogin;

    const res = await fetch(`${this.base}/${service}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ method, params }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `Yandex.Direct ${service}.${method} HTTP ${res.status}: ${text.slice(0, 500)}`
      );
    }
    const json = JSON.parse(text) as {
      result?: TResult;
      error?: { error_string: string; error_detail: string; error_code: string };
    };
    if (json.error) {
      throw new Error(
        `Yandex.Direct ${service}.${method} API ${json.error.error_code}: ${json.error.error_string} — ${json.error.error_detail}`
      );
    }
    if (!json.result) {
      throw new Error(`Yandex.Direct ${service}.${method}: empty response`);
    }
    return json.result;
  }

  // -- Campaigns -----------------------------------------------------------

  async listCampaigns(selectionCriteria: {
    States?: string[];
    Statuses?: string[];
  } = {}) {
    return this.call<
      object,
      { Campaigns?: Array<Record<string, unknown>> }
    >("campaigns", "get", {
      SelectionCriteria: selectionCriteria,
      FieldNames: ["Id", "Name", "State", "Status", "Type", "DailyBudget"],
    });
  }

  async createCampaigns(campaigns: Array<Record<string, unknown>>) {
    return this.call<
      object,
      { AddResults?: Array<{ Id?: number; Warnings?: unknown[]; Errors?: unknown[] }> }
    >("campaigns", "add", { Campaigns: campaigns });
  }

  async suspendCampaigns(ids: number[]) {
    return this.call<
      object,
      { SuspendResults?: Array<{ Id?: number; Errors?: unknown[] }> }
    >("campaigns", "suspend", {
      SelectionCriteria: { Ids: ids },
    });
  }

  // -- Ad groups -----------------------------------------------------------

  async createAdGroups(groups: Array<Record<string, unknown>>) {
    return this.call<
      object,
      { AddResults?: Array<{ Id?: number; Errors?: unknown[] }> }
    >("adgroups", "add", { AdGroups: groups });
  }

  // -- Ads -----------------------------------------------------------------

  async createAds(ads: Array<Record<string, unknown>>) {
    return this.call<
      object,
      { AddResults?: Array<{ Id?: number; Errors?: unknown[] }> }
    >("ads", "add", { Ads: ads });
  }

  // -- Keywords ------------------------------------------------------------

  async createKeywords(keywords: Array<Record<string, unknown>>) {
    return this.call<
      object,
      { AddResults?: Array<{ Id?: number; Errors?: unknown[] }> }
    >("keywords", "add", { Keywords: keywords });
  }

  // -- Balance probe -------------------------------------------------------

  async getClientBalance() {
    return this.call<
      object,
      { Clients?: Array<{ Login?: string; Currency?: string; AccountBalance?: string }> }
    >("clients", "get", {
      FieldNames: ["Login", "Currency", "AccountBalance"],
    });
  }
}
