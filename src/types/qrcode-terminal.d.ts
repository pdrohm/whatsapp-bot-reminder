declare module 'qrcode-terminal' {
  function generate(text: string, options?: { small?: boolean }): void;
  
  export default {
    generate
  };
} 