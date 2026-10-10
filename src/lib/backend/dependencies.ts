import Module from 'node:module';
import { AppError } from '@/lib/security/core';
const load=Reflect.apply(Module.createRequire,Module,[process.cwd()+'/package.json']) as NodeJS.Require;
export function optionalDependency<T>(name:string):T {try{return load(name) as T;}catch{throw new AppError(503,`Server dependency ${name} is unavailable. Run npm run backend:install and restart.`);}}
