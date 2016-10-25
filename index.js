'use strict';

// var newrelic = require('newrelic');

var bodyParser = require('body-parser');
var errors = require('restify-errors');
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

    var results = {
        compilation: '',
        execution: ''
    };
    executor.acquire((ex) => {
        logger.trace('Executor acquired.');
        var state = 'compilation';
        ex.on('output', (data) => results[state] += data.toString('utf8'));
        return ex.compile(req.body.code).then(() => {
            state = 'execution';
            return ex.execute();
        });
    }).then(() => {
        logger.debug(results, 'Done executing code.');
        res.send({status: 'success', results});
        next();
    }, (reason) => {
        if (reason instanceof Error) {
            logger.error({error: reason.stack}, 'Error executing code.');
            next(new errors.InternalServerError('Failed to process code.'));
        }
        else {
            logger.debug(results, 'Code not executable.');
            res.send({status: 'failure', reason, results});
            next();
        }
    });
});

server.on('after', (req, res) => {
    logger.debug({status: res.statusCode, url: req.url}, 'Served request.');
});

server.on('close', () => {
    logger.info('Server shut down.');
});

server.listen(PORT, () => {
    logger.info({port: PORT}, 'Server is listening.');
});
