import createHandler from '../../speech-relay.cjs';
const origins=(process.env.SPEECH_ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
const handle=createHandler({origins,token:process.env.SPEECH_RELAY_TOKEN||''});
export default (request,context)=>handle(request,context.ip);
export const config={path:'/api/speech',rateLimit:{windowLimit:60,windowSize:60,aggregateBy:['ip','domain']}};
