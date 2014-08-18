var url = require("url");
var config = require("../config/config");
var serviceListener = require("../model/serviceListener");
var StateEnum = require("../model/rules").StateEnum;
var logger = require("../helpers/logger").getInstance();

function handleRequest(req, res) {
    var queryString = req.body;
    var service = serviceListener.getService(queryString.id);
    if(!service){
        logger.error("Service not found with id " + queryString.id);
    }
    else{
        service.disableService();
    }
    res.redirect('/viewServices');
}

exports.handleRequest = handleRequest;