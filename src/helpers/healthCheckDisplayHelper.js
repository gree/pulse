var serviceListener = require("../model/serviceListener");
var CheckDisplays = require("../model/checkDisplays");
var sorters = require("./sorters");
var logger = require("./logger").getInstance();

function getHealthChecksForDisplay(service_id) {
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
    serviceStateDisplayArray.sort(sorters.sortHealthChecksForDisplay);
    return serviceStateDisplayArray;
}

function stateDisplayFromHealthCheck(service_id, service_name, healthCheckState) {
    var checkDisplay = CheckDisplays.getHealthCheckDisplay(healthCheckState.healthCheck.check_type);
    if (checkDisplay === undefined) {
        logger.error("ERROR - Check Type " + healthCheckState.healthCheck.check_type + " does not exist.");
    }
    
    return new StateDisplay(service_id, service_name, healthCheckState.healthCheck.name, healthCheckState.healthCheck.id,
                healthCheckState.state,
                healthCheckState.lastReceived,
                checkDisplay.displayName, 
                healthCheckState.getDisplayDetails(), healthCheckState.healthCheck.check_type,healthCheckState.healthCheck.period,
                healthCheckState.healthCheck.timeCreated,healthCheckState.healthCheck.timeModified,healthCheckState.healthCheck.value,healthCheckState.healthCheck.displayCheckType );
}

function stateDisplayFromServiceHistory(serviceName, healthCheck, serviceHistory) {
    // Service History.type determines if it is a rule or check

    var checkDisplay = CheckDisplays.getHealthCheckDisplay(healthCheck.check_type);
    if (checkDisplay === undefined) {
        logger.error("ERROR - Check Type " + healthCheck.healthCheck.check_type + " does not exist.");
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
    this.displayCheckType = type;
}

exports.getHealthChecksForDisplay = getHealthChecksForDisplay;
exports.stateDisplayFromServiceHistory = stateDisplayFromServiceHistory;