var serviceListener = require("./serviceListener");
var util = require("util");
// -1 for disabled because the sorting algorithm for view is based on the numbers. Hence, for disabled to be at the bottom most, it needs to have the lowest value
StateEnum = {
    DISABLED: -1,
    HEALTHY: 0,
    PROCESSING : 1,
    ERROR: 2
};

/**
 * Rules are checks created to evaluate whether a metric sent from an outside source is within
 * correct operational bounds
 */


function Rule(key, value, timeCreated, timeModified, ruleType, id, service_id, ruleName) {
    this.key = key;
    this.value = value;
    this.timeCreated = timeCreated;
    this.timeModified = timeModified;
    this.ruleType = ruleType;
    this.id = id;
    this.service_id = service_id;
    this.ruleName = ruleName;

}

function RuleState(state, rule, lastReceived, value) {
    this.state = state;
    this.rule = rule;
    this.lastReceived = lastReceived;
    this.value = value;
}

function MinThresholdRule(key, value, timeCreated, timeModified, ruleType, id, service, ruleName) {
    MinThresholdRule.super_.call(this, key, value, timeCreated, timeModified, ruleType, id, service, ruleName);
}
util.inherits(MinThresholdRule,Rule);
MinThresholdRule.prototype.check = function(message) {
    var state = StateEnum.HEALTHY;
    if (message.value < this.value) {
        state = StateEnum.ERROR;
    }
    return new RuleState(state, this, new Date(), message.value);
}

function MaxThresholdRule(key, value, timeCreated, timeModified, ruleType, id, service, ruleName) {
    MaxThresholdRule.super_.call(this, key, value, timeCreated, timeModified, ruleType, id, service, ruleName);
}
util.inherits(MaxThresholdRule,Rule);
MaxThresholdRule.prototype.check = function(message) {
    var state = StateEnum.HEALTHY;
    if (message.value > this.value) {
        state = StateEnum.ERROR;
    }
    return new RuleState(state, this, new Date(), message.value);
}

function MinPercentIncreaseRule(key, value, timeCreated, timeModified, ruleType, id, service, ruleName) {
    MinPercentIncreaseRule.super_.call(this, key, value, timeCreated, timeModified, ruleType, id, service, ruleName);
}
util.inherits(MinPercentIncreaseRule,Rule);
MinPercentIncreaseRule.prototype.check = function(message) {
    var oldValue;
    var serviceMonitors = serviceListener.getServiceMonitors();
    var serviceMonitor = serviceMonitors[message.service_id];
    var ruleState = serviceMonitor.getRuleStateByRuleId(this.id);
    if (ruleState !== undefined) {
        oldValue = ruleState.value;
    }
    var state = StateEnum.HEALTHY;
    if (message.value < (oldValue + (oldValue * (this.value / 100)))) {
        state = StateEnum.ERROR;
    }
    return new RuleState(state, this, new Date(), message.value);

}

function MaxPercentDecreaseRule(key, value, timeCreated, timeModified, ruleType, id, service_id, ruleName) {
    MaxPercentDecreaseRule.super_.call(this, key, value, timeCreated, timeModified, ruleType, id, service_id, ruleName);
}
util.inherits(MaxPercentDecreaseRule,Rule);
MaxPercentDecreaseRule.prototype.check = function(message) {
    var oldValue;
    var serviceMonitors = serviceListener.getServiceMonitors();
    var serviceMonitor = serviceMonitors[message.service_id];
    var ruleState = serviceMonitor.getRuleStateByRuleId(this.id);
    if (ruleState !== undefined) {
        oldValue = ruleState.value;
    }
    var state = StateEnum.HEALTHY;
    if (message.value < (oldValue - (oldValue * (this.value / 100)))) {
        state = StateEnum.ERROR;
    }
    return new RuleState(state, this, new Date(), message.value);

}

function HeartbeatRule(key, value, timeCreated, timeModified, ruleType, id, service, ruleName) {
    HeartbeatRule.super_.call(this, key, value, timeCreated, timeModified, ruleType, id, service, ruleName);
}
util.inherits(HeartbeatRule,Rule);
HeartbeatRule.prototype.check = function(message) {
    return new RuleState(StateEnum.HEALTHY, this, new Date(), message.value);
}

exports.Rule = Rule;
exports.RuleState = RuleState;
exports.MinThresholdRule = MinThresholdRule;
exports.MaxThresholdRule = MaxThresholdRule;
exports.MinPercentIncreaseRule = MinPercentIncreaseRule;
exports.MaxPercentDecreaseRule = MaxPercentDecreaseRule;
exports.HeartbeatRule = HeartbeatRule;
exports.StateEnum = StateEnum;