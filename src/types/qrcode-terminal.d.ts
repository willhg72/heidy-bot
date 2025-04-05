declare module 'qrcode-terminal' {
  export function generate(qrCode: string, options?: { small: boolean }): void;
  export default generate;
}