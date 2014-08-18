var serviceListener = require("../model/serviceListener");
var healthCheckDisplayHelper = require("./healthCheckDisplayHelper");
var sorters = require("./sorters");
var logger = require("./logger").getInstance();


function getServicesForDisplay() {
    var services = serviceListener.getServices();
    var servicesForDisplay = [];
    var serviceStates = healthCheckDisplayHelper.getHealthChecksForDisplay();
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
    return servicesForDisplay.sort(sorters.sortServicesForDisplay);
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

exports.getServicesForDisplay = getServicesForDisplay;