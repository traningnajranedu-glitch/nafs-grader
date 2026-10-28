import {NextRequest,NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {clientId,redirectUri,requireAdmin,encrypt} from '../../../../lib/google-drive-server';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
  const uid=await requireAdmin(req.headers.get('authorization'));
  if(!clientId()||!redirectUri()||!process.env.GOOGLE_CLIENT_SECRET)throw Error('Google OAuth environment variables missing');
  // Encrypted, authenticated and short-lived state survives OAuth redirects across domains.
  const state=encrypt(JSON.stringify({uid,nonce:randomBytes(24).toString('hex'),exp:Date.now()+600_000}));
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for(const [key,value] of Object.entries({client_id:clientId(),redirect_uri:redirectUri(),response_type:'code',scope:'https://www.googleapis.com/auth/drive.file',access_type:'offline',prompt:'consent',state}))url.searchParams.set(key,value);
  return NextResponse.json({url:url.toString()},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Connection failed'},{status:403})}
}
