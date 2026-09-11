function agregarMetodosRespuesta(req, res, next) {
  res.ok = function (data = null, mensaje = 'OK') {
    return res.status(200).json({
      ok: true,
      mensaje,
      datos: data,
    });
  };

  res.error = function (mensaje = 'Error interno del servidor', estado = 500) {
    return res.status(estado).json({
      ok: false,
      error: mensaje,
    });
  };

  next();
}

module.exports = agregarMetodosRespuesta;
