var dgram = require('dgram');
var logger = require("../helpers/logger").getInstance();

var UDP_PORT = 8001;

function start(serviceHandler) {

    socket = dgram.createSocket("udp4",
    function(msg, peer) {
        var obj = JSON.parse(msg);
        serviceHandler.handleMessage(obj);
    });

    socket.on('listening',
    function() {
        logger.info('Bound to ' + UDP_PORT);
    });

    socket.bind(UDP_PORT);


}

exports.start = start;
