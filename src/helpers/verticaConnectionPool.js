var poolModule = require('generic-pool');
var logger = require("./logger").getInstance();
var instances = {}; 

function VerticaConnectionPool(user, password, database, host, port){
    var pool = poolModule.Pool({
        name     : 'vertica',
        create   : function(callback) {
            var vertica = require('vertica');
            var client = vertica.connect({user: user, password: password, database: database, host: host, port: port}, function(err) {
                if(err){
                    callback(err, null);
                    return;
                }
                else{
                    callback(null, client);
                }
            });
            
            client.connection.on('error', function (err) {
                callback(err, null);
                return;
            });
            
            client.on('error', function(error){
                callback(error, null);
                return;
            });
            // parameter order: err, resource
            // new in 1.0.6
        },
        destroy  : function(client,callback) { 
            try {
              client.disconnect();
          } catch (err) {
              logger.error('client.disconnect error');
              logger.error(err.stack);
              if(callback) callback(err);
          }  
          client.connection.on('error', function (err) {
              callback(err, null);
              return;
          });
          
          client.on('error', function(error){
              callback(error, null);
              return;
          });
        },
        max      : 1,
        idleTimeoutMillis : 30000, // need to decide on an appropriate value
        log : false
    });
    logger.info("VERTICA POOOOL CREATED with " + user + " " + password + " " + database + " " + host + " " + port);
    return pool;
}
function getInstance(user, password, database, host, port){
    if(!instances[user + password + database + host + port]){
        var pool = VerticaConnectionPool(user, password, database, host, port);
        instances[user + password + database + host + port] = pool;
    }

    return instances[user + password + database + host + port];
}

exports.getInstance = getInstance;
