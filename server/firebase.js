const path=require('path'); const admin=require('firebase-admin'); let ready=false;
const keyPath=process.env.FIREBASE_SERVICE_ACCOUNT_PATH||'./firebase-service-account.json';
try{const serviceAccount=require(path.resolve(keyPath));admin.initializeApp({credential:admin.credential.cert(serviceAccount)});ready=true;}catch{console.warn('[firebase] Service account not configured. Device commands remain disabled until configured.');}
async function send(fcmToken,data){if(!ready)throw new Error('Firebase is not configured.');return admin.messaging().send({token:fcmToken,data,android:{priority:'high'}});}
const sendLock=(t,p)=>send(t,{type:'LOCK',shopName:p.shopName||'Nadeem Mobiles',shopPhone:p.shopPhone||'',message:p.message||''});
const sendUnlock=t=>send(t,{type:'UNLOCK'}); const sendRelease=(t,token)=>send(t,{type:'RELEASE',releaseToken:token});
module.exports={sendLock,sendUnlock,sendRelease,isReady:()=>ready};
