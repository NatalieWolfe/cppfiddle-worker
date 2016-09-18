'use strict';

var cp = require('child_process');
var EventEmitter = require('events').EventEmitter;
var gpp = require('generic-promise-pool');
var Promise = require('bluebird');

var logger = require('./logger').child({component: 'executor'});


class Executor extends EventEmitter {
    constructor() {
        super();
    }

    execute(cmd, timeout) {
        timeout = timeout || 0;
        return new Promise((resolve, reject) => {
            var timer = null;
            var calledBack = false;
            var exited = false;
            var results = {};
            var child = cp.exec(cmd, {timeout}, (err, stdout, stderr) => {
                results.err = err;
                results.stdout = stdout.toString();
                results.stderr = stderr.toString();
            });

            child.on('error', reject);
            child.on('exit', (code, signal) => {
                clearTimeout(timer);
                results.code = code;
                results.signal = signal;
                done();
            });

            var done = () => {
                if (calledBack && exited) {
                    if (results.err || results.code !== 0) {
                        reject(results);
                    } else {
                        resolve(results);
                    }
                }
            };

            if (timeout) {
                timer = setTimeout(() => child.kill('SIGKILL'), timeout);
            }
        });
    }
}

module.exports = gpp.create({
    name: 'executor-pool',
    min: 0,
    max: 5,
    create: () => new Executor(),
    destroy: () => {}
});
