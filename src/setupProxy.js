const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/rts',
    createProxyMiddleware({
      target: 'https://api.intraprod.krafton.com',
      changeOrigin: true,
      secure: true,
    })
  );
};
