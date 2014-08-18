var express = require("express");
var router = require("./router");
var url = require("url");

var STATIC_DIR = __dirname + '/../../static';

var PORT = 8000;

function handleRequest(req, res) {
    var path = url.parse(req.url).pathname;
    var requestHandler = router.getRequestHandler(path);
    if (requestHandler !== undefined) {
        requestHandler.handleRequest(req, res);
    } else {
        res.end();
    }
}

function start(port) {
    var app = express.createServer();
    if (!port) {
        port = PORT;
    }

    app.listen(port);
    app.set('views', __dirname + '/../views');

    //Set up directory for static files like css files
    app.use(express.static(STATIC_DIR));
    
    //Set up the ability to handle post requests
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    
    //GET handler
    app.get('/*',
    function(req, res) {
        handleRequest(req, res);
    });
    
    //POST handler
    app.post('/*',
    function(req, res) {
        handleRequest(req, res);
    });
}



exports.start = start;
