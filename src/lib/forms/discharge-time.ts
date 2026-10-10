// Browser-local wall time, validated before converting to an explicit UTC offset.
export function dischargeTimestamp(date:string,time:string,now=new Date()){
 if(!date)throw new Error('Select the hospital discharge date.');
 if(!time)throw new Error('Enter the hospital discharge time, including AM or PM if shown.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))throw new Error('Complete both the discharge date and time.');
 const [year,month,day]=date.split('-').map(Number),[hour,minute]=time.split(':').map(Number);
 const value=new Date(year,month-1,day,hour,minute);
 if(value.getFullYear()!==year || value.getMonth()!==month-1 || value.getDate()!==day || value.getHours()!==hour || value.getMinutes()!==minute)throw new Error('The discharge date/time is invalid or does not exist in your device timezone.');
 if(value>now)throw new Error('The hospital discharge date/time cannot be in the future.');
 const expiresAt=new Date(value.getTime()+30*24*3600000);
 if(expiresAt<=now)throw new Error('This discharge is already past its 30-day retention period. Use a current synthetic example; do not change an actual discharge date to extend access.');
 const offset=-value.getTimezoneOffset(),sign=offset>=0?'+':'-',pad=(n:number)=>String(n).padStart(2,'0');
 return {dischargeAt:`${date}T${time}:00${sign}${pad(Math.floor(Math.abs(offset)/60))}:${pad(Math.abs(offset)%60)}`,dischargeTimezone:Intl.DateTimeFormat().resolvedOptions().timeZone,expiresAt};
}
