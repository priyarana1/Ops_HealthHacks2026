import { describe,it,expect,vi,afterEach } from 'vitest';
const dependencies=vi.hoisted(()=>({load:vi.fn()}));vi.mock('../src/lib/backend/dependencies',()=>({optionalDependency:dependencies.load}));
import { extractDocument } from '../src/lib/backend/documents';
afterEach(()=>vi.clearAllMocks());
describe('PDF extraction failure contracts (mocked parser)',()=>{
 it('rejects scanned/no-text PDFs clearly',async()=>{dependencies.load.mockReturnValue({PDFParse:class{async getInfo(){return {total:1};}async getText(){return {text:''};}async destroy(){}}});await expect(extractDocument('synthetic.pdf','application/pdf',Buffer.from('%PDF-1.7 synthetic fixture'))).rejects.toThrow('No readable');});
 it('returns extracted text and catches damaged PDF errors',async()=>{dependencies.load.mockReturnValue({PDFParse:class{async getInfo(){return {total:1};}async getText(){return {text:'Synthetic discharge text only.'};}async destroy(){}}});expect((await extractDocument('synthetic.pdf','application/pdf',Buffer.from('%PDF-1.7 synthetic fixture'))).text).toBe('Synthetic discharge text only.');dependencies.load.mockReturnValue({PDFParse:class{async getInfo(){throw new Error('parser exception');}async getText(){return {text:''};}async destroy(){}}});await expect(extractDocument('synthetic.pdf','application/pdf',Buffer.from('%PDF-1.7 synthetic fixture'))).rejects.toThrow('PDF text extraction failed');});
});
