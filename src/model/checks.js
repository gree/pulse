var http = require("http");
var https = require("https");
var StateEnum = require("./rules").StateEnum;
var util = require("util");
var JsonModel = require("./jsonModel");
var Client = require('mysql').Client;
var Memcached = require('memcached');
var HealthCheckState = require('./healthCheckState').HealthCheckState;
var logger = require("../helpers/logger").getInstance();
var configFetcher = require("../helpers/configFetcher");
var Vertica = require('vertica');
var sprintf = require('sprintf').sprintf;
var serviceListener = require("./serviceListener");
var passwords = require("../config/passwords");
var verticaQuery = require("../model/verticaQuery");
var helpers = require("../helpers/helpers");

Memcached.config.timeout = 20000; // setting higher timout as some servers are slower to connect from pulse server

var HTTP_TIMEOUT = 30000;
var stateIds = [];
HealthCheck.dynamic_db_configs = [];
function HealthCheck() { }

util.inherits(HealthCheck, JsonModel.JsonModel);

HealthCheck.prototype.init = function (id, check_type, service_id, name, period, value, property, path, email, notificationDelay, timeCreated, timeModified, 
                                       businessintelligence, dependent_checks, dynamic_config,status, email_template, sms_template) {
    // Database fields
    this.id = id;
    this.service_id = service_id;
    this.check_type = check_type;
    this.timeCreated = timeCreated;
    this.timeModified = timeModified;
    this.timePersisted = new Date();

    // Json Fields
    this.name = name;
    this.value = value;
    this.property = property;
    this.path = path;
    this.period = period;
    this.email = email;
    this.notificationDelay = notificationDelay;
    this.failingSince = null;
    this.businessintelligence = businessintelligence;
    this.dependent_checks = dependent_checks;
    if(dynamic_config && dynamic_config !== undefined){
        this.dynamic_config = "";
        for(x in dynamic_config){
            this.dynamic_config+= dynamic_config[x] + ",\n";
        }
    }
    this.status = status;
    this.email_template = email_template;
    this.sms_template = sms_template;
}

HealthCheck.prototype.loadResult = function(result) {
    this.id = result.id;
    this.service_id = result.service_id;
    this.check_type = result.check_type;
    this.timeCreated = result.time_created;
    this.timeModified = result.time_modified;
    this.email = '';
    this.payload = result.payload;
    this.timer = 0;
    this.notificationTimer =0;
    this.timePersisted = new Date();
    this.failingSince = null;
    this.notificationDelay = 300;
    this.decode();
    this.status = result.status;
}

HealthCheck.jsonFields = {
        name: ['string'],
        value: ['string'],
        property: ['string'],
        path : ['string'],
        email : ['string'],
        period: ['int'],
        notificationDelay: ['int'],
        businessintelligence: ['object'], // @TODO: Use more generic name / structure for future additions
        dependent_checks: ['object'],
        email_template: ['int'],
        sms_template: ['int']
}

HealthCheck.prototype.initCheck = function(serviceMonitor) {
    this.serviceMonitor = serviceMonitor;
    if(this.status !== "disabled"){
        this.check();
    }
}

HealthCheck.prototype.getJsonFields = function () {
    return HealthCheck.jsonFields;
}

HealthCheck.prototype.reset = function() {
    if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
    }
    if (this.notificationTimer) {
        clearTimeout(this.notificationTimer);
        this.notificationTimer = null;
    }
}

HealthCheck.check = function() {
    // Have a stateId for history purposes. This allows us to continue to update the same health check object and keep track of prior objects
    var stateId = stateIds[this.id];
    if (stateId === undefined) {
        stateId = 0;
    } else {
        stateId++;
    }
    stateIds[this.id] = stateId;
    if (this.timer) {
        clearTimeout(this.timer);
    }
    this.timer = setTimeout(this.check.bind(this), this.period * 1000);
}

/**
 *   Gets the set of email and phone contacts from a health check and its service
 */
HealthCheck.prototype.getContacts = function() {
    var set = {};

    // Add all contacts for this health check into a set
    var emails = parseHealthCheckProperty(this.email);
    for (var i = 0; i < emails.length; ++i) {
        set[emails[i]] = 1;
    }

    // Add all contacts for this health check's service into a set
    var service = serviceListener.getService(this.service_id);
    if (service) {
        var contacts = parseHealthCheckProperty(service.contacts)

        for(var i = 0; i < contacts.length; ++i) {
            set[contacts[i]] = 1;
        }
    }

    // Add each contact into a list of contacts
    var results = [];
    for (var key in set) {
        results.push(key);
    }

    return results;
}

HealthCheck.prototype.getHealthCheckState = function() {
    var oldHealthCheckState = this.serviceMonitor.getCurrentCheckStateByCheckId(this.id);
    var healthCheckState = new HealthCheckState(this, stateIds[this.id]);
    if (oldHealthCheckState) {
        healthCheckState.setDetails(oldHealthCheckState.details);
        healthCheckState.state = oldHealthCheckState.state;
    }
    return healthCheckState;
}


function checkResult(result, operator, value) {
    var isHealthy = false;
    if (result !== undefined) {
        if (operator === '=') {
            isHealthy = result == value;
        } else if (operator === '>') {
            isHealthy = result > value;
        } else if (operator === '<') {
            isHealthy = result < value;
        }
    }
    return isHealthy;
}

function removeInactiveConfigs(old_configs,new_configs,healcheckState,callback){
    if(!old_configs || !new_configs || !healcheckState){
        callback("3 parameters required");
        return;
    }
    var newConfigs = {};
    for(var x in new_configs){
        newConfigs[new_configs[x]] = new_configs;
    }
    for(var x in old_configs){
        if (!newConfigs[x]){
            logger.info("removed detail " + x + " in healthcheck " + healcheckState.healthCheck.name);
            healcheckState.removeDetail(x);
        }
    }
    callback();
}

function ServerHealthCheck() {}

util.inherits(ServerHealthCheck, HealthCheck);

ServerHealthCheck.prototype.check = function() {
    //Call the super method which will essentially start the timer again
        ServerHealthCheck.super_.check.call(this);
        var servers = parseHealthCheckProperty(this.property);
        var healthCheckState = this.getHealthCheckState();
        var checkServer = function(serverConfig) {
            //default to port 80 (standard HTTP port), though allow for a port to be passed in as server:port
            var port = 80;
            var httpUse = http;
            var server = serverConfig;
            if (serverConfig.indexOf(":") !== -1) {
                serverSplit = serverConfig.split(":");
                server = serverSplit[0];
                port = serverSplit[1];
                if (serverSplit.length > 2) {
                    if (serverSplit[2] == 'https') {
                        httpUse = https;
                    }
                }
            }
            healthCheckState.startRequest(serverConfig);
            var options = {
                    port: port,
                    path: this.path,
                    host: server,
                    method: 'GET'
            };
            //Set up an http request to the server at the specific path and wait for the response.
            //The reason for using .bind(healthCheck) for all the responses is so that we can get the healthCheck context which is necessary
            req = httpUse.request(options,
                    function(res) {
                //Make sure status is OK - if not that is considered an error
                if (res.statusCode !== 200) {
                    logger.error("invalid response from: " + server + " status code: " + res.statusCode);
                    healthCheckState.healthCheck.checkResponse(serverConfig, "status code: " + res.statusCode, healthCheckState);
                } else {
                    var data = [];
                    res.on('data',
                            function(response) {
                        data.push(response);
                    });
                    res.on('end',
                            function() {
                        healthCheckState.healthCheck.checkResponse(serverConfig, data.join(''), healthCheckState);
                    });
                }
            }
            ).on('error',
                    function(e) {
                logger.error("ERROR - ServerHealthCheck server: " + server)
                logger.error(e);
                healthCheckState.healthCheck.checkResponse(serverConfig, e, healthCheckState);
            });
            //Set a timeout so that if the http request doesn't return within N milliseconds that we cancel the request and report an error.
            //req.socket should exist in almost all cases, the one possibility I found that it will not is that if two http requests are
            //opened to the same server/port, the second one will not have a socket open. That unfortunately means the timer will not be set for that request
            if (req.socket) {
                req.socket.setTimeout(HTTP_TIMEOUT,
                        function() {
                    logger.error('ServerHealthCheck TIMEOUT ' + server);
                    req.abort();
                    healthCheckState.healthCheck.checkResponse(serverConfig, "ServerHealthCheck TIMEOUT", healthCheckState);
                });
            }
            //Actually perform the http request
            req.end();
        };
        healthCheckState.healthCheck.dynamic_config = [];
        var hasConfig = false;
        for (var i in servers) {
            var server = servers[i];
            if (server) {
                if(server.indexOf("db_config") != -1){
                    var severSplit = server.split(":");
                    var port;
                    if(severSplit.length > 2){
                        port = severSplit[2];
                    }
                    hasConfig = true;
                    configFetcher.getAppConfigFromDbServer(server, function(err,configStrings,configString){
                        if(!err){
                            if(configStrings){
                                var app_config_string;
                                for(var j in configStrings){
                                    var app_servers = configStrings[j];
                                    for(var k in app_servers){
                                        if(healthCheckState.healthCheck.dynamic_config instanceof Array){
                                            app_config_string = port ? app_servers[k] + ":" + port : app_servers[k];
                                            healthCheckState.healthCheck.dynamic_config.push(app_config_string);
                                        }
                                        checkServer.bind(healthCheckState.healthCheck)(app_config_string);
                                    }
                                }
                                healthCheckState.healthCheck.old_dynamic_config = healthCheckState.healthCheck.dynamic_config;
                            }
                        }
                        else{
                            healthCheckState.healthCheck.dynamic_config = healthCheckState.healthCheck.old_dynamic_config;
                            logger.error(err);
                            if(healthCheckState.healthCheck.old_dynamic_config){
                                logger.info("using old config");
                                for(var j in healthCheckState.healthCheck.old_dynamic_config){
                                    checkServer.bind(healthCheckState.healthCheck)(healthCheckState.healthCheck.old_dynamic_config[j]);
                                }
                            }
                            else{
                                healthCheckState.healthCheck.handleConfigResponse(configString, err, healthCheckState);
                            }
                        }
                        removeInactiveConfigs(healthCheckState.details, 
                                healthCheckState.healthCheck.dynamic_config, healthCheckState, function(){
                        });
                    });
                }
                else{
                    healthCheckState.healthCheck.dynamic_config.push(server);
                    checkServer.bind(this)(server);
                }
            }
        }
        if(hasConfig == false){
            removeInactiveConfigs(healthCheckState.details, 
                    healthCheckState.healthCheck.dynamic_config, healthCheckState, function(){
            });
        }
}

ServerHealthCheck.prototype.getServerDisplayName = function(serverConfig){
    var serverDisplayName=serverConfig;
    if(serverConfig.indexOf(":") != -1){
        var serverConfigSplit = serverConfig.split(":");
        serverDisplayName = serverConfigSplit[0];
    }
    return serverDisplayName;
};

ServerHealthCheck.prototype.handleConfigResponse = function(server,error,healthCheckState){
    if(error){
        healthCheckState.addDetail(server, error);
    }
    else{
        healthCheckState.removeDetail(server);
    }
    this.serviceMonitor.updateCheckState(healthCheckState);
}

ServerHealthCheck.prototype.checkResponse = function(server, response, healthCheckState) {
 // hack to handle the timeout issue, where the server would get a valid response even after a timeout and req.abort()
    if(response && typeof(response) == "string" ){ 
        if(response.indexOf("ServerHealthCheck TIMEOUT") != -1){
            if(!healthCheckState.timeoutInfo){
                healthCheckState.timeoutInfo = {};
            }
            if(!healthCheckState.timeoutInfo[server]){
                healthCheckState.timeoutInfo[server] = true;
            }
        }
        else{
            if(healthCheckState.timeoutInfo && healthCheckState.timeoutInfo[server]){
                return;
            }
        }
    }
    
    //If there was an error obtaining the response or the response doesn't have the value we are looking for, there is an error
    if (response === false || typeof(response) == "object"  || response.toString().search(this.value) === -1) {
        healthCheckState.addDetail(server, response);
    } else {
        healthCheckState.removeDetail(server);
    }
    this.serviceMonitor.updateCheckState(healthCheckState);
    healthCheckState.endRequest(server);
}

function GraphiteHealthCheck(){};

util.inherits(GraphiteHealthCheck, ServerHealthCheck);

GraphiteHealthCheck.prototype.checkResponse =  function (server, response, healthCheckState) {
    var operator = '=';
    var isHealthy = false;
    var value = this.value || "=1";
    if (value.charAt(0) === '<' || value.charAt(0) === '>' || value.charAt(0) === '=') {
        operator = value.charAt(0);
        value = value.substring(1, value.length);
    }
    //sample response format for testing
    //response = '[{"target": "1_Minute.ios.crimecity.server_errors.total", "datapoints": [[2.0, 1322791080], [1.0, 1322791080]]}]';
    var result = null;
    var jsonObject = null;
    if (response) {
        try {
            var jsonObject = JSON.parse(response);
            if (jsonObject && jsonObject.length > 0 && jsonObject[0].datapoints) {
                var data = jsonObject[0].datapoints;
                //check all the data points except the last one which might not be ready yet
                var failedCount = 0;
                var badResult = 0;
                for(var i = 0; i < data.length - 1; ++i) {
                    result = data[i][0];
                    if (!checkResult(result, operator, value)) {
                        failedCount++;
                        badResult = result;
                    }
                }
                result = badResult;
                var threshold = data.length - 1;
                if (threshold > 3) {
                    threshold -= 1;
                }
                if (failedCount >=  threshold) {
                    isHealthy = false;
                } else {
                    isHealthy = true;
                }
            }
        } catch(e) {
            logger.error('error processing graphite response: '  + response);
            logger.error(e);
        }
    } else {
        response = "invalid JSON response: " + response;
    }

    if (!isHealthy) {
        response = "result: " + result + " expected: " + operator + " " + value;
    }

    if (!isHealthy) {
        healthCheckState.addDetail(server, response);
    } else {
        healthCheckState.removeDetail(server);
    }
    this.serviceMonitor.updateCheckState(healthCheckState);
    healthCheckState.endRequest(server);
}

function DatabaseHealthCheck(){};

util.inherits(DatabaseHealthCheck, HealthCheck);

DatabaseHealthCheck.prototype.check = function() {
    DatabaseHealthCheck.super_.check.call(this);
    var query = this.path || "SELECT 1 FROM dual";
    var connections = parseHealthCheckProperty(this.property);
    var healthCheckState = this.getHealthCheckState();
    var checkServer = function(connectionString) {
        var connectionStringSplit = connectionString.split(":");
        if (connectionStringSplit.length >= 4) {
            var host = connectionStringSplit[0];
            var port = connectionStringSplit[1];
            var database = connectionStringSplit[2];
            var user = connectionStringSplit[3];

            var client = new Client();
            client.host = host;
            client.port = port;
            client.database = database;
            client.user = user;
            client.password = passwords.config[user];
            var databaseName = host + ":" + database;
            healthCheckState.startRequest(connectionString);

            client.on('error', function(err) {
                client.destroy();
                client._queue = [];
                healthCheckState.healthCheck.checkResponse(err, null, {}, connectionString, healthCheckState);
            });

            client.query(query, [], function(err, results, fields) {
                healthCheckState.healthCheck.checkResponse(err, results, fields, connectionString, healthCheckState);
                client.end();
            });
        } else {
            logger.error("Not enough connection parameters for database connection: " + connectionString);
        }
    };
    healthCheckState.healthCheck.dynamic_config = [];
    var hasConfigs = false;
    var services = serviceListener.getServices();
    for (var i = 0; i < connections.length; ++i) {
        var connectionString = connections[i];
        if(connectionString.indexOf("app_config") != -1){
            hasConfigs = true;
            var service = services[this.service_id];
            var configSplit = connectionString.split(":");
            connectionString = configSplit[0] + ":"+ service.app_server + ":" + service.app_server_url + ":" + configSplit[1]
                                + ":"+ service.db_port + ":" + service.db_user;
            configFetcher.getConfigFromAppServer(connectionString, this.check_type, function(err,configStrings,configString){
                if(!err){
                    if(configStrings){
                        for(var j in configStrings){
                            healthCheckState.healthCheck.dynamic_config.push(configStrings[j]);
                            checkServer.bind(healthCheckState.healthCheck)(configStrings[j]);
                        }
                        healthCheckState.healthCheck.old_dynamic_config = healthCheckState.healthCheck.dynamic_config;
                    }
                }
                else{
                    healthCheckState.healthCheck.dynamic_config = healthCheckState.healthCheck.old_dynamic_config;
                    logger.error(err);
                    if(healthCheckState.healthCheck.old_dynamic_config){
                        for(var j in healthCheckState.healthCheck.old_dynamic_config){
                            checkServer.bind(healthCheckState.healthCheck)(healthCheckState.healthCheck.old_dynamic_config[j]);
                        }
                    }
                    else{
                        healthCheckState.healthCheck.handleConfigResponse(configString, err, healthCheckState);
                    }
                }
                removeInactiveConfigs(healthCheckState.details, 
                        healthCheckState.healthCheck.dynamic_config, healthCheckState, function(){
                });
            });
        }
        else{
            healthCheckState.healthCheck.dynamic_config.push(connectionString);
            checkServer.bind(this)(connectionString);
        }
    }
    if(hasConfigs == false){
        removeInactiveConfigs(healthCheckState.details, 
                healthCheckState.healthCheck.dynamic_config, healthCheckState, function(){
        });
    }
};

DatabaseHealthCheck.prototype.getServerDisplayName = function(databaseConfig){
    var databaseDisplayName=databaseConfig;
    if(databaseConfig.indexOf(":") != -1){
        var databaseConfigSplit = databaseConfig.split(":");
        if(databaseConfigSplit.length>= 3){
            databaseDisplayName = databaseConfigSplit[0] + ":" + databaseConfigSplit[2]; // server and db name
        }
    }
    return databaseDisplayName;
};

DatabaseHealthCheck.prototype.handleConfigResponse = function(server,error,healthCheckState){
    if(error){
        healthCheckState.addDetail(server, error);
    }
    else{
        healthCheckState.removeDetail(server);
    }
    this.serviceMonitor.updateCheckState(healthCheckState);
}

DatabaseHealthCheck.prototype.checkResponse = function(err, results, fields, database, healthCheckState) {
    if (err) {
        logger.error('database: ' + database + ' check response error: ');
        logger.error(err);
        healthCheckState.addDetail(database, "database error: " + JSON.stringify(err));
        this.serviceMonitor.updateCheckState(healthCheckState);
        return;
    }

    var operator = '=';
    var value = this.value || "=1";
    if (value.charAt(0) === '<' || value.charAt(0) === '>' || value.charAt(0) === '=') {
        operator = value.charAt(0);
        value = value.substring(1, value.length);
    }
    var result;
    for (var field in fields) {
        result = results[0][field];
        break;
    }

    var isHealthy = false;
    if (result !== undefined) {
        if (operator === '=') {
            isHealthy = result == value;
        } else if (operator === '>') {
            isHealthy = result > value;
        } else if (operator === '<') {
            isHealthy = result < value;
        }
    }

    if (!isHealthy) {
        healthCheckState.addDetail(database, "result: " + result + ' expected: ' + this.value );
    } else {
        healthCheckState.removeDetail(database);
    }

    this.serviceMonitor.updateCheckState(healthCheckState);
    healthCheckState.endRequest(database);
}


function VerticaHealthCheck(){};

util.inherits(VerticaHealthCheck, HealthCheck);

VerticaHealthCheck.prototype.check = function() {
    DatabaseHealthCheck.super_.check.call(this);
    var query = this.path || "SELECT 1 FROM dual";
    var connections = parseHealthCheckProperty(this.property);
    var healthCheckState = this.getHealthCheckState();
    
    var checkServer = function(connectionString) {
        healthCheckState.startRequest(connectionString);
        verticaQuery.runVerticaQuery(connectionString, query, function(err,results){
            if(err){
                logger.error("Vertica Error : " + err);
            }
            healthCheckState.healthCheck.checkResponse(err, results, connectionString, healthCheckState);
        });
    };
    
    healthCheckState.healthCheck.dynamic_config = [];
    for (var i = 0; i < connections.length; ++i) {
        var connectionString = connections[i];
        healthCheckState.healthCheck.dynamic_config.push(connectionString);
        checkServer.bind(this)(connectionString);
    }
    removeInactiveConfigs(healthCheckState.details, 
            healthCheckState.healthCheck.dynamic_config, healthCheckState, function(){
    });
};

VerticaHealthCheck.prototype.getServerDisplayName = function(verticaConfig){
    var verticaDisplayName=verticaConfig;
    if(verticaConfig.indexOf(":") != -1){
        var verticaConfigSplit = verticaConfig.split(":");
        if(verticaConfigSplit.length>= 3){
            verticaDisplayName = verticaConfigSplit[0] + ":" + verticaConfigSplit[2]; // server and db name
        }
    }
    return verticaDisplayName;
};

VerticaHealthCheck.prototype.checkResponse = function(err, result, database, healthCheckState) {
    if (err) {
        logger.error('vertica check response error: ');
        logger.error(err);
        healthCheckState.addDetail(database, err.message);
        this.serviceMonitor.updateCheckState(healthCheckState);
        healthCheckState.endRequest(database);
        return;
    }

    var operator = '=';
    var value = this.value || "=1";
    if (value.charAt(0) === '<' || value.charAt(0) === '>' || value.charAt(0) === '=') {
        operator = value.charAt(0);
        value = value.substring(1, value.length);
    }
    var isHealthy = checkResult(result, operator, value);

    if (!isHealthy) {
        healthCheckState.addDetail(database, "result: " + result + ' expected: ' + this.value );
    } else {
        healthCheckState.removeDetail(database);
    }

    this.serviceMonitor.updateCheckState(healthCheckState);
    healthCheckState.endRequest(database);
};

function checkBoundedResult(result, lowerbound, upperbound) {
    var isHealthy = false;
    if (result !== undefined) {
        //logger.error("function(checkBoundedResult) -> result: "+parseFloat(result)+" lowerbound: "+parseFloat(lowerbound)+" upperbound: "+parseFloat(upperbound));
        isHealthy = (parseFloat(result) >= parseFloat(lowerbound) && result <= parseFloat(upperbound));
    }
    return isHealthy;
}

//Business Intelligence Check Code
function BusinessIntelligenceCheck(){};

util.inherits(BusinessIntelligenceCheck, HealthCheck);

BusinessIntelligenceCheck.prototype.check = function() {
    DatabaseHealthCheck.super_.check.call(this);
    // get special lower and upper checks from value
    var conditions = this.businessintelligence;
    this.biLowerBound = null;
    this.biUpperBound = null;
    var query = this.path || "SELECT 1 FROM dual";
    var connections = parseHealthCheckProperty(this.property);
    var healthCheckState = this.getHealthCheckState();
    
    var checkServer = function(connectionString) {
        verticaQuery.runVerticaQuery(connectionString, query, function(err,results){
            if(err){
                logger.error("Vertica Error : " + err);
                healthCheckState.healthCheck.checkResponse(err, results, connectionString, healthCheckState);
                return;
            }
            var lowerBoundQuery = conditions['lowervaluebound']['value'];
            var upperBoundQuery = conditions['uppervaluebound']['value'];

            // LOWERBOUND QUERY
            if(conditions['lowervaluebound']['isQuery'] === 'TRUE') {
                verticaQuery.runVerticaQuery(connectionString, lowerBoundQuery, function(err,lowerresult){
                   if(err){
                       logger.error("Vertica Error : " + err);
                       healthCheckState.healthCheck.checkResponse(err, results, connectionString, healthCheckState);
                       return;
                   }
                   healthCheckState.healthCheck.biLowerBound = lowerresult;
                   if(healthCheckState.healthCheck.biUpperBound != null && healthCheckState.healthCheck.biLowerBound != null) {
                       healthCheckState.healthCheck.checkResponse(err, results, connectionString, healthCheckState);
                   }
                });
    
            } else {
               // set lowerbound
               healthCheckState.healthCheck.biLowerBound = conditions['lowervaluebound']['value'];
            }
            
            // UPPERBOUND QUERY
            if(conditions['uppervaluebound']['isQuery'] === 'TRUE') {
                verticaQuery.runVerticaQuery(connectionString, upperBoundQuery, function(err,upperresult){
                   if(err){
                       logger.error("Vertica Error : " + err);
                       healthCheckState.healthCheck.checkResponse(err, results, connectionString, healthCheckState);
                       return;
                   }
                   healthCheckState.healthCheck.biUpperBound = upperresult;
                   if(healthCheckState.healthCheck.biUpperBound != null && healthCheckState.healthCheck.biLowerBound != null) {
                       healthCheckState.healthCheck.checkResponse(err, results, connectionString, healthCheckState);
                   }
                });
            } else {
               //set upperbound
               healthCheckState.healthCheck.biUpperBound = conditions['uppervaluebound']['value'];
            }
    
            if(healthCheckState.healthCheck.biUpperBound != null && healthCheckState.healthCheck.biLowerBound != null) {
               healthCheckState.healthCheck.checkResponse(err, results, connectionString, healthCheckState);
            }
        });
    };
    
    healthCheckState.healthCheck.dynamic_config = [];
    for (var i = 0; i < connections.length; ++i) {
        var connectionString = connections[i];
        healthCheckState.healthCheck.dynamic_config.push(connectionString);
        checkServer.bind(this)(connectionString);
    }
    removeInactiveConfigs(healthCheckState.details, 
            healthCheckState.healthCheck.dynamic_config, healthCheckState, function(){
    });
}

BusinessIntelligenceCheck.prototype.getServerDisplayName = function(biConfig){
    var biDisplayName=biConfig;
    if(biConfig.indexOf(":") != -1){
        var biConfigSplit = biConfig.split(":");
        if(biConfigSplit.length>= 3){
            biDisplayName = biConfigSplit[0] + ":" + biConfigSplit[2]; // server and db name
        }
    }
    return biDisplayName;
};

BusinessIntelligenceCheck.prototype.errorResponse = function(err, database, healthCheckState) {
    if (err) {
        logger.error('business intelligence check response error: ');
        logger.error(err);
        healthCheckState.addDetail(database, err.message);
        this.serviceMonitor.updateCheckState(healthCheckState);
        healthCheckState.endRequest(database);
        return;
    }
}

BusinessIntelligenceCheck.prototype.checkResponse = function(err, result, database, healthCheckState) {
    if (err) {
        logger.error('business intelligence check response error: ');
        logger.error(err);
        healthCheckState.addDetail(database, err.message);
        this.serviceMonitor.updateCheckState(healthCheckState);
        healthCheckState.endRequest(database);
        return;
    }
    if(healthCheckState.healthCheck.biLowerBound == null || healthCheckState.healthCheck.biUpperBound == null || result == null){
        logger.error('business intelligence check upperbound/lowerbound/result error (one or two or all are null):');
        //console.log(healthCheckState.healthCheck);
        if(err == null){
            err = "unknown error.";
        }
        logger.error(err);
        healthCheckState.addDetail(database, err.message);
        this.serviceMonitor.updateCheckState(healthCheckState);
        healthCheckState.endRequest(database);
        return;
    }

    var isHealthy = checkBoundedResult(result, healthCheckState.healthCheck.biLowerBound, healthCheckState.healthCheck.biUpperBound);

    if (!isHealthy) {
        healthCheckState.addDetail(database, "result: " + result + ' expected between: ' + healthCheckState.healthCheck.biLowerBound + ' and ' + healthCheckState.healthCheck.biUpperBound);
    } else {
        healthCheckState.removeDetail(database);
    }

    this.serviceMonitor.updateCheckState(healthCheckState);
    healthCheckState.endRequest(database);
};


function SshHealthCheck(){};

util.inherits(SshHealthCheck, HealthCheck);

SshHealthCheck.prototype.check = function() {
    //Call the super method which will essentially start the timer again
    SshHealthCheck.super_.check.call(this);
    var servers = parseHealthCheckProperty(this.property);
    var healthCheckState = this.getHealthCheckState();
    var util   = require('util');
    var spawn = require('child_process').spawn,
    fs = require('fs'),
    sys = require('util');
    var checkServer = function(serverConfig) {
        var parts = serverConfig.split(':');
        var username = 'pulse';
        var server = serverConfig;
        if (parts.length > 1) {
            server = parts[0];
            username = parts[1];
        }
        var output = '';
        var keyPath = '/home/' + username + '/.ssh/id_rsa';
        function ssh(serverConfig, username, host, command) {
            healthCheckState.startRequest(serverConfig);
            var ssh = spawn('ssh', [ '-o StrictHostKeyChecking=no', '-i', keyPath, username + '@' + host, command]);

            ssh.on('exit', function (code, signal) {
                logger.debug('ssh result: ');
                logger.debug(output);
                healthCheckState.healthCheck.checkResponse(serverConfig, output, healthCheckState);
            });

            ssh.stdout.on('data', function (out) {

                output += out;
            });

            ssh.stderr.on('data', function (err) {
                if (err) {
                    logger.error("ssh error:");
                    logger.error(err);
                }
                logger.debug(output);
                healthCheckState.healthCheck.checkResponse(serverConfig, err, healthCheckState);
            });
        };

        ssh(serverConfig, username, server, this.path);
    };
    healthCheckState.healthCheck.dynamic_config = [];
    for (var i in servers) {
        var server = servers[i];
        if (server) {
            healthCheckState.healthCheck.dynamic_config.push(server);
            checkServer.bind(this)(server);
        }
    }
    removeInactiveConfigs(healthCheckState.details, 
            healthCheckState.healthCheck.dynamic_config, healthCheckState, function(){
    });
}

SshHealthCheck.prototype.getServerDisplayName = function(sshConfig){
    var sshDisplayName=sshConfig;
    if(sshConfig.indexOf(":") != -1){
        var sshConfigSplit = sshConfig.split(":");
        if(sshConfigSplit.length>= 1){
            sshDisplayName = sshConfigSplit[0]; // server and db name
        }
    }
    return sshDisplayName;
};

SshHealthCheck.prototype.checkResponse = function(server, response, healthCheckState) {
    var operator = '=';
    var value = this.value;
    if (value.charAt(0) === '<' || value.charAt(0) === '>' || value.charAt(0) === '=') {
        operator = value.charAt(0);
        value = value.substring(1, value.length);
    }
    //If there was an error obtaining the response or the response doesn't have the value we are looking for, there is an error
    if (response === false || typeof(response) == "object"  || (operator == '=' && response.toString().search(this.value) === -1)) {
        healthCheckState.addDetail(server, response);
    } else if ((operator == "<" || operator == ">") && !isNaN(response) && checkResult(response, operator, value))  {
        var message = "result: " + response + " expected: " + operator + " " + value;
        healthCheckState.addDetail(server, message);
    } else {
        healthCheckState.removeDetail(server);
    }
    this.serviceMonitor.updateCheckState(healthCheckState);
    healthCheckState.endRequest(server);

}

function MemcacheHealthCheck(){};   

util.inherits(MemcacheHealthCheck, HealthCheck);

MemcacheHealthCheck.prototype.check = function() {
    //Call the super method which will essentially start the timer again
    MemcacheHealthCheck.super_.check.call(this);
    var servers = parseHealthCheckProperty(this.property);
    var value = this.value =  (this.value || 'SUCCESS');
    var healthCheckState = this.getHealthCheckState();
    var checkServer = function(serverConfig) {
        var parts = serverConfig.split(':');
        if (parts.length != 2) {
            logger.error('invalid memcached server: ' + serverConfig);
            healthCheckState.healthCheck.checkResponse(serverConfig, 'invalid memcached server config', healthCheckState);
            return;
        }
        if(isNaN(parts[1])){
            logger.error('invalid port, must be a number ');
            healthCheckState.healthCheck.checkResponse(serverConfig, 'invalid port, must be a number ', healthCheckState);
            return;
        }
        healthCheckState.startRequest(serverConfig);
        var client = new Memcached(serverConfig);
        var key = 'health_check_test';
        client.set(key, value, 10000, function(err, response) {
            if (err) {
                logger.error('error setting memcached server: ' + serverConfig + " error: " );
                logger.error(err);
                healthCheckState.healthCheck.checkResponse(serverConfig, 'set failure: ' +  JSON.stringify(err), healthCheckState);
                client.end();
            } else {
                client.get(key, function(err, data) {
                    client.end();
                    if (err) {
                        logger.error(err);
                        healthCheckState.healthCheck.checkResponse(serverConfig, 'get failure: ' + JSON.stringify(err), healthCheckState);
                    } else {
                        healthCheckState.healthCheck.checkResponse(serverConfig, data, healthCheckState);
                    }
                });
            }
        });
        client.on('failure', function(err) {
            logger.error('memcache failure: ' + err);
            healthCheckState.healthCheck.checkResponse(serverConfig, 'memcache failure' + JSON.stringify(err), healthCheckState);
        });
    };
    healthCheckState.healthCheck.dynamic_config = [];
    healthCheckState.healthCheck.unique_dynamicConfigs = {};
    var hasConfig = false;
    var services = serviceListener.getServices();
    for (var i in servers) {
        var server = servers[i];
        if(server.indexOf("app_config") != -1){
            hasConfig = true;
            var service = services[this.service_id];
            var configSplit = server.split(":");
            server = configSplit[0] + ":"+ service.app_server + ":" + service.app_server_url;
            for(var x=1;x<configSplit.length;x++){
                server+=":"+configSplit[x];
            }
            configFetcher.getConfigFromAppServer(server, this.check_type, function(err,configStrings,configString){
                if(!err){
                    if(configStrings){
                        for(var j in configStrings){
                            if(!(configStrings[j] in healthCheckState.healthCheck.unique_dynamicConfigs)){
                                healthCheckState.healthCheck.unique_dynamicConfigs[configStrings[j]] = true;
                                healthCheckState.healthCheck.dynamic_config.push(configStrings[j]);
                                checkServer.bind(healthCheckState.healthCheck)(configStrings[j]);
                            }
                        }
                        healthCheckState.healthCheck.old_dynamic_config = healthCheckState.healthCheck.dynamic_config;
                    }
                }
                else{
                    healthCheckState.healthCheck.dynamic_config = healthCheckState.healthCheck.old_dynamic_config;
                    logger.error(err);
                    if(healthCheckState.healthCheck.old_dynamic_config){
                        for(var j in healthCheckState.healthCheck.old_dynamic_config){
                            checkServer.bind(healthCheckState.healthCheck)(healthCheckState.healthCheck.old_dynamic_config[j]);
                        }
                    }
                    else{
                        healthCheckState.healthCheck.handleConfigResponse(configString, err, healthCheckState);
                    }
                }
                removeInactiveConfigs(healthCheckState.details, 
                        healthCheckState.healthCheck.dynamic_config, healthCheckState, function(){
                });
            });
        }
        else{
            healthCheckState.healthCheck.dynamic_config.push(server);
            checkServer.bind(this)(server);
        }
    }
    if(hasConfig == false){
        removeInactiveConfigs(healthCheckState.details, 
                healthCheckState.healthCheck.dynamic_config, healthCheckState, function(){
        });
    }
}

MemcacheHealthCheck.prototype.getServerDisplayName = function(memConfig){
    var memDisplayName=memConfig;
    return memDisplayName;
};

MemcacheHealthCheck.prototype.handleConfigResponse = function(server,error,healthCheckState){
    if(error){
        healthCheckState.addDetail(server, error);
    }
    else{
        healthCheckState.removeDetail(server);
    }
    this.serviceMonitor.updateCheckState(healthCheckState);
}

MemcacheHealthCheck.prototype.checkResponse = function(server, response, healthCheckState) {
    //If there was an error obtaining the response or the response doesn't have the value we are looking for, there is an error
    if (response === false || response.toString().search(this.value) === -1) {
        healthCheckState.addDetail(server, response);
    } else {
        healthCheckState.removeDetail(server);
    }
    this.serviceMonitor.updateCheckState(healthCheckState);
    healthCheckState.endRequest(server);
}

/**  
 *  Parses a property from a health check into the tokens used for checking
 */
function parseHealthCheckProperty(property) {
    if (!property) {
        return '';
    }
    var parsedProperty = property;
    parsedProperty = parsedProperty.replace(/(\r\n|\n|\r)/gm, " ");
    parsedProperty = parsedProperty.replace(/\s+/g, "");
    parsedProperty = parsedProperty.split(',');
    for (var index in parsedProperty) {
        if (parsedProperty[index] == "") {
            parsedProperty.splice(index,1);
        }
    }
    return parsedProperty;
}

var HealthCheckTypes = {
        'HealthCheck'         :  HealthCheck,
        'ServerHealthCheck'   : ServerHealthCheck,
        'DatabaseHealthCheck' : DatabaseHealthCheck,
        'VerticaHealthCheck'  : VerticaHealthCheck,
        'MemcacheHealthCheck' : MemcacheHealthCheck,
        'GraphiteHealthCheck' : GraphiteHealthCheck,
        'SshHealthCheck'      : SshHealthCheck,
        'BusinessIntelligenceCheck' : BusinessIntelligenceCheck
};

/**
 *  Initializes a Health Check Object from a database result
 */
function createHealthCheckFromDatabaseResult(result) {
    var type = result.check_type;

    if (HealthCheckTypes[type]) {
        var healthCheck = new HealthCheckTypes[type]();
        healthCheck.loadResult(result);
        
        return healthCheck;
    } else {
        logger.error('invalid health check: ' + type);
        return undefined;
    }
}

for (var index in HealthCheckTypes) {
    exports[index] = HealthCheckTypes[index];
}

exports.HealthCheckState = HealthCheckState;
exports.HealthCheckTypes = HealthCheckTypes;
exports.createHealthCheckFromDatabaseResult = createHealthCheckFromDatabaseResult;
