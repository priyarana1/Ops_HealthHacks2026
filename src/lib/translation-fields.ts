import { generatedContent, type GeneratedContent } from "@/lib/backend/contracts";

// Client-safe helpers shared by the translation service and the provider screens.
export type Field = { path: string; text: string };

const SECTIONS=['hospitalCourse','diagnoses','dailyActions','diet','fluids','activity','otherInstructions','appointments','labsAndMonitoring','warningSigns'] as const;
/** The English fields a patient sees, by path. Medicine names and doses stay in English and are not listed. */
export function translatableFields(content:GeneratedContent):Field[]{
 const fields:Field[]=[];
 if(content.summary)fields.push({path:'summary.text',text:content.summary.text});
 for(const section of SECTIONS)content[section].forEach((item,i)=>fields.push({path:`${section}.${i}.text`,text:item.text}));
 content.medications.forEach((m,i)=>{
  fields.push({path:`medications.${i}.plainLanguage`,text:m.plainLanguage});
  for(const key of ['frequency','route','duration'] as const)if(m[key])fields.push({path:`medications.${i}.${key}`,text:m[key]!});
 });
 return fields.filter(f=>f.text.trim());
}
/** The approved English content with translated text placed at each path. */
export function applyTranslation(content:GeneratedContent,fields:{path:string;text:string}[]):GeneratedContent{
 const result=structuredClone(content);
 for(const field of fields){
  const keys=field.path.split('.');let target:Record<string,unknown>=result as unknown as Record<string,unknown>;
  for(const key of keys.slice(0,-1))target=target?.[key] as Record<string,unknown>;
  if(target && typeof target[keys.at(-1)!]==='string')target[keys.at(-1)!]=field.text;
 }
 return generatedContent.parse(result);
}

