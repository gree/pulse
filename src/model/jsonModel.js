function JsonModel(payload, jsonFields) {
    this.payload = payload;
    this.jsonFields = this.jsonFields;
}

JsonModel.prototype.getJsonFields = function() {
    return {};
}


JsonModel.prototype.encode = function () {
    var payload = {};
    var jsonFields = this.getJsonFields();

    if (!jsonFields){
        return payload;
    }

    for(var field in jsonFields) {
        if (this[field]) {
            payload[field] = this[field];
        }
    }
    payload = JSON.stringify(payload);
    this.payload = payload;

    return payload;
}

JsonModel.prototype.decode = function () {
    var payload = {};
    var jsonFields = this.getJsonFields();

    if (this.payload) {
        payload = JSON.parse(this.payload);
    }

    for(var field in jsonFields) {
        var type = jsonFields[field][0];
        if (payload[field]) {
            var value = payload[field];
            if (type == 'string') {
                value = value.toString();
            } else if (type == 'number') {
                value = parseFloat(value);
            } else if (type == 'int') {
                value = parseInt(value);
            }
            this[field] = value;
        }
    }
}


exports.JsonModel = JsonModel;