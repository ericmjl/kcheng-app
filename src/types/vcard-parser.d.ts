declare module "vcard-parser" {
  export function parse(string: string): Record<string, Array<{ value: string | string[] }>>;
  export function generate(obj: unknown): string;
}
