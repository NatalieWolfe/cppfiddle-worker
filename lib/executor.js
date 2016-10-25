'use strict';

var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');

var cp = require('child_process');
var fs = Promise.promisifyAll(require('fs'));
var fse = Promise.promisifyAll(require('fs-extra'));
var gpp = require('generic-promise-pool');
var path = require('path');

var logger = require('./logger').child({component: 'executor'});


const EXECUTOR_USER_UID = parseInt(process.env.EXECUTOR_USER_UID, 10);
const EXECUTOR_TEMPLATE = process.env.EXECUTOR_DIRECTORY;
const TEST_FILE = 'test.cpp';
var executorCounter = 0;


class Executor extends EventEmitter {
    constructor() {
        super();
        this.logger = logger.child({executor: ++executorCounter});
        this.id = executorCounter;
        this._folder = null;
    }

    compile(code) {
        this.logger.trace('Compiling %d characters of code.', code.length);
        return this.getFolder().then((folder) => {
            var filePath = path.join(folder.path, TEST_FILE);
            return fs.writeFileAsync(filePath, code, {mode: 0o644}).then(() => {
                this.logger.trace('Saved code to %s', filePath);
                return this.exec(folder.path, 'g++', [TEST_FILE]);
            });
        });
    }

    execute() {
        this.logger.trace('Executing compiled file.');
        return this.getFolder().then((folder) => {
            return this.exec(folder.path, path.join(folder.path, 'a.out'));
        });
    }

    getFolder() {
        if (!this._folder) {
            this._folder = this.makeSpace().then((folder) => {
                return this._folder = folder;
            });
        }
        return Promise.resolve(this._folder);
    }

    clean() {
        if (this._folder) {
            this._folder.clean();
            this._folder = null;
        }
        this.removeAllListeners();
    }

    exec(workingDir, cmd, args, timeout) {
        timeout = timeout || 0;
        this.logger.debug({command: cmd, timeout}, 'Executing command.');
        return new Promise((resolve, reject) => {
            var timer = null;
            var child = null;

            child = cp.spawn(cmd, args, {
                cwd: workingDir,
                uid: EXECUTOR_USER_UID,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            child.stdout.on('data', (data) => this.emit('output', data));
            child.stderr.on('data', (data) => this.emit('output', data));

            child.on('error', (err) => {
                this.logger.error(
                    {error: err.stack, command: cmd, args: args},
                    'Failed to execute command'
                );
            });
            child.on('exit', (code, signal) => {
                clearTimeout(timer);
                this.logger.trace({code, signal}, 'Process exited.');
                if (code !== 0 || signal !== null) {
                    reject({code, signal});
                }
                else {
                    resolve();
                }
            });

            if (timeout) {
                timer = setTimeout(() => {
                    this.logger.trace('Killing execution of process.');
                    child.kill('SIGKILL');
                }, timeout);
            }
        });
    }

    makeSpace() {
        var prefix = path.join(EXECUTOR_TEMPLATE, this.id + '-');
        return fs.mkdtempAsync(prefix).then((p) => {
            return fs.chmodAsync(p, 0o755)
                .then(() => fs.chownAsync(p, EXECUTOR_USER_UID, EXECUTOR_USER_UID))
                .then(() => ({path: p, clean: () => fse.removeAsync(p)}));
        });
    }
}

module.exports = gpp.create({
    name: 'executor-pool',
    min: 0,
    max: 5,
    create: () => {
        logger.trace('Creating new executor for pool.');
        return new Executor();
    },
    onRelease: (ex) => ex.clean(),
    destroy: () => {}
});
