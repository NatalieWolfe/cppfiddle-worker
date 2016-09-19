'use strict';

var cp = require('child_process');
var gpp = require('generic-promise-pool');
var Promise = require('bluebird');

var logger = require('./logger').child({component: 'executor'});


var executorCounter = 0;

class Executor {
    constructor() {
        this.logger = logger.child({executor: ++executorCounter});
    }

    execute(cmd, timeout) {
        this.logger.debug({command: cmd}, 'Executing command.');
        timeout = timeout || 0;
        return new Promise((resolve, reject) => {
            var timer = null;
            var calledBack = false;
            var exited = false;
            var results = {};
            var child = cp.exec(cmd, {timeout}, (err, stdout, stderr) => {
                calledBack = true;
                results.err = err;
                results.stdout = stdout.toString();
                results.stderr = stderr.toString();
                done();
            });

            child.on('error', reject);
            child.on('exit', (code, signal) => {
                exited = true;
                clearTimeout(timer);
                results.code = code;
                results.signal = signal;
                done();
            });

            var done = () => {
                if (calledBack && exited) {
                    if (results.err || results.code !== 0) {
                        this.logger.trace('Execution failed, rejecting');
                        reject(results);
                    } else {
                        this.logger.trace('Execution succeeded, resolving.');
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
    create: () => {
        logger.trace('Creating new executor for pool.');
        return new Executor()
    },
    destroy: () => {}
});
