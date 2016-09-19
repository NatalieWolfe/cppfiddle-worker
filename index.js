'use strict';

// var newrelic = require('newrelic');

var Promise = require('bluebird');

var bodyParser = require('body-parser');
var errors = require('restify-errors');
var fs = Promise.promisifyAll(require('fs'));
var restify = require('restify');

var executor = require('./lib/executor');
var logger = require('./lib/logger').child({component: 'server'});

const PORT = process.env.PORT || 8181;


var server = restify.createServer({name: 'cppfiddle-worker', log: logger});

server.use(restify.CORS());
server.use(bodyParser.urlencoded({extended: true}));

server.post('/execute', function execute(req, res, next) {
    if (!req.body.code) {
        return next(new errors.BadRequestError('`code` is a required parameter.'));
    }
    logger.trace({code: req.body.code}, 'Executing code.');

    var results = {};
    fs.writeFileAsync('test.cpp', req.body.code)
        .finally(() => logger.trace('File written.'))
        .then(() => executor.acquire((ex) => {
            logger.trace('Executor acquired.');
            return ex.execute('g++ test.cpp')
                .then((compileResults) => {
                    results.compile = compileResults;
                    return true;
                }, (compileResults) => {
                    results.compile = compileResults;
                    return false;
                })
                .then((cont) => {
                    if (!cont) {
                        return;
                    }

                    return ex.execute('./a.out')
                        .then(
                            (runResults) => results.run = runResults,
                            (runResults) => results.run = runResults
                        )
                    ;
                })
            ;
        }))
        .then(
            () => {
                logger.debug(results, 'Done executing code.')
                res.send(results);
                next();
            },
            (err) => {
                logger.debug({error: err}, 'Failed to execute code.');
                next(new errors.InternalServerError('Failed to process code.'));
            }
        );
});

server.on('after', (req, res) => {
    logger.debug({status: res.statusCode, url: req.url}, 'Served request.')
});

server.on('close', () => {
    logger.info('Server shut down.');
})

server.listen(PORT, () => {
    logger.info({port: PORT}, 'Server is listening.');
});
