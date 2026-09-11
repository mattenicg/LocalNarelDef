const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');
const MAX_BYTES = 5 * 1024 * 1024;
const MIME_ALLOWED = new Set(['image/jpeg','image/jpg','image/png','image/webp']);
const EXT = {'image/jpeg':'jpg','image/jpg':'jpg','image/png':'png','image/webp':'webp'};
function ensureDir(dir){fs.mkdirSync(dir,{recursive:true});}
function validate(file){if(!file)return {ok:false,message:'Archivo faltante'};if(!MIME_ALLOWED.has(file.mimetype))return {ok:false,message:'Formato no permitido. Solo JPG, JPEG, PNG y WEBP'};if(!file.buffer?.length||file.size>MAX_BYTES)return {ok:false,message:`Archivo demasiado grande. Tamaño máximo 5 MB`};return {ok:true};}
async function uploadProductImage(userId,file){const v=validate(file);if(!v.ok)return v;const folder=path.join(env.UPLOADS_DIR,'products',String(userId));ensureDir(folder);const name=`${crypto.randomUUID()}.${EXT[file.mimetype]}`;const full=path.join(folder,name);fs.writeFileSync(full,file.buffer);return {ok:true,message:'Imagen subida correctamente',data:{path:path.relative(env.UPLOADS_DIR,full).replace(/\\/g,'/'),image_url:`${env.UPLOADS_PUBLIC_PATH}/products/${userId}/${name}`,size_bytes:file.size,mime:file.mimetype}};}
function deleteObjectByPublicUrl(url){if(!url||!url.startsWith(env.UPLOADS_PUBLIC_PATH+'/'))return {ok:true,skipped:true};const full=path.join(env.UPLOADS_DIR,url.slice((env.UPLOADS_PUBLIC_PATH+'/').length));if(fs.existsSync(full))fs.unlinkSync(full);return {ok:true,removed:true};}
module.exports={MAX_BYTES,MIME_ALLOWED,validate,uploadProductImage,deleteObjectByPublicUrl};
