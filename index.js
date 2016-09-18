'use strict';

// var newrelic = require('newrelic');

var Promise = require('bluebird');

var bodyParser = require('body-parser');
var errors = require('restify-errors');
var fs = Promise.promisifyAll(require('fs'));
var restify = require('restify');

var executor = require('./lib/executor');
var logger = require('./lib/logger').child({component: 'server'});


var server = restify.createServer({name: 'cppfiddle-worker', log: logger});

server.use(bodyParser.urlencoded({extended: true}));

server.post('/execute', (req, res, next) => {
    if (!req.body.code) {
        return next(new errors.BadRequestError('`code` is a required parameter.'));
    }
    logger.trace({code: req.body.code}, 'Executing code.');

    var results = {};
    fs.writeFileAsync('test.cpp', req.body.code)
        .then(() => executor.acquire((ex) => {
            return ex.execute('g++ test.cpp')
                .then((compileResults) => {
                    results.compile = compileResults;
                }, (compileResults) => {
                    results.compile = compileResults;
                    throw new Error('failed to compile');
                })
                .then(() => ex.execute('./a.out'))
                .then((runResults) => {
                    results.run = runResults;
                }, (runResults) => {
                    results.run = runResults;
                    throw new Error('failed to run');
                })
        }))
        .then(
            () => {
                res.send(results);
                next();
            },
            (err) => {
                var msg = err.message;
                if (msg === 'failed to compile' || msg === 'failed to run') {
                    res.send(results);
                    return next();
                }

                logger.debug({error: err}, 'Failed to execute code.');
                next(new errors.InternalServerError('Failed to process code.'));
            }
        );
});

server.on('after', (req, res) => {
    logger.debug({path: req.path, status: res.statusCode}, 'Served request.')
});

server.on('close', () => {
    logger.info('Server shut down.');
})

server.listen(PORT, () => {
    logger.info({port: PORT}, 'Server is listening.');
});
