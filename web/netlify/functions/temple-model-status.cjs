const crypto=require('node:crypto');
const control=require("../../temple-model-control.cjs");
control.configure({appId:"0d5d76291cf284a3019e2dc855f9135a"});
exports.handler=control.wrap(async(event)=>{
 const expected=process.env.TEMPLE_CONTROL_MONITOR_TOKEN||'',given=event.headers?.['x-temple-control']||'';
 if(!expected||expected.length!==given.length||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(given)))return {statusCode:404,body:'Not found'};
 return {statusCode:200,body:JSON.stringify(await control.status(event)),headers:{'content-type':'application/json','cache-control':'no-store'}};
});
