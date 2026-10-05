import type { Query, QueryClient } from "@tp/query";
import type { AuthConfig, LoginInput, Me, SignupInput } from "@tp/shared";
import { isApiError, type StoreHttp } from "./http";

/** Session and the signed-in user's workspace list. `me` resolves to null when signed out. */
export class AuthStore {
  readonly me: Query<Me | null>;
  readonly config: Query<AuthConfig>;

  constructor(
    private http: StoreHttp,
    private queries: QueryClient,
  ) {
    this.me = queries.query(
      ["me"],
      async () => {
        try {
          return await http.get<Me>("/auth/me");
        } catch (e) {
          if (isApiError(e) && e.status === 401) return null;
          throw e;
        }
      },
      { staleTime: 60_000 },
    );
    this.config = queries.query(["auth-config"], () => http.get<AuthConfig>("/auth/config"), { staleTime: Infinity });
  }

  async signup(input: SignupInput) {
    const me = await this.http.post<Me>("/auth/signup", input);
    this.me.setData(me);
    return me;
  }

  async login(input: LoginInput) {
    const me = await this.http.post<Me>("/auth/login", input);
    this.me.setData(me);
    return me;
  }

  async logout() {
    await this.http.post("/auth/logout");
    this.queries.clear({ keep: [["me"], ["auth-config"]] });
    this.me.setData(null);
  }

  /** Called when any request reports the session has ended. */
  handleUnauthorized() {
    if (this.me.getSnapshot().data) this.me.setData(null);
  }

  setMe(me: Me) {
    this.me.setData(me);
  }
}
