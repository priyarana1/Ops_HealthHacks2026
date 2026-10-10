import {describe,it,expect} from 'vitest';
import {dischargeTimestamp} from '../src/lib/forms/discharge-time';
describe('Provider discharge date/time input',()=>{
 it('identifies which required field is missing',()=>{expect(()=>dischargeTimestamp('','')).toThrow('Select');expect(()=>dischargeTimestamp('2026-10-10','')).toThrow('Enter');});
 it('rejects invalid calendar dates and partial times instead of normalizing them',()=>{expect(()=>dischargeTimestamp('2026-02-30','10:00')).toThrow('invalid');expect(()=>dischargeTimestamp('2026-10-10','10:')).toThrow('Complete');});
 it('distinguishes future and expired dates',()=>{const now=new Date(2026,9,10,12);expect(()=>dischargeTimestamp('2026-10-11','10:00',now)).toThrow('future');expect(()=>dischargeTimestamp('2026-09-01','10:00',now)).toThrow('retention');});
 it('preserves local wall time with an explicit offset and fixed expiration',()=>{const now=new Date(2026,9,10,12),result=dischargeTimestamp('2026-10-09','15:30',now);expect(new Date(result.dischargeAt).getTime()).toBe(new Date(2026,9,9,15,30).getTime());expect(result.dischargeAt).toMatch(/[+-]\d{2}:\d{2}$/);expect(result.expiresAt.getTime()-new Date(result.dischargeAt).getTime()).toBe(30*24*3600000);});
});
