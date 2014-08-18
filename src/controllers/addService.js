var url = require("url");
var Service = require("../model/service").Service;
var logger = require("../helpers/logger").getInstance();
var serviceListener = require("../model/serviceListener");

function handleRequest(req, res) {
    var queryString = req.body;
    var service = new Service(0, queryString.name, queryString.interval, new Date(), new Date(), queryString.contacts, "enabled",
            queryString.app_server, queryString.app_server_url,queryString.db_user, queryString.db_port);
    logger.debug('new service: ' );

    service.addServiceToDb(function(newServiceWithId){
        serviceListener.addService(newServiceWithId);
        res.redirect('/viewServices');
    });
}

exports.handleRequest = handleRequest;