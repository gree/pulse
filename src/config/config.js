var dbManager = require("../db/dbManager").getInstance();
var serviceListener = require("../model/serviceListener");
var ServiceMonitor = require("../model/serviceMonitor").ServiceMonitor;
var Service = require("../model/service").Service;
var ServiceClass = require("../model/service");
var Rules = require("../model/rules");
var HealthChecks = require("../model/checks");
var logger = require("../helpers/logger").getInstance();
var Templates = require("../model/template");

/**
 *  Setups up a timer that triggers every service_interval seconds
 *  and writes health checks to the database
 */
function startDBTimer(service) {
    var timer = setTimeout(function() {
        serviceListener.logServicesToDb(service.id);
        startDBTimer(service);
    }, service.interval * 1000);
    return timer;
}

function clearDBTimer(service, callback) {
    if(service.timer){
        clearTimeout(service.timer);
    }
    if(callback){
        callback();
    }
}

/**
 *  Rules Functions
 *
 */
function rulesCallback(err, results, fields) {
    var serviceMonitors = serviceListener.getServiceMonitors();
    // Clear out rules
    for (var service_id in serviceMonitors) {
        if (serviceMonitors[service_id].heartbeatTimers) {
            for (var i in serviceMonitors[service_id].heartbeatTimers) {
                clearTimeouts(serviceMonitors[service_id].heartbeatTimers[i]);
            }
        }
        serviceMonitors[service_id].rules = [];
    }

    
    for (var i in results) {
        var result = results[i];
        var service = result.service_id;
        var Rule = eval('Rules.' + result.rule);
        if (Rule === undefined) {
            logger.error(result.rule + " Rule for service " + service + " does not exist, skipping...");
            continue;
        }
        // We are storing the date as PST, but it will come back thinking its GST, so add the difference
        var timeCreated = new Date(result.time_created.getTime() + result.time_created.getTimezoneOffset() * 60000);
        var timeModified = new Date(result.time_modified.getTime() + result.time_modified.getTimezoneOffset() * 60000);
        var rule = new Rule('', result.rule_value, timeCreated, timeModified, result.rule_type, result.id, result.service_id, result.rule);
        if (serviceMonitors[service_id] === undefined) {
            serviceMonitors[service_id] = new ServiceMonitor(service_id);
        }
        serviceMonitors[service_id].addRule(rule);
    }
}

function populateRules(callback) {
    dbManager.getRules(function(err, results, fields) {
        rulesCallback(err, results, fields);
        callback();
    });
}


/**
 *      Health Check functions
 *
 */
function healthCheckCallback(err, results, fields) {
    if (err) {
        logger.error(err);
        return;
    }
    var serviceMonitors = serviceListener.getServiceMonitors();

    // Clear out existing healthChecks and the timers associated with them
    for (var service_id in serviceMonitors) {
        serviceMonitors[service_id].reset();
    }
    
    for (var i in results) {
        
        var result = results[i];
        var service_id = result.service_id;
        var HealthCheck = HealthChecks[result.check_type];
        if (HealthCheck === undefined) {
            logger.error(" Health Check for service " + service_id + " does not exist, skipping check_type: " + result.check_type);
            continue;
        }
        // We are storing the date as PST, but it will come back thinking its GST, so add the difference
        result.time_created= new Date(result.time_created.getTime() + result.time_created.getTimezoneOffset() * 60000);
        result.time_modified = new Date(result.time_modified.getTime() + result.time_modified.getTimezoneOffset() * 60000);
        var healthCheck = HealthChecks.createHealthCheckFromDatabaseResult(result);
        healthCheck.reset();
        if (serviceMonitors[service_id] === undefined) {
            serviceMonitors[service_id] = new ServiceMonitor(service_id);
        }
        serviceMonitors[service_id].addHealthCheck(healthCheck);
        if(healthCheck.status == "disabled"){
            var healthCheckState = serviceMonitors[service_id].getCurrentCheckStateByCheckId(healthCheck.id);
            if(!healthCheckState){
                healthCheckState = healthCheck.getHealthCheckState();
            }
            healthCheckState.state = StateEnum.DISABLED;
            serviceMonitors[service_id].updateCheckState(healthCheckState);
        }
    }
}

function populateHealthChecks(callback) {
    dbManager.getAllHealthChecks(function(err, results, fields) {
        healthCheckCallback(err, results, fields);
        callback();
    });
}


/**
 *   Service State History Functions
 *
 */
function populateServiceHistory(serviceId, checkId, state, limit, offset, callback) {
    dbManager.getServiceHistory(serviceId, checkId, state, limit, offset, function(err, results, fields) {
        if (err) {
            logger.error(err);
            return;
        }
        
        if (callback) {
            callback(err, results, fields);
        }
    });
}

/**
 *    Service Functions
 *
 */
function servicesCallback(err, results, fields) {
    var services = serviceListener.getServices();
    if (services !== undefined) {
        // Reset timeout for all of the services
        for (var i in services) {
            var service = services[i];
            if (service.timer) {
                clearTimeout(service.timer);
            }
        }
    }
    services = {};
    serviceListener.setServices(services);

    for (var i in results) {
        var result = results[i];
        // We are storing the date as PST, but it will come back thinking its GST, so add the difference 
        var timeCreated = new Date(result.time_created.getTime() + result.time_created.getTimezoneOffset() * 60000);
        var timeModified = new Date(result.time_modified.getTime() + result.time_modified.getTimezoneOffset() * 60000);
        var service = ServiceClass.createServiceFromDatabaseResult(result);
        //var service = new Service(result.id, result.name, result.interval_s, timeCreated, timeModified, result.contacts,result.status);
        services[service.id] = service;
        //service.timer = startDBTimer(service);
    }
    
    populateRules(function() {});
    populateHealthChecks(function() {});
    populateTemplates(function() {});
}

function populateServices(callback) {
    dbManager.getServices(function(err, results, fields) {
        servicesCallback(err, results, fields);
        callback();
    });
}

function templatesCallback(err, results, fields){
    for(var i in results){
        var result = results[i];
        var Template = Templates.Template;
        if(result.type){
            Template = Templates[result.type];
        }
        var template = new Template();
        template.init(result.id, result.type, result.name, result.subject, result.body, result.timeCreated, result.timeModified);
        Templates.addTemplate(template);
    }
}
function populateTemplates(callback){
    dbManager.getAllTemplates(function(err, results, fields) {
        templatesCallback(err, results, fields);
        callback();
    });
}


function resetRules(callback) {
    populateRules(callback);
}


function resetHealthChecks(callback) {
    populateHealthChecks(callback);
}


function resetServices(callback) {
    populateServices(callback);
}


populateServices(function() {});

exports.populateServiceHistory = populateServiceHistory;
exports.resetRules = resetRules;
exports.resetHealthChecks = resetHealthChecks;
exports.resetServices = resetServices;
exports.clearDBTimer = clearDBTimer;
exports.startDBTimer = startDBTimer;