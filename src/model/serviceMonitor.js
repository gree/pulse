var ServiceState = require("./service").ServiceState;
var RuleState = require("./rules").RuleState;
var HealthCheckState = require("./checks").HealthCheckState;
var StateEnum = require("./rules").StateEnum;
var logger = require("../helpers/logger").getInstance();

var ONE_MIN = 60 * 1000;
var HISTORY_TO_KEEP = 20;


/**
 *   Data structure that stores rules, health checks, and other state about a service
 */
function ServiceMonitor(service_id) {
    this.service_id = service_id;
    this.rules = [];
    this.healthChecks = {};
    this.serviceState = new ServiceState();
    this.serviceStateHistory = new ServiceState();
    this.heartbeatTimers = {};
}

ServiceMonitor.prototype.addRule = function(rule) {
    this.rules.push(rule);
    if (rule.ruleType === "heartbeat") {
        logger.debug("Listening for heartbeat for " + rule.service_id + " every " + rule.value + " minutes");
        this.listenForHeartbeat(rule);
    }
}

ServiceMonitor.prototype.addHealthCheck = function(healthCheck) {
    this.healthChecks[healthCheck.id] = healthCheck;
        healthCheck.initCheck(this);
}

ServiceMonitor.prototype.updateHealthCheck = function(healthCheck) {
    if (this.healthChecks[healthCheck.id]) {
        this.healthChecks[healthCheck.id].reset();
    }
    this.healthChecks[healthCheck.id] = healthCheck;
    this.serviceState.checkStates[healthCheck.id] = [];
    healthCheck.initCheck(this);
}

ServiceMonitor.prototype.getHealthCheck = function(healthCheckId) {
    if (this.healthChecks[healthCheckId]) {
       return this.healthChecks[healthCheckId];
    }

    return null;
}


ServiceMonitor.prototype.reset = function() {
    for(var i in this.healthChecks) {
        this.healthChecks[i].reset();
    }
    this.healthChecks = {};
    this.serviceState = new ServiceState();
}

ServiceMonitor.prototype.updateRuleState = function(ruleState) {
    var stateExisted = false;
    if (this.serviceState.ruleStates === undefined) {
        this.serviceState.ruleStates = [];
        this.serviceState.ruleStates.push(ruleState);
    } else {
        for (var i in this.serviceState.ruleStates) {
            var oldRuleState = this.serviceState.ruleStates[i];
            if (ruleState.rule.id === oldRuleState.rule.id) {
                this.serviceState.ruleStates[i] = ruleState;
                stateExisted = true;
                break;
            }
        }
        if (!stateExisted) {
            this.serviceState.ruleStates.push(ruleState);
        }
    }
    var historyRuleState = new RuleState(ruleState.state, ruleState.rule, ruleState.lastReceived, ruleState.value)
    if (this.serviceStateHistory.ruleStates === undefined) {
        this.serviceStateHistory.ruleStates = [];
        this.serviceStateHistory.ruleStates.push(historyRuleState);
    } else {
        var stateCount = 0;
        var earliestStateTime = new Date();
        var earliestStateIndex = -1;
        for (var i in this.serviceStateHistory.ruleStates) {
            var oldRuleState = this.serviceStateHistory.ruleStates[i];
            if (historyRuleState.rule.id === oldRuleState.rule.id) {
                stateCount++;
                if (oldRuleState.lastReceived < earliestStateTime) {
                    earliestStateIndex = i;
                    earliestStateTime = oldRuleState.lastReceived;
                }
            }
        }

        if (stateCount >= HISTORY_TO_KEEP) {
            this.serviceStateHistory.ruleStates.splice(earliestStateIndex, 1);
        }
        this.serviceStateHistory.ruleStates.push(historyRuleState);
    }
}

ServiceMonitor.prototype.updateCheckState = function(healthCheckState) {
    var stateExisted = false;
    if (this.serviceState.checkStates[healthCheckState.healthCheck.id]) {
        var history = this.serviceState.checkStates[healthCheckState.healthCheck.id];
        var found = false;
        for(var i = 0; i < history.length; ++i) {
            if (history[i].stateId == healthCheckState.stateId) {
                found = true;
            }
        }
        if (!found) {
            if (history.length >= HISTORY_TO_KEEP) {
                history.splice(0, 1);
            }
            this.serviceState.checkStates[healthCheckState.healthCheck.id].push(healthCheckState);
        }
    } else {
        this.serviceState.checkStates[healthCheckState.healthCheck.id] = [];
        this.serviceState.checkStates[healthCheckState.healthCheck.id].push(healthCheckState);
    }
}


ServiceMonitor.prototype.getRuleStateByRuleId = function(ruleId) {
	if (this.serviceState === undefined) {
        return undefined;
    }
    for (var i in this.serviceState.ruleStates) {
        var ruleState = this.serviceState.ruleStates[i];
        if (ruleState.rule.id === ruleId) {
            return ruleState;
        }
    }
}

ServiceMonitor.prototype.getHealthCheckStateById = function(healthCheckId, stateId) {
	if (this.serviceState === undefined) {
        return undefined;
    }

    var history = this.serviceState.checkStates[healthCheckId];
    for (var i = 0; i < history.length; ++i) {
        if (history[i].stateId == stateId) {
            return history[i];
        }
    }
}

ServiceMonitor.prototype.getCurrentCheckStateByCheckId = function(healthCheckId) {
    if (this.serviceState === undefined) {
        return undefined;
    }

    var history = this.serviceState.checkStates[healthCheckId];
    var lastState = null;
    if (!history) {
        return lastState;
    }
    for (var i = history.length - 1; i >= 0; --i) {
        lastState = history[i];
        if (lastState.state != StateEnum.PROCESSING) {
            return lastState;
        }
    }
    return lastState;
}


ServiceMonitor.prototype.checkHeartbeat = function(rule) {
    var ruleState = this.getRuleStateByRuleId(rule.id);
    if (ruleState === undefined) {
        ruleState = new RuleState(StateEnum.ERROR, rule, new Date(), (rule.value * ONE_MIN));
    } else if (ruleState.lastReceived.getTime() + (rule.value * ONE_MIN) <= new Date().getTime()) {
        ruleState.state = StateEnum.ERROR;
    } else {
        ruleState.state = StateEnum.HEALTHY;
    }
    ruleState.lastReceived = new Date();
    this.updateRuleState(ruleState);
    this.listenForHeartbeat(rule);
}

ServiceMonitor.prototype.listenForHeartbeat = function(rule) {
    var minutes = rule.value;
    var serviceMonitor = this;
    this.heartbeatTimers[rule.id] = setTimeout(function() {
        serviceMonitor.checkHeartbeat(rule);
    },
    minutes * ONE_MIN);
}

exports.ServiceMonitor = ServiceMonitor;