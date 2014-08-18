var url = require("url");
var config = require("../config/config");
var serviceListener = require("../model/serviceListener");
var logger = require("../helpers/logger").getInstance();

function handleRequest(req, res) {
    var queryString = req.body;
    var service = serviceListener.getService(queryString.id);
    if(!service){
        logger.error("Service not found with id " + queryString.id);
    }
    else{
        var fields = buildServiceFields(queryString.name, queryString.interval,new Date(), queryString.contacts,service.status,queryString.app_server,queryString.app_server_url,queryString.db_user, queryString.db_port);
        service.updateService(fields);
    }
    res.redirect('/viewServices');
}

function buildServiceFields(name, interval,timeModified, contacts,status, app_server, app_server_url, db_user, db_port){
    var fields = {};
    fields["name"] = name;
    fields["interval"] = interval;
    fields["timeModified"] = timeModified;
    fields["timePersisted"] = new Date();
    fields["contacts"] = contacts;
    fields["status"] = status;
    fields["app_server"] = app_server;
    fields["app_server_url"] = app_server_url;
    fields["db_user"] = db_user;
    fields["db_port"] = db_port;
    
    return fields;
}

exports.handleRequest = handleRequest;