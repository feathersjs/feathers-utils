// src/feathers.ts
import * as feathers from '@feathersjs/feathers'

// Type-safe re-export of only what you need
export const SERVICE = (feathers as any).SERVICE || feathers.default?.SERVICE
