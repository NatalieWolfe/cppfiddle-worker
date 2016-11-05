'use strict';

// var newrelic = require('newrelic');

var config = require('config');
var http = require('http');

var logger = require('./lib/logger').child({component: 'server'});

var Socket = require('./lib/socket');

const PORT = config.get('server.port');


var server = http.createServer();
var io = require('socket.io')(server);

io.on('connect', (socket) => {
    var client = Socket.connected(socket);
    client.on('error', (err) => {
        client.logger.error({error: err}, 'Destroying errored client.');
        client.close();
    });
});

server.on('request', (req, res) => {
    // If this is a health check, respond immediately. Otherwise it is either a
    // socket connection (which socket.io will handle) or an invalid request
    // (which we'll let time out).
    if (req.url === '/ping') {
        res.write('pong');
        res.end();
    }
});

server.on('close', () => {
    logger.info('Server shut down.');
});

server.listen(PORT, () => {
    logger.info({port: PORT}, 'Server is listening.');
});
