/**
 * mingo only exposes 'mingo/util' through the "exports" field of its package.json,
 * which the "node" moduleResolution does not read.
 * So we point TypeScript to the types directly. At runtime 'mingo/util' is resolved normally.
 * (Do not use "paths" in the tsconfig for this, tsx would then load the .d.ts file at runtime.)
 */
declare module 'mingo/util' {
    export * from 'mingo/types/util/index';
}
