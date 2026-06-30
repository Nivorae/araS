// Type declarations for static image asset imports. Metro resolves these at
// bundle time; React Native represents a bundled image as an opaque asset id
// (a number) which `<Image source={...} />` accepts. expo/types does not
// provide these declarations, so tsc needs them to type-check image imports.
declare module "*.png" {
  const content: number;
  export default content;
}

declare module "*.jpg" {
  const content: number;
  export default content;
}

declare module "*.jpeg" {
  const content: number;
  export default content;
}

declare module "*.gif" {
  const content: number;
  export default content;
}

declare module "*.webp" {
  const content: number;
  export default content;
}
