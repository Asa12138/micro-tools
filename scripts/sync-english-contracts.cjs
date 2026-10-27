#!/usr/bin/env node
// One owning source for the plugin, generated web app and standalone community.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),community=path.resolve(root,'../asa-english-community'),check=process.argv.includes('--check');
const pairs=[['features/english/english-core.js','site/lib/english-core.js'],['docs/english-material-spec-v1.md','site/spec/README.md'],...['english-material-v1.schema.json','course-example.json','wordbook-example.json'].map(f=>['docs/materials/'+f,'site/spec/materials/'+f])];
for(const [source,dest]of pairs){const bytes=fs.readFileSync(path.join(root,source)),target=path.join(community,dest);if(check){if(!fs.existsSync(target)||!bytes.equals(fs.readFileSync(target)))throw Error('共享素材规范未同步：'+target)}else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes)}}
console.log((check?'Checked':'Synced')+' shared material contract: '+pairs.length+' files');
