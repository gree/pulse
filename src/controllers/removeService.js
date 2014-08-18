var dbManager = require("../db/dbManager").getInstance();
var url = require("url");
var serviceStateBridge = require("../model/serviceStateBridge");

function handleRequest(req, res) {
    var queryString = req.body;
    //Add check with a callback to a reset of all health checks which then calls back to redirect the request to the view checks page
    dbManager.deleteService(queryString.id,
    function() {
        serviceStateBridge.resetServices(function() {
            res.redirect('/viewServices');
        });
    });

}

exports.handleRequest = handleRequest;