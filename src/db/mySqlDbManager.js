var dateFormat = require('dateformat');
var Client = require('mysql').Client;
var logger = require("../helpers/logger").getInstance();
var environment = require("../config/environment").getInstance();

//String used to convert a javascript DATE into a DATETIME
var DATETIME_FORMAT_STRING = "yyyy-mm-dd HH:MM:ss";
var DATABASE = 'pulse';
var DATA_TABLE = 'aggregated_health_data';
var RULE_TABLE = 'rule_config';
var HEALTH_CHECK_TABLE = 'health_check';
var SERVICES_TABLE = 'services';
var TEMPLATE_TABLE = 'templates';
var USER = "root";
var PASSWORD = "";
var HOST;
var PORT;

var clients = [];

environment.getPulseDbDetails(function(pulseDbDetails){
    USER = pulseDbDetails["user"];
    PASSWORD = pulseDbDetails["password"];
    HOST = pulseDbDetails["host"];
    PORT = pulseDbDetails["port"];
});

function executeQuery(queryString, params, callback, database, user, password) {
    var client = getClient(database, user, password);
    client.query(queryString, params, callback);
}

function getClient(database, user, password) {
    if (clients[database]) {
        return clients[database];
    }
    //set up db
    var client = new Client();
    if(HOST && PORT){
        client.host = HOST;
        client.port = PORT;
    }
    
    if (user) {
        client.user = user;
    } else {
        client.user = USER;
    }
    if (password) {
        client.password = password;
    } else {
        client.password = PASSWORD;
    }
    if (database !== null) {
        if (database) {
            client.useDatabase(database);
        } else {
            client.useDatabase(DATABASE);
        }
    }
    client.on('error', function(err) {
        logger.error('database error: ');
        logger.error(err);
    });
    client.on('end', function(){
        clients[database] = false;
        logger.error("database connection ended: " + database);
    });
    clients[database] = client;
    return client;
}

function initDatabase(callback) {
    var create_database = "CREATE DATABASE IF NOT EXISTS " + DATABASE;
    executeQuery(create_database, [], callback, null, USER, PASSWORD);
    initTables();
}

function initTables() {
    var callback = function() {};
    var rule_config = "CREATE TABLE IF NOT EXISTS " + RULE_TABLE + 
        " (id BIGINT AUTO_INCREMENT," +
        "service_id BIGINT," +
        "rule TEXT," +
        "rule_value BIGINT," +
        "time_created DATETIME," +
        "time_modified DATETIME," +
        "rule_type VARCHAR(255),PRIMARY KEY (id));";
    executeQuery(rule_config, [], callback);

    var health_check = "CREATE TABLE IF NOT EXISTS " + HEALTH_CHECK_TABLE +
        "(id BIGINT AUTO_INCREMENT," +
        "service_id BIGINT," +
        "check_type TEXT," +
        "payload TEXT," +
        "time_created DATETIME," +
        "time_modified DATETIME," +
        "status TEXT," +
        "PRIMARY KEY(id));";
    executeQuery(health_check, [], callback);

    var services = "CREATE TABLE IF NOT EXISTS " + SERVICES_TABLE + 
        " (id BIGINT AUTO_INCREMENT," +
        "name VARCHAR(255)," +
        "interval_s BIGINT," +
        "contacts TEXT," +
        "time_created DATETIME," +
        "time_modified DATETIME," +
        "status TEXT," +
        "payload TEXT," +
        "PRIMARY KEY (id));";
    executeQuery(services, [], callback);

    var aggregated_health_data  = 'CREATE TABLE IF NOT EXISTS ' + DATA_TABLE +
        ' (id BIGINT AUTO_INCREMENT, service_id BIGINT, rule_id BIGINT, type INT,' +
        ' value BIGINT, state INT, details TEXT, timestamp DATETIME,PRIMARY KEY (id));';
    executeQuery(aggregated_health_data, [], callback);
    
    var templates = 'CREATE TABLE IF NOT EXISTS ' + TEMPLATE_TABLE +
        ' (id BIGINT AUTO_INCREMENT, type TEXT, name TEXT, subject TEXT, ' + 
        'body TEXT, time_created DATETIME, time_modified DATETIME, PRIMARY KEY (id))';
    
    executeQuery(templates, [], callback);
}

function getDataTableName() {
    return DATA_TABLE;
}

function getServiceHistory(serviceId, checkId, state, limit, offset, callback) {
    limit = limit ? limit : 21;
    
    var query = 'SELECT * FROM ' + DATA_TABLE;
    if (serviceId !== undefined) {
        // Filter history by service_id
        query += ' WHERE service_id = ' + serviceId;
        if (checkId !== undefined) {
            // Filter history by rule_id
            query += ' AND rule_id = ' + checkId;
        }

        if (state !== undefined && state > 0) {
            query += ' AND state = ' + state;
        }
    }
    
    // Order the results by timestamp
    query += ' ORDER BY timestamp DESC';
    
    // Add a limit and offset to support pagination
    query += ' LIMIT ' + limit;
    if (offset !== undefined) {
         query += ' OFFSET ' + offset;
    }
    
    executeQuery(query, [], callback);
}

function getFailedHistory(limit, offset, callback) {
    limit = limit ? limit : 21;
    
    var query = 'SELECT * FROM ' + DATA_TABLE + 
                ' WHERE state = 2 ORDER BY timestamp DESC' +
                ' LIMIT ' + limit + ' OFFSET ' + offset;
    
    executeQuery(query, [], callback);
}

/**  
 *   Gets the count to help with pagination
 */
function getServiceHistoryCount(serviceId, checkId, state, serviceHistory, callback) {
    var countQuery = 'SELECT count(*) FROM ' + DATA_TABLE;
    if (serviceId !== undefined) {
        // Filter history by service_id
        countQuery += ' WHERE service_id = ' + serviceId;
        if (checkId !== undefined) {
            // Filter history by rule_id
            countQuery += ' AND rule_id = ' + checkId;
        }

        if (state !== undefined && state > 0) {
            countQuery += ' AND state = ' + state;
        }
    }
    
    executeQuery(countQuery, [], function(err, results, fields) {
            if (callback) {
                callback(err, serviceHistory, results[0]['count(*)']);
            }
        });

}

function getRules(configCallback) {
    executeQuery('SELECT * FROM ' + RULE_TABLE, [], configCallback);
}

function getAllHealthChecks(configCallback) {
    executeQuery('SELECT * FROM ' + HEALTH_CHECK_TABLE, [], configCallback);
}

function getServices(configCallback) {
    executeQuery('SELECT * FROM ' + SERVICES_TABLE, [], configCallback);
}


/**
 * Rule Database Handling
 */
function addRule(rule, configCallback) {
    var formattedDate = dateFormat(new Date(), DATETIME_FORMAT_STRING);

    executeQuery('INSERT INTO ' + RULE_TABLE +
    ' SET service_id=?,rule=?,rule_value=?,time_created=?,time_modified=?,rule_type=?',
    [rule.service_id, rule.ruleName, rule.value, formattedDate, formattedDate, rule.ruleType], configCallback);
}

function editRule(rule, configCallback) {
    var formattedDate = dateFormat(new Date(), DATETIME_FORMAT_STRING);

    executeQuery('UPDATE ' + RULE_TABLE +
    ' SET service_id=?,rule=?,rule_value=?,time_modified=?' +
    ' WHERE id =?',
    [rule.service_id, rule.ruleName, rule.value, formattedDate, rule.id], configCallback);
}

function deleteRule(ruleId, configCallback) {
    executeQuery('DELETE from ' + RULE_TABLE +
    ' WHERE id = ?',
    [ruleId], configCallback);
}

/**
 * Check Database Handling
 */

function addHealthCheck(healthCheck, configCallback) {
    var formattedDate = dateFormat(new Date(), DATETIME_FORMAT_STRING);
    healthCheck.encode();
    executeQuery('INSERT INTO ' + HEALTH_CHECK_TABLE +
    ' SET service_id=?,check_type=?,payload=?,time_created=?,time_modified=?,status=?',
    [healthCheck.service_id, healthCheck.check_type, healthCheck.payload, formattedDate, formattedDate,"enabled"], configCallback);
}

function editHealthCheck(healthCheck, configCallback) {
    var formattedDate = dateFormat(new Date(), DATETIME_FORMAT_STRING);
    healthCheck.encode();
    executeQuery('UPDATE ' + HEALTH_CHECK_TABLE +
    ' SET service_id=?,check_type=?,payload=?,time_modified=?,status=?' +
    ' WHERE id =?',
    [healthCheck.service_id, healthCheck.check_type, healthCheck.payload, formattedDate, healthCheck.status, healthCheck.id], configCallback);
}

function deleteHealthCheck(healthCheckId, configCallback) {
    executeQuery('DELETE from ' + HEALTH_CHECK_TABLE +
    ' WHERE id = ?',
    [healthCheckId], configCallback);
}

function disableHealthCheck(healthCheckId, configCallback) {
    var formattedDate = dateFormat(new Date(), DATETIME_FORMAT_STRING);
    executeQuery('UPDATE ' + HEALTH_CHECK_TABLE +
    ' SET time_modified = ?, status = ? WHERE id = ?',
    [formattedDate, "disabled", healthCheckId], configCallback);
}

function disableAllHealthchecks(serviceId, configCallback) {
    var formattedDate = dateFormat(new Date(), DATETIME_FORMAT_STRING);
    executeQuery('UPDATE ' + HEALTH_CHECK_TABLE +
    ' SET time_modified = ?, status = ? WHERE service_id = ?',
    [formattedDate, "disabled", serviceId], configCallback);
}

function enableAllHealthchecks(serviceId, configCallback) {
    var formattedDate = dateFormat(new Date(), DATETIME_FORMAT_STRING);
    executeQuery('UPDATE ' + HEALTH_CHECK_TABLE +
    ' SET time_modified = ?, status = ? WHERE service_id = ?',
    [formattedDate, "enabled", serviceId], configCallback);
}

function enableHealthCheck(healthCheckId, configCallback) {
    var formattedDate = dateFormat(new Date(), DATETIME_FORMAT_STRING);
    executeQuery('UPDATE ' + HEALTH_CHECK_TABLE +
    ' SET time_modified = ?, status = ? WHERE id = ?',
    [formattedDate, "enabled", healthCheckId], configCallback);
}

/**
 *   Service database Handling
 *
 */
function addService(service, configCallback) {
    var formattedDate = dateFormat(new Date(), DATETIME_FORMAT_STRING);
    service.encode();
    executeQuery('INSERT INTO ' + SERVICES_TABLE +
    ' SET name=?,interval_s=?,contacts=?,time_created=?,time_modified=?,status=?,payload=?',
    [service.name, service.interval, service.contacts, formattedDate, formattedDate,service.status,service.payload], configCallback);
}

function editService(service, configCallback) {
    var formattedDate = dateFormat(new Date(), DATETIME_FORMAT_STRING);
    service.encode();
    console.log(service.payload);
    executeQuery('UPDATE ' + SERVICES_TABLE +
    ' SET name=?,interval_s=?,contacts=?,time_modified=?,status=?,payload=?' +
    ' WHERE id =?',
    [service.name, service.interval,service.contacts,formattedDate, service.status,service.payload, service.id], configCallback);
}

function deleteService(serviceId, configCallback) {
    executeQuery('DELETE from ' + SERVICES_TABLE +
    ' WHERE id = ?',
    [serviceId], configCallback);
}

function saveServiceState(serviceMonitor, service) {
    var tableName = getDataTableName();
    var serviceState = serviceMonitor.serviceState;
    var formattedDate = dateFormat(new Date(), DATETIME_FORMAT_STRING);
    var interval = service.interval;
    if (interval < 30) {
        interval = 30;
    }
    var curTime = new Date().getTime();
    var cutoff = curTime - interval * 1000;
    var checkStates = serviceState.checkStates;
    if (service.timePersisted && service.timePersisted.getTime() > cutoff) {
        //logger.info('data already persisted interval: ' + interval +  ' service last persisted time: ' + dateFormat(service.timePersisted, DATETIME_FORMAT_STRING));
        return;
    }

    for (var id in checkStates) {
        var healthCheck = serviceMonitor.getHealthCheck(id);
        var history = checkStates[id];
        if (history && history.length > 0) {
            var checkState = history[history.length-1];
            if (checkState && checkState.lastReceived && checkState.lastReceived.getTime() >= cutoff) {
                executeQuery('INSERT INTO ' + tableName +
                ' SET service_id=?,value=?,state=?,timestamp=?,rule_id=?,type=?,details=?',
                [checkState.healthCheck.service_id, 0, checkState.state, formattedDate, checkState.healthCheck.id, 1, checkState.getDisplayDetails()]);
                healthCheck.timePersisted = new Date();
            }
        }
    }
    service.timePersisted = new Date();
}

function saveHealthCheckState(check_id, serviceMonitor) {
    if(!check_id || !serviceMonitor){
        logger.error("can't save healthcheck state, both parameters required");
        return;
    }
    
    var serviceState = serviceMonitor.serviceState;
    if(!serviceState){
        logger.error("No service state exists " + check_id);
        return;
    }
    
    var checkStates = serviceState.checkStates;
    if(!checkStates){
        logger.error("No states exists " + check_id);
        return;
    }
    
    var tableName = getDataTableName();
    var formattedDate = dateFormat(new Date(), DATETIME_FORMAT_STRING);
    var healthCheck = serviceMonitor.getHealthCheck(check_id);
    if(!healthCheck){
        logger.error("healthcheck not found " + check_id);
        return;
    }
    
    var history = checkStates[check_id];
    if(!history){
        logger.error("No history found " + check_id);
        return;
    }
 
    var checkState;
    if (history.length > 0) {
        checkState = history[history.length-1];
    }
    var previousState;
    if (history.length > 1) {
        previousState = history[history.length-2];
    }
    if(checkState && previousState && (checkState.state != 2 && (checkState.state == previousState.state))){ // if current state is not failing, don't save if the previous state was also not failing.
        return;
    }
    if(checkState.state == 2){
        if(previousState && previousState.state == 2){ // if current state is failing, don't save if previous state was also failing with the same errors
            if(checkState.getDisplayDetails() == previousState.getDisplayDetails()){
                return;
            }
        }
    }
    executeQuery('INSERT INTO ' + tableName +
    ' SET service_id=?,value=?,state=?,timestamp=?,rule_id=?,type=?,details=?',
    [healthCheck.service_id, 0, checkState.state, formattedDate, healthCheck.id, 1, checkState.getDisplayDetails()]);
    healthCheck.timePersisted = new Date();
}

function addTemplate(template, callback){
    executeQuery("INSERT INTO " + TEMPLATE_TABLE + " SET type=?,name=?,subject=?,body=?,time_created=?,time_modified=?", 
                [template.type, template.name,template.subject,template.body,template.timeCreated,template.timeModified],callback);
}

function editTemplate(template, callback){
    executeQuery("UPDATE " + TEMPLATE_TABLE + " SET type=?,name=?,subject=?,body=?,time_created=?,time_modified=? WHERE id=?", 
                [template.type, template.name,template.subject,template.body,template.timeCreated,template.timeModified,template.id],callback);
}

function getAllTemplates(callback){
    executeQuery("SELECT * FROM " + TEMPLATE_TABLE, [], callback);
}

exports.addRule = addRule;
exports.deleteRule = deleteRule;
exports.editRule = editRule;
exports.getRules = getRules;
exports.getServiceHistory = getServiceHistory;
exports.getFailedHistory = getFailedHistory;
exports.getAllHealthChecks = getAllHealthChecks;
exports.getServices = getServices;
exports.initDatabase = initDatabase;
exports.initTables = initTables;
exports.addHealthCheck = addHealthCheck;
exports.editHealthCheck = editHealthCheck;
exports.deleteHealthCheck = deleteHealthCheck;
exports.disableHealthCheck = disableHealthCheck;
exports.disableAllHealthchecks = disableAllHealthchecks;
exports.enableAllHealthchecks = enableAllHealthchecks;
exports.enableHealthCheck = enableHealthCheck;
exports.addService = addService;
exports.editService = editService;
exports.deleteService = deleteService;
exports.saveServiceState = saveServiceState;
exports.saveHealthCheckState = saveHealthCheckState;
exports.executeQuery = executeQuery;
exports.addTemplate = addTemplate;
exports.editTemplate = editTemplate;
exports.getAllTemplates = getAllTemplates;
