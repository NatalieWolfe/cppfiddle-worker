'use strict';

var bunyan = require('bunyan');

var logger = module.exports = bunyan.createLogger({name: 'cppfidle-worker'});
logger.level('debug');
