// Create client
var client = {
    host: '127.0.0.1',
    port: '8983',
    core: 'epg',
    protocol: 'http', 
    url: function() {
        return url = client.protocol + "://" + client.host + ":" + client.port + "/solr/" + client.core; 
    }
}

exports.client = client;