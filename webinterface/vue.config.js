module.exports = {
    devServer: {
        port: 8080,
        host: 'localhost',
        proxy: {
            '^/api': {
                target: 'http://localhost:3000/',
                changeOrigin: true,
                secure: false,
                pathRewrite: { '^/api/': '/api/' },
                logLevel: 'debug',
            }
        }
    }
}