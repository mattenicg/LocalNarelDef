'use strict';

const path = require('path');

// Cambiar directorio de trabajo al subproyecto plantilla1
const appDir = path.join(__dirname, 'LOCAL.NAREL', 'plantilla1');
process.chdir(appDir);

// Iniciar servidor de la aplicación
require(path.join(appDir, 'src', 'server.js'));
