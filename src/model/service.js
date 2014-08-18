var serviceListener = require("../model/serviceListener");
var JsonModel = require("./jsonModel");
var util = require("util");
var config = require("../config/config");
var dbManager = require("../db/dbManager").getInstance();

util.inherits(Service, JsonModel.JsonModel);

Service.jsonFields = {
        app_server: ['string'],
        app_server_url: ['string'],
        db_port: ['string'],
        db_user: ['string']
}

Service.prototype.getJsonFields = function () {
    return Service.jsonFields;
}

function Service(id, name, interval, timeCreated, timeModified, contacts,status,app_server,app_server_url,db_user,db_port) {
    this.id = id;
    this.name = name;
    this.interval = interval;
    this.contacts = contacts;
    this.timeCreated = timeCreated;
    this.timeModified = timeModified;
    this.timePersisted = new Date();
    this.status = status;
    this.app_server = app_server;
    this.app_server_url = app_server_url;
    this.db_user = db_user;
    this.db_port = db_port;
}

Service.prototype.updateService = function(fields){
    if(fields){
        for(var x in fields){
            this[x] = fields[x];
        }
        dbManager.editService(this);
    }
};

Service.prototype.addServiceToDb = function(callback){
    var service = this;
    dbManager.addService(service, function(err,results,fields) {
        service.id = results.insertId;
        if(callback){
            callback(service);
        }
    });
};

Service.prototype.enableService = function(){
    this.status = "enabled";
    var serviceMonitor = serviceListener.getServiceMonitor(this.id);
    if(serviceMonitor){ // enable all healthchecks
        for (x in serviceMonitor.healthChecks){
            if(serviceMonitor.healthChecks[x].status != "enabled"){
                serviceMonitor.healthChecks[x].status = "enabled";
                serviceMonitor.healthChecks[x].check();
                var healthCheckState = serviceMonitor.getCurrentCheckStateByCheckId(serviceMonitor.healthChecks[x].id);
                if(!healthCheckState){
                    healthCheckState = serviceMonitor.healthChecks[x].getHealthCheckState();
                }
                healthCheckState.state = StateEnum.PROCESSING;
                serviceMonitor.updateCheckState(healthCheckState);
                serviceListener.logHealthCheckStateToDb(serviceMonitor.healthChecks[x].id, serviceMonitor.healthChecks[x].service_id);
            }
        }
        dbManager.enableAllHealthchecks(this.id);
    }
    //config.startDBTimer(this);
    dbManager.editService(this);
};

Service.prototype.disableService = function(){
    this.status = "disabled";
    //config.clearDBTimer(this);
    var serviceMonitor = serviceListener.getServiceMonitor(this.id);
    if(serviceMonitor){ // disable all healthchecks
        for (x in serviceMonitor.healthChecks){
            if(serviceMonitor.healthChecks[x].status != "disabled"){
                serviceMonitor.healthChecks[x].status = "disabled";
                serviceMonitor.healthChecks[x].reset();
                var healthCheckState = serviceMonitor.getCurrentCheckStateByCheckId(serviceMonitor.healthChecks[x].id);
                if(!healthCheckState){
                    healthCheckState = serviceMonitor.healthChecks[x].getHealthCheckState();
                }
                healthCheckState.state = StateEnum.DISABLED;
                serviceMonitor.updateCheckState(healthCheckState);
                serviceListener.logHealthCheckStateToDb(serviceMonitor.healthChecks[x].id, serviceMonitor.healthChecks[x].service_id);
            }
        }
        dbManager.disableAllHealthchecks(this.id);
    }
    dbManager.editService(this);
};


function ServiceState() {
    this.ruleStates = {};
    this.checkStates = {};
}

function createServiceFromDatabaseResult(result){
    var timeCreated = new Date(result.time_created.getTime() + result.time_created.getTimezoneOffset() * 60000);
    var timeModified = new Date(result.time_modified.getTime() + result.time_modified.getTimezoneOffset() * 60000);
    var service = new Service(result.id, result.name, result.interval_s, timeCreated, timeModified, result.contacts,result.status);
    service.payload = result.payload;
    service.decode();
    return service;
}

exports.ServiceState = ServiceState;
exports.Service = Service;
exports.createServiceFromDatabaseResult = createServiceFromDatabaseResult;