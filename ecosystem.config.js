module.exports = {
    apps: [{
        name:   "wikiracr",
        script: "server/src/index.js",
        cwd:    "/var/www/wikiracr",
        watch:  false,
        env: {
            NODE_ENV: "production",
            PORT: 3001,
        },
        max_memory_restart: "500M",
        error_file:      "logs/err.log",
        out_file:        "logs/out.log",
        log_date_format: "YYYY-MM-DD HH:mm:ss"
    }]
};
