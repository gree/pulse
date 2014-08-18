var serviceListener = require("../model/serviceListener");

function sortHealthChecksForDisplay(s1, s2) {
    var state_compare = sortByState(s1, s2);
    if (!state_compare) { // compare service names
        var service_name_compare = sortByServiceName(s1, s2);
        if (!service_name_compare) { // compare names
            return sortByName(s1, s2);
        }
        return service_name_compare;
    }
    return state_compare;
}

function sortServicesForDisplay(s1, s2) {
    var state_compare = sortByState(s1, s2);
    if (!state_compare) { // comapare names
        return sortByName(s1, s2);
    }
    return state_compare;
}

function sortTemplatesForDisplay(t1,t2){
    return sortByName(t1,t2);
}

function sortByServiceName(h1, h2) {
    var services = serviceListener.getServices();
    var h1_service_name = services[h1.service_id].name;
    var h2_service_name = services[h2.service_id].name;
    
    return compare(h1_service_name, h2_service_name);
}

function sortByState(s1,s2){
    return compare(s2.state, s1.state);
}

function sortByName(s1,s2){
    return compare(s1.name, s2.name);
}

//Sorts two objects ascending
function compare(s1, s2) {
    if (s1 == s2) {
        return 0;
    } else if (s1 > s2) {
        return 1;
    }
    return -1;
}

exports.sortHealthChecksForDisplay = sortHealthChecksForDisplay;
exports.sortServicesForDisplay = sortServicesForDisplay;
exports.sortTemplatesForDisplay = sortTemplatesForDisplay;