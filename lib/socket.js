'use strict';

var events = require('events');

var executor = require('./executor');
var logger = require('./logger').child({component: 'Socket'});

var globalJobIdCounter = 0;

class Socket extends events.EventEmitter {
    constructor(socket) {
        super();
        this.id = socket.id;
        this.logger = logger.child({socket_id: this.id});
        this._socket = socket;
        this._socket.on('disconnect', () => {
            super.emit('disconnect');
            this.removeAllListeners();
        });

        this._bindEvents();

        this.emit('connected', {id: this.id});
    }

    static connected(sock) {
        return new Socket(sock);
    }

    _bindEvents() {
        // New code to execute.
        this._socket.on('execute', (data) => {
            this.logger.trace(data, 'Received execution command.');
            this.execute(data.code, data.jobId)
                .catch((err) => this.emit('error', err));
        });
    }

    close() {
        this._socket.disconnect();
    }

    emit() {
        this._socket.emit.apply(this._socket, arguments);
        super.emit.apply(this, arguments);
    }

    execute(code, jobId=0) {
        if (!jobId) {
            jobId = ++globalJobIdCounter;
        }
        var jobLogger = this.logger.child({job_id: jobId});
        jobLogger.trace('Starting new job.');

        return executor.acquire((ex) => {
            jobLogger.trace('Executor acquired.');
            ex.on('output', (data) => {
                data = data.toString('utf8');
                jobLogger.trace('Output: %j', data);
                this.emit('output', {jobId, data});
            });

            this.emit('update', {jobId, state: 'compiling', done: false});
            return ex.compile(code).then(() => {
                jobLogger.trace('Code compiled.');
                this.emit('update', {jobId, state: 'executing', done: false});
                return ex.execute();
            });
        }).then(() => {
            jobLogger.debug('Done executing code.');
            this.emit('update', {jobId, state: 'succeeded', done: true});
        }, (reason) => {
            if (reason instanceof Error) {
                jobLogger.error({error: reason.stack}, 'Error executing code.');
                this.emit('error', reason);
            }
            else {
                jobLogger.debug(reason, 'Code not executable.');
                this.emit('update', {jobId, reason, state: 'failed', done: true});
            }
        });
    }
}

module.exports = Socket;
