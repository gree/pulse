var dbManager = require("../db/dbManager").getInstance();
var url = require("url");
var serviceListener = require("../model/serviceListener");
var helpers = require("../helpers/helpers");
var logger = require("../helpers/logger").getInstance();
var StateEnum = require("../model/rules").StateEnum;
var ServiceMonitor = require("../model/serviceMonitor").ServiceMonitor;
var Checks = require("../model/checks");

function handleRequest(req, res) {
    logger.info("editCheck called " + req.method);
    
    if (req.method != "POST") {
        logger.error("WARN: editCheck called as " + req.method + " request.");
        return;
    }
    
    var queryString = req.body;
    var action = queryString.action;

    if (action === undefined) {
        logger.error("No action specified for editCheck.");
        return;
    }
    
    // Initialize a health check if we are adding or editing a health check
    if (helpers.inArray(action,['add', 'edit', 'copy'])) {
        // Setup value if we have a database health check with operator
        var value = queryString.value;
        if (queryString.check_type == "DatabaseHealthCheck" || queryString.check_type == "VerticaHealthCheck") {
            var operator = queryString.operator;
            if (value) {
                value = operator + value;
            }
        }
        
        // Generate json object based on BI data
        var businessintelligence = null;
        if (queryString.check_type == "BusinessIntelligenceCheck") {
            queryString.property = queryString.bi_database;
            
            var bi = new Object();
            bi.lowervaluebound = new Object();
            bi.uppervaluebound = new Object();
            
            bi.lowervaluebound.isQuery = queryString.bi_lowerbound_isquery;
            bi.uppervaluebound.isQuery = queryString.bi_upperbound_isquery;
            
            if(queryString.bi_lowerbound_isquery != "TRUE"){
                bi.lowervaluebound.isQuery = "FALSE";
            }
            if(queryString.bi_upperbound_isquery != "TRUE"){
                bi.uppervaluebound.isQuery = "FALSE";
            }
            
            bi.lowervaluebound.value = queryString.bi_lowerbound;
            bi.uppervaluebound.value = queryString.bi_upperbound;
            
            businessintelligence = bi; //JSON.stringify(bi);
        }
        if (helpers.inArray(action,['add', 'copy'])) {
            if (action == 'copy'){
                queryString.id =0;
                queryString.timeCreated = new Date();
            }
            var Check = Checks.HealthCheck;
            if (queryString.check_type !== '') {
                Check =  Checks[queryString.check_type];
            }
            if (Check === undefined) {
                logger.error("ERROR - Check Type " + check_type + " does not exist.");
                res.redirect(queryString.referrer);
                return;
            }
            healthCheck = new Check();
            healthCheck.init(queryString.id, queryString.check_type, queryString.service_id, queryString.name, parseInt(queryString.period),
                    value, queryString.property, queryString.path, queryString.email, queryString.notificationDelay, queryString.timeCreated, new Date(), businessintelligence,queryString.dependent_checks, queryString.email_template, queryString.sms_template);
            
            if (healthCheck === undefined) {
                logger.error("Could not create health check from POST request");
                res.redirect(queryString.referrer);
                return;
            }
        }
    }
    
    
    if (action == 'add' || action == 'copy') {
        
        logger.info("Adding new " + queryString.check_type + " " + queryString.name);
        // Add check with a callback to a reset of all health checks which then calls back to redirect the request to the view checks page
        dbManager.addHealthCheck(healthCheck, function(err,results,fields) {
            healthCheck.id = results.insertId;
            var serviceMonitors = serviceListener.getServiceMonitors();
            healthCheck.status = "enabled";
            if (serviceMonitors[queryString.service_id] === undefined) {
                serviceMonitors[queryString.service_id] = new ServiceMonitor(queryString.service_id);
            }
            serviceMonitors[queryString.service_id].addHealthCheck(healthCheck);
            res.redirect(queryString.referrer);
        });
    } else if (action == 'edit') {
        logger.info("Editing " + queryString.check_type + " " + queryString.name);
        // Edit check with a callback to update the health check
        var serviceMonitors = serviceListener.getServiceMonitors();
        var serviceMonitor;
        var oldHealthCheck = serviceListener.getHealthCheck(queryString.id, queryString.service_id);
        if (!oldHealthCheck){ // means its a new service id, remove the old one
            oldHealthCheck = serviceListener.getHealthCheck(queryString.id);
            serviceListener.removeHealthCheck(oldHealthCheck.serviceMonitor.service_id,oldHealthCheck.id);
            oldHealthCheck.status = "enabled";
        }
        oldHealthCheck.reset();
        oldHealthCheck.init(queryString.id, queryString.check_type, queryString.service_id, queryString.name, parseInt(queryString.period),
                value, queryString.property, queryString.path, queryString.email, queryString.notificationDelay, queryString.timeCreated, new Date(), 
                businessintelligence, queryString.dependent_checks,oldHealthCheck.configs, oldHealthCheck.status,queryString.email_template,queryString.sms_template);
        if (serviceMonitors[queryString.service_id] === undefined) {
            serviceMonitors[queryString.service_id] = new ServiceMonitor(queryString.service_id);
        }
        serviceMonitors[queryString.service_id].addHealthCheck(oldHealthCheck); // add the new one
        dbManager.editHealthCheck(oldHealthCheck, function() {
            res.redirect(queryString.referrer);
        });
    } else if (action == 'remove') {
        logger.info("Removing health check id " + queryString.id);
        // Remove check with a callback to a reset of all health checks which then calls back to redirect the request to the view checks page
        var healthCheck = serviceListener.getHealthCheck(queryString.id, queryString.service_id);
        healthCheck.timeModified = new Date();
        if(healthCheck.status != "disabled"){
            dbManager.disableHealthCheck(queryString.id,
            function() {
                healthCheck.status = "disabled";
                healthCheck.reset();
                var healthCheckState = healthCheck.serviceMonitor.getCurrentCheckStateByCheckId(healthCheck.id);
                healthCheckState.state = StateEnum.DISABLED;
                healthCheck.serviceMonitor.updateCheckState(healthCheckState);
                serviceListener.logHealthCheckStateToDb(healthCheck.id, healthCheck.service_id);
                res.redirect(queryString.referrer);
            });
        }
        else{
            dbManager.enableHealthCheck(queryString.id,
            function() {
                healthCheck.status = "enabled";
                var healthCheckState = healthCheck.serviceMonitor.getCurrentCheckStateByCheckId(healthCheck.id);
                healthCheckState.state = StateEnum.PROCESSING;
                healthCheck.serviceMonitor.updateCheckState(healthCheckState);
                healthCheck.check();
                res.redirect(queryString.referrer);
            });
        }
        
    }

}

exports.handleRequest = handleRequest;
