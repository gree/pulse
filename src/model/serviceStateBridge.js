var serviceListener = require("./serviceListener");
var config = require("../config/config");
var Rules = require("./rules");
var Checks = require("./checks");
var CheckDisplays = require("./checkDisplays");
var Service = require("./service").Service;
var helpers = require("../helpers/helpers");
var logger = require("../helpers/logger").getInstance();

//change this API if we put dashboard and listener on different servers
function getServiceStates(service_id) {
    var serviceStateDisplayArray = [];
    
    var services = serviceListener.getServices();
    var serviceMonitors = serviceListener.getServiceMonitors();
    if(service_id !== undefined){
        var serviceMonitor = serviceMonitors[service_id];
        serviceMonitors = {};
        if(serviceMonitor !== undefined){
            serviceMonitors[service_id] = serviceMonitor;
        }
    }
    for (var service_id in serviceMonitors) {
        var serviceMonitor = serviceMonitors[service_id];
        if (serviceMonitor.serviceState !== undefined) {
            service = services[service_id];
            if (service !== undefined) {
                var service_name = service.name;
            
                /**
                var ruleStates = serviceMonitor.serviceState.ruleStates;
                for (var i in ruleStates) {
                    var ruleState = ruleStates[i];
                    serviceStateDisplayArray.push(stateDisplayFromRule(service_id, service_name, ruleState));
                }
                */
            
                var checkStates = serviceMonitor.serviceState.checkStates;
                for (var i in checkStates) {
                    var state = serviceMonitor.getCurrentCheckStateByCheckId(i);
                    if (state) {
                        serviceStateDisplayArray.push(stateDisplayFromHealthCheck(service_id, service_name, state));
                    }
                }
            }
        }
    }

    serviceStateDisplayArray.sort(sortStateForDisplay);
    
    return serviceStateDisplayArray;
}

/**
 *  Queries the database for service history
 */
function getServiceHistory(serviceId, checkId, stateStatus, limit, offset, callback) {
    var services = serviceListener.getServices();

    config.populateServiceHistory(serviceId, checkId, stateStatus, limit, offset, function(results, totalCount) {
        var serviceStateBridge = require("../model/serviceStateBridge");
        
        var serviceStateDisplayArray = [];

        for (var i in results) {
            var state = results[i];
        
            // Get the service name
            var service_name = undefined;
            var service = services[state.service_id];
            if (service !== undefined) {
                var service_name = service.name;
            }
            // Get the health Check
            healthCheck = serviceStateBridge.getHealthCheck(state.service_id, state.rule_id);
        
            if (service_name && healthCheck) {        
                serviceStateDisplayArray.push(stateDisplayFromServiceHistory(service_name, healthCheck, state));
            } else {
                logger.error("WARN - Issue creating state display from serviceHistory.");
            }
        }

        if (callback) {
            logger.debug("getServiceHistory() callback called...")
            callback(serviceStateDisplayArray, totalCount);
        }
    });
    
}

/**
 *  Converts a service history state from the database into a display.
 */
function stateDisplayFromServiceHistory(serviceName, healthCheck, serviceHistory) {
    // Service History.type determines if it is a rule or check

    var checkDisplay = CheckDisplays.getHealthCheckDisplay(healthCheck.check_type);
    if (checkDisplay === undefined) {
        console.error("ERROR - Check Type " + healthCheck.healthCheck.check_type + " does not exist.");
    }
    
    return new StateDisplay(serviceHistory.service_id, 
                serviceName, 
                healthCheck.name, 
                serviceHistory.rule_id,
                serviceHistory.state, 
                serviceHistory.timestamp, 
                checkDisplay.displayName, 
                serviceHistory.details);
}

function stateDisplayFromHealthCheck(service_id, service_name, healthCheckState) {
    var checkDisplay = CheckDisplays.getHealthCheckDisplay(healthCheckState.healthCheck.check_type);
    if (checkDisplay === undefined) {
        console.error("ERROR - Check Type " + healthCheckState.healthCheck.check_type + " does not exist.");
    }
    
    return new StateDisplay(service_id, service_name, healthCheckState.healthCheck.name, healthCheckState.healthCheck.id,
                healthCheckState.state,
                healthCheckState.lastReceived,
                checkDisplay.displayName, 
                healthCheckState.getDisplayDetails(), healthCheckState.healthCheck.check_type,healthCheckState.healthCheck.period,
                healthCheckState.healthCheck.timeCreated,healthCheckState.healthCheck.timeModified,healthCheckState.healthCheck.value,healthCheckState.healthCheck.displayCheckType );
}


/*
function stateDisplayFromRule(service_id, service_name, ruleState) {
    var name = ruleState.name;
    return new StateDisplay(service_id, service_name, name, ruleState.id,
                ruleState.state, 
                ruleState.lastReceived, 
                ruleState.rule.ruleType, 
                '');
}*/

function StateDisplay(service_id, service_name, name, check_id, state, lastReceived, type, details, 
        check_type, period, timeCreated, timeModified, value, displayCheckType) {
    this.service_id = service_id;
    this.check_id = check_id;
    this.service_name = service_name;
    this.name = name;
    this.state = state;
    this.lastReceived = lastReceived;
    this.type = type;
    this.details = details;
    this.check_type = check_type;
    this.period = period;
    this.timeCreated = timeCreated;
    this.timeModified = timeModified;
    this.value = value;
    this.displayCheckType = displayCheckType;
}

function ServiceStateDisplay(service_id, service_name, state, state_details, timeCreated, timeModified, healthChecksCount) {
    this.id = service_id;
    this.name = service_name;
    this.state = state;
    this.stateDetails = state_details;
    this.timeCreated = timeCreated;
    this.timeModified = timeModified;
    this.healthChecksCount = healthChecksCount;
}

//Change this api if we put dashboard and listener on different servers
function getRules(serviceState) {
    var serviceMonitors = serviceListener.getServiceMonitors();
    var serviceMonitor = serviceMonitors[serviceState];
    return serviceMonitor.rules;
}

//Change this api if we put dashboard and listener on different servers
function getAllHealthChecks(service_id) {
    var serviceMonitorHealthChecks = [];
    
    var serviceMonitors = serviceListener.getServiceMonitors();
	if (!service_id) {
		// Get health checks for all services
	    for (var service in serviceMonitors) {
	        var serviceMonitor = serviceMonitors[service];
            for (var i in serviceMonitor.healthChecks) {
			    serviceMonitorHealthChecks.push(serviceMonitor.healthChecks[i]);
            }
		}
		
	} else {
		// Get health checks for one service
	    var serviceMonitor = serviceMonitors[service_id];
	    if (serviceMonitor && serviceMonitor.healthChecks) {
            for (var i in serviceMonitor.healthChecks) {
                serviceMonitorHealthChecks.push(serviceMonitor.healthChecks[i]);
            }
	    }
	}
	
	var services = serviceListener.getServices();
	var service_name = undefined;
	for (var index in serviceMonitorHealthChecks) {
	    var healthCheck = serviceMonitorHealthChecks[index];
	    var service_id = healthCheck.service_id;
        if (services[service_id] !== undefined) {
            service_name = services[service_id].name;
        }
        serviceMonitorHealthChecks[index].service_name = service_name;
    }
    
	
	serviceMonitorHealthChecks.sort(sortHealthChecksForDisplay);
	return serviceMonitorHealthChecks;
}

function getHealthCheck(service_id, check_id) {
    logger.debug("getHealthCheck() called...");
    if (service_id == undefined || check_id == undefined) {
        logger.error("service_id and check_id need to be specified");
        return;
    }
    
    var serviceMonitors = serviceListener.getServiceMonitors();
    var serviceMonitor = serviceMonitors[service_id];

    if (serviceMonitor && serviceMonitor.healthChecks) {
        var serviceMonitorHealthChecks = serviceMonitor.healthChecks;
        for (var index in serviceMonitorHealthChecks) {
    	    var healthCheck = serviceMonitorHealthChecks[index];
            if (healthCheck.id == check_id) {
                return healthCheck;
            } 
        }
        if (!healthCheck) {
            logger.error("Health Check " + check_id + " not found.");
        }
    } else {
        logger.error("Service " + service_id + " not found.");
    }
}

//Change this api if we put dashboard and listener on different servers
function getServices() {
    return serviceListener.getServices();
}

function getServicesForDisplay() {
    var services = serviceListener.getServices();
    var servicesForDisplay = [];
    var serviceStates = getServiceStates();
    var serviceStateMap = {};
    var serviceState;
    for(x in serviceStates){
        serviceState = serviceStates[x];
        if(serviceState.state == 2){
            if(serviceStateMap[serviceState.service_id] === undefined){
                serviceStateMap[serviceState.service_id] = "";
            }
            serviceStateMap[serviceState.service_id]+="Healthcheck " + serviceState.name + " failing : " + serviceState.details + "\n";
        }
    }
    var state;
    var stateDetails;
    var serviceMonitors = serviceListener.getServiceMonitors();
    var serviceMonitor;
    var healthChecksCount;
    for(x in services){
        healthChecksCount = 0;
        if (serviceStateMap[services[x].id] !== undefined){
            state = 2;
            stateDetails = serviceStateMap[services[x].id];
        }
        else{
            if(services[x].status == "disabled"){
                state = -1;
            }
            else{
                state = 0;
            }
            stateDetails = "";
        }
        serviceMonitor = serviceMonitors[services[x].id];
        if(serviceMonitor !== undefined){
            for (y in serviceMonitor.healthChecks){
                healthChecksCount++;
            }
        }
        servicesForDisplay.push(new ServiceStateDisplay(services[x].id,services[x].name,state, stateDetails,services[x].timeCreated, services[x].timeModified,healthChecksCount));
    }
    return servicesForDisplay.sort(sortServiceStateForDisplay);
}

//Change this api if we put dashboard and listener on different servers
function resetRules(callback) {
    config.resetRules(callback);
}

//Change this api if we put dashboard and listener on different servers
function resetHealthChecks(callback) {
    config.resetHealthChecks(callback);
}

//Change this api if we put dashboard and listener on different servers
function resetServices(callback) {
    config.resetServices(callback);
}

function clearDBTimer(service, callback) {
    config.clearDBTimer(service, callback);
}

function startDBTimer(service, callback) {
    config.startDBTimer(service, callback);
}

/**
 * Sorting Functions
 */
function sortServicesForDisplay(s1, s2) {
    return compare(s1.name, s2.name);
}

/**
 *  Sort Health Checks by Service Name then Name
 */
function sortHealthChecksForDisplay(h1, h2) {
    var services = serviceListener.getServices();
    
    var service_id_to_name_map = {};
    for (var index in services) {
        var service = services[index];
        service_id_to_name_map[service.id] = service.name;
    }
    
    var name_compare = compare(service_id_to_name_map[h1.service_id], service_id_to_name_map[h2.service_id]);
    if (name_compare == 0) {
        return compare(h1.name, h2.name);
    }
    return name_compare;
}


function sortStateForDisplay(s1, s2) {
    var state_compare = compare(s2.state, s1.state);
    if (state_compare == 0) {
        return sortHealthChecksForDisplay(s1, s2);
    }
    return state_compare;
}

function sortServiceStateForDisplay(s1, s2) {
    var state_compare = compare(s2.state, s1.state);
    if (state_compare == 0) {
        return sortServicesForDisplay(s1, s2);
    }
    return state_compare;
}

// Sorts two objects ascending
function compare(s1, s2) {
    if (s1 == s2) {
        return 0;
    } else if (s1 > s2) {
        return 1;
    }
    return -1;
}


//Change this api if we put dashboard and listener on different servers
function newRule(ruleName, ruleType, ruleValue, service_id, id, timeCreated, timeModified, key) {
    var Rule = Rules.Rule;
    if (ruleName !== '') {
        Rule = eval('Rules.' + ruleName);
    }
    if (Rule === undefined) {
        return undefined;
    }
    return new Rule(key, ruleValue, timeCreated, timeModified, ruleType, id, service_id, ruleName);
}

//Change this api if we put dashboard and listener on different servers
function newHealthCheck(id, check_type, service_id, name, period, value, property, path, email, notificationDelay, timeCreated, timeModified, businessintelligence,dependent_checks,dynamic_config, status) {
    var Check = Checks.HealthCheck;
    if (check_type !== '') {
    	Check =  Checks[check_type];
    }
	if (Check === undefined) {
		console.error("ERROR - Check Type " + check_type + " does not exist.");
        return undefined;
	}
    var check = new Check();

    check.init(id, check_type, service_id, name, period, value, property, path, email, notificationDelay, timeCreated, timeModified, businessintelligence,dependent_checks,dynamic_config,status);
    return check;
}

//Change this api if we put dashboard and listener on different servers
function newService(id, name, interval, timeCreated, timeModified, contacts, status, app_server, app_server_url,db_user,db_port) {
    return new Service(id, name, interval, timeCreated, timeModified, contacts, status, app_server, app_server_url,db_user,db_port);
}


exports.newRule = newRule;
exports.newHealthCheck = newHealthCheck;
exports.resetRules = resetRules;
exports.resetHealthChecks = resetHealthChecks;
exports.getRules = getRules;
exports.getAllHealthChecks = getAllHealthChecks;
exports.getHealthCheck = getHealthCheck;
exports.getServiceStates = getServiceStates;
exports.getServices = getServices;
exports.getServicesForDisplay = getServicesForDisplay;
exports.newService = newService;
exports.resetServices = resetServices;
exports.getServiceHistory = getServiceHistory;
exports.clearDBTimer = clearDBTimer;
exports.startDBTimer = startDBTimer;
exports.sortServicesForDisplay = sortServicesForDisplay;
