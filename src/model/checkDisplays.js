var util = require("util");
/**
 *   Display Information for each Health Check
 *
 */


function CheckDisplay() {
    // Metadata
    this.displayName;
    this.description;
    
    // Display names for each field    
    this.name = "Name";
    this.value = "Value";
    this.period = "Period (s)";
    this.property = "Property";
    this.path = "Path";
    this.email = "Email or Phone Number";
    this.notificationDelay = "Notification Delay";
}

function ServerHealthCheckDisplay() {
    ServerHealthCheckDisplay.super_.call(this);
    this.displayName = "Url Health Check";
    this.description = "This health check will try to access a Url and grep the response for a value.";
    this.dynamic_config = "Configs";
    this.property = "Hostnames";
}
util.inherits(ServerHealthCheckDisplay, CheckDisplay);


function MemcacheHealthCheckDisplay() {
    MemcacheHealthCheckDisplay.super_.call(this);
    this.displayName = "Memcache Health Check";
    this.description = "This health check will connect to memcached servers and set and get a value.";
    this.dynamic_config = "Configs";
    this.property = "Hostnames";
    this.path = undefined;
}
util.inherits(MemcacheHealthCheckDisplay, CheckDisplay);

function GraphiteHealthCheckDisplay() {
    GraphiteHealthCheckDisplay.super_.call(this);
    this.displayName = "Graphite Health Check";
    this.description = "This health check will try to check graphite for a value.";
    
    this.property = "Hostnames";
}
util.inherits(GraphiteHealthCheckDisplay, CheckDisplay);

function SshHealthCheckDisplay() {
    SshHealthCheckDisplay.super_.call(this);
    this.displayName = "SSH Health Check";
    this.description = "This health check will try to check the server via SSH.";

    this.property = "Hostnames";
    this.path = "Command";
}
util.inherits(SshHealthCheckDisplay, CheckDisplay);


function DatabaseHealthCheckDisplay() {
    DatabaseHealthCheckDisplay.super_.call(this);
    this.displayName = "Database Health Check";
    this.description = "This health check will try to get a value from a database table.";
    this.dynamic_config = "Configs";
    this.property = "Database Connection";
    this.path = "Query (optional)"
}
util.inherits(DatabaseHealthCheckDisplay, CheckDisplay);


function getHealthCheckDisplay(checkType) {
    var checkType = getAllHealthCheckDisplays()[checkType];
    return checkType;
}

function VerticaHealthCheckDisplay() {
    VerticaHealthCheckDisplay.super_.call(this);
    this.displayName = "Vertica Health Check";
    this.description = "This health check will try to get a value from the Vertica table.";

    this.property = "Database Connection";
    this.path = "Query (optional)"
}
util.inherits(VerticaHealthCheckDisplay, CheckDisplay);

function BusinessIntelligenceCheckDisplay() {
    BusinessIntelligenceCheckDisplay.super_.call(this);
    this.displayName = "Business Intelligence Check";
    this.description = "This intelligence check will try to get a value from the Vertica table based on some bounds.";
    
    this.property = "Database Connection";
    this.path = "Query (the value to check)";
    this.value = "Boundry options";
}
util.inherits(BusinessIntelligenceCheckDisplay, CheckDisplay);


function getAllHealthCheckDisplays() {
    return {
    'ServerHealthCheck': new ServerHealthCheckDisplay(),
    'DatabaseHealthCheck': new DatabaseHealthCheckDisplay(),
    'VerticaHealthCheck' : new VerticaHealthCheckDisplay(),
    'GraphiteHealthCheck': new GraphiteHealthCheckDisplay(), 
    'MemcacheHealthCheck': new MemcacheHealthCheckDisplay(),
    'SshHealthCheck'     : new SshHealthCheckDisplay(),
    'BusinessIntelligenceCheck' : new BusinessIntelligenceCheckDisplay()
    };
}

exports.getHealthCheckDisplay = getHealthCheckDisplay
exports.getAllHealthCheckDisplays = getAllHealthCheckDisplays
exports.ServerHealthCheckDisplay = ServerHealthCheckDisplay
exports.MemcacheHealthCheckDisplay = MemcacheHealthCheckDisplay
exports.DatabaseHealthCheckDisplay = DatabaseHealthCheckDisplay
exports.GraphiteHealthCheckDisplay = GraphiteHealthCheckDisplay
exports.VerticaHealthCheck = VerticaHealthCheckDisplay
exports.SshHealthCheckDisplay = SshHealthCheckDisplay
exports.BusinessIntelligenceCheckDisplay = BusinessIntelligenceCheckDisplay
