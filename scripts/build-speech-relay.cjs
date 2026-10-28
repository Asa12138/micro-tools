#!/usr/bin/env node
// Create a standalone, reviewable Netlify deployment without community-site edits.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist/speech-relay');fs.mkdirSync(out,{recursive:true});
const files=['server/README.md','server/speech-relay.cjs','server/netlify/functions/speech.mjs','features/english/english-speech.js','features/english/english-network.js','features/english/english-core.js','vendor/ENGLISH-LICENSES.txt'];
for(const f of files){fs.mkdirSync(path.dirname(path.join(out,f)),{recursive:true});fs.copyFileSync(path.join(root,f),path.join(out,f));}
for(const dir of ['vendor/ms-edge-tts','vendor/proxy'])fs.cpSync(path.join(root,dir),path.join(out,dir),{recursive:true});
fs.copyFileSync(path.join(root,'server/netlify.toml'),path.join(out,'netlify.toml'));
fs.mkdirSync(path.join(out,'public'),{recursive:true});fs.writeFileSync(path.join(out,'public/index.html'),'<!doctype html><meta charset="utf-8"><title>科研英语语音服务</title><p>科研英语语音服务 · POST /api/speech</p>');
console.log(out);
