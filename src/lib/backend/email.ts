import { AppError } from '@/lib/security/core';
import { optionalDependency } from './dependencies';
interface SesModule {SESv2Client:new(config:{region:string;maxAttempts:number})=>{send(command:unknown):Promise<{MessageId?:string}>};SendEmailCommand:new(input:unknown)=>unknown}
export interface InvitationEmail {to:string;activationUrl:string;validUntil:Date}
export interface EmailDelivery {sendInvitation(input:InvitationEmail):Promise<void>}
export const emailDelivery:EmailDelivery={async sendInvitation(input){
 if(!process.env.AWS_REGION || !process.env.SES_FROM_EMAIL)throw new AppError(503,'Configure AWS_REGION and SES_FROM_EMAIL before granting access.');
 const sdk=optionalDependency<SesModule>('@aws-sdk/client-sesv2');
 const client=new sdk.SESv2Client({region:process.env.AWS_REGION,maxAttempts:1});
 try{const response=await client.send(new sdk.SendEmailCommand({FromEmailAddress:process.env.SES_FROM_EMAIL,Destination:{ToAddresses:[input.to]},Content:{Simple:{Subject:{Data:'Your ClearPath invitation',Charset:'UTF-8'},Body:{Text:{Data:`You have been invited to ClearPath. Open the link below and enter the activation code provided separately by your clinician.\n\n${input.activationUrl}\n\nThis link expires at ${input.validUntil.toISOString()}. If you did not expect this invitation, ignore it.`,Charset:'UTF-8'}}}}}));if(!response.MessageId)throw new Error('NO_MESSAGE_ID');}
 catch{throw new AppError(503,'Invitation email delivery failed or is uncertain. No patient access was activated. Verify SES identities, sandbox recipient verification, credentials and permissions.');}
}};
