import {describe,it,expect} from 'vitest';
import {materializeExtraction,simplificationBase} from '../src/lib/backend/extraction';
import {applyRewrites} from '../src/lib/backend/simplification';
import {approvalIssues} from '../src/lib/backend/policy';
const sourceId='12345678-1234-4234-8234-123456789012',quote='NEW Furosemide 40 mg PO daily for 7 days.';
const source={sourceId,kind:'FINAL_AVS' as const,text:quote,createdAt:new Date(),documentType:'text/plain',transcriptConfirmed:false};
const blank={hospitalCourse:[],diagnoses:[],medications:[],dailyActions:[],diet:[],fluids:[],activity:[],otherInstructions:[],appointments:[],labsAndMonitoring:[],warningSigns:[],teachBackQuestions:[],practicalBarriers:[],issues:[]};
const medication={name:'Furosemide',dose:'40 mg',route:'PO',frequency:'daily',duration:'7 days',formulation:null,status:'NEW',evidence:{sourceId,quote}};
describe('Passage-only extraction',()=>{
 it('materializes prose from exact passages without asking Claude for a summary',()=>{const content=materializeExtraction({...blank,hospitalCourse:[{sourceId,quote}],medications:[medication]},[source]);expect(content.summary).toBeNull();expect(content.hospitalCourse[0].text).toBe(quote);expect(content.medications[0].plainLanguage).toBe(quote);expect(content.medications[0].notes).toBe(quote);});
 it('rejects invented source passages and incorrect medication names',()=>{expect(()=>materializeExtraction({...blank,hospitalCourse:[{sourceId,quote:'invented passage'}]},[source])).toThrow('stored source');expect(()=>materializeExtraction({...blank,medications:[{...medication,name:'Invented drug'}]},[source])).toThrow('name must match');});
 it('turns an unsupported duration into an explicit unknown with an approval-blocking flag',()=>{const content=materializeExtraction({...blank,medications:[{...medication,duration:'one week'}]},[source]);expect(content.medications[0].duration).toBeNull();expect(content.medications[0].evidence.quote).toBe(quote);expect(content.issues[0].id).toBe('unverified-medication-0-duration');expect(()=>approvalIssues(content)).toThrow('Resolve');});
 it('never infers a duration absent from the source',()=>{const text='NEW Furosemide 40 mg PO daily.';const content=materializeExtraction({...blank,medications:[{...medication,duration:null,evidence:{sourceId,quote:text}}]},[{...source,text}]);expect(content.medications[0].duration).toBeNull();});
 it('anchors a summary only for stage two without modifying stored extraction',()=>{const extraction=materializeExtraction({...blank,hospitalCourse:[{sourceId,quote}]},[source]);const base=simplificationBase(extraction);expect(extraction.summary).toBeNull();expect(base.summary?.evidence.quote).toBe(quote);const simplified=applyRewrites(base,{rewrites:[{path:'summary.text',text:'Furosemide instructions.'}]});expect(simplified.summary?.text).toBe('Furosemide instructions.');expect(extraction.summary).toBeNull();});
 it('rejects AI-generated summary and prose fields in extraction',()=>{expect(()=>materializeExtraction({...blank,summary:{text:'Invented summary'}},[source])).toThrow();});
});
