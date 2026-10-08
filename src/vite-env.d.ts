// Vite's `?url` imports: the bundled file's address (used for the pdf.js worker).
declare module '*?url' {
  const url: string;
  export default url;
}
