'use strict';

var path = require('path');

module.exports = {
    server: {
        port: 8181
    },
    executor: {
        uid: process.getuid(),
        path: path.join(process.cwd(), 'executor-workspace'),
        codeFile: 'fiddle.cpp',
        timeout: {
            compile: 10 * 1000,
            execution: 5 * 1000
        }
    },
    logging: {
        level: 'debug'
    }
};
