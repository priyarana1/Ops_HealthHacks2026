/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS diagnostic script. */
// Syntax-only fallback when full dependency installation is unavailable.
const fs=require('node:fs'),path=require('node:path');
const ts=require(process.env.CLEARPATH_TYPESCRIPT_PATH || 'typescript');
const files=[];function walk(dir){for(const f of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())walk(p);else if(/\.tsx?$/.test(p))files.push(p);}}walk('src');walk('tests');
let errors=0;for(const file of files){const result=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.Preserve,isolatedModules:true}});for(const d of result.diagnostics || []){if(d.category===ts.DiagnosticCategory.Error){errors++;console.error(file+': '+ts.flattenDiagnosticMessageText(d.messageText,'\n'));}}}
console.log(`${files.length} TypeScript files syntax-checked; ${errors} syntax errors. This is not a type check.`);process.exitCode=errors?1:0;
