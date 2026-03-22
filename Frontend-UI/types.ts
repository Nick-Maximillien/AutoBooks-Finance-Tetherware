declare module "ic-stoic-identity" {
  export class StoicIdentity {
    static load(): Promise<StoicIdentity | null>;
    static connect(): Promise<StoicIdentity>;
    getPrincipal(): { toText(): string };
  }
}

  