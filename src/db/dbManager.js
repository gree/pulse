var instance = require("./mySqlDbManager");

function getInstance() {
    return instance;
}

exports.getInstance = getInstance;