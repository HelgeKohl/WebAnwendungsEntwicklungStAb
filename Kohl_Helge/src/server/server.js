var http = require('http');
var fs = require('fs');
var path = require('path');
var axios = require('axios');
var solr = require('./static/js/solr-helper.js');

// builds the search query for solr
function buildQuery(data){
    var url = solr.client.url() + "/select?hl=on&hl.fl=*&facet=on&q="
    var query = "";

    data['keywords'].forEach(element => {
        if(element.input != ""){
            // only append concat type if its not the first attribute
            if(query != ""){
                query += " " + element.concatType + " ";
            }
            if(element.negate){
                query += "-";
            }
            // concat searchfield to query
            query += element.type + "_" + data['language'] + ":\"" + replaceAll(element.input, "\"", "\\\"") + "\"";
        }
    });

    // remove empty channel inputs
    for (let index = 0; index < data['channel'].length; index++) {
        if(data['channel'][index].input === ""){
            data['channel'].splice(index, 1);
            index -= 1;
        }
    }

    if(data['channel'].length > 0){
        if(query !== "") query += " AND ";
        query += "(";
        data['channel'].forEach(element =>{ 
            // only append concat type if its not the first attribute
            if(data['channel'].indexOf(element) != 0){
                query += " OR ";
            }
            if(element.negate){
                query += "(*:* AND "
                query += "-";
            }
            // concat searchfield to query
            query += "channel:" + "\"" + replaceAll(element.input, "\"", "\\\"") + "\"";
            if(element.negate){
                query += ")"
            }
        });
        query += ") ";
    }

    if(query !== "") query += "AND ";

    // any language field must be != null
    query +=  "(" + "title_" + data['language'] + ":[* TO *]"
                                + " OR subtitle_" + data['language'] + ":[* TO *]"
                                + " OR desc_" + data['language'] + ":[* TO *]" + ")";

    var facets = {}  

    // date facets
    facets['today'] = encodeURIComponent("start:[" + data['now'] + "/DAY TO " + data['now'] + "/DAY+1DAY]");
    facets['tomorrow'] = encodeURIComponent("start:[" + data['now'] + "/DAY+1DAY TO " + data['now'] + "/DAY+2DAY]");
    facets['yesterday'] = encodeURIComponent("start:[" + data['now'] + "/DAY-1DAY TO " + data['now'] + "/DAY]");
    facets['nextN'] = encodeURIComponent("start:[" + data['now'] + "/DAY TO " + data['now'] + "/DAY+" + data['n'] + "DAYS]");
    facets['previousN'] = encodeURIComponent("start:[" + data['now'] + "/DAY-" + data['n'] + "DAYS TO " + data['now'] + "/DAY]");

    // date facets + facetfield channel
    facetquery = "";
    Object.keys(facets).forEach(key => {
        facetquery += "&facet.query=" + facets[key];
    });

    facetquery += "&facet.field=channel";

    // handles selected facets
    var filter = createFilterQuery(facets, data['filter']);
    
    
    if(data['filter'].length === 0) filter += "start:" + encodeURIComponent("[* TO *]");

    // query daterange for start and stop, default is [* TO *]
    var startrange = " AND start:[" + data['start'].from + " TO " + data['start'].till + "]";
    var stoprange = " AND stop:[" + data['stop'].from + " TO " + data['stop'].till + "]";
    
    query = url + encodeURIComponent(query + startrange + stoprange) + facetquery + filter;
    
    // add sorting
    if(data['sortBy'] !== undefined){
        query += encodeURI("&sort=" + data['sortBy'] + " " + data['sort']);
    }

    // result range
    query += "&rows="+ data['rows'] + "&start=" + (data['currentPage'] * data['rows'] - data['rows']);
    return query;
}

// creates a filterquery for active facets
function createFilterQuery(facets, filter){
    let dateQuery = "";
    let channelQuery = "";

    for(let i = 0; i < filter.date.length; i++){
        if(i != 0){
            dateQuery += encodeURIComponent(" OR ");
        }
        else if(i === 0){
            dateQuery = "&fq=";
        }
        dateQuery += facets[filter.date[i]];
    }

    for(let i = 0; i < filter.channel.length; i++){
        if(i != 0){
            channelQuery += encodeURIComponent(" OR ");
        }
        else if(i === 0){
            channelQuery = "&fq=";
        }
        channelQuery += encodeURIComponent("channel:\"" + filter.channel[i] + "\"");
    }

    return dateQuery + channelQuery;
}

// builds the suggestion query for solr
function buildSuggestionQuery(data){
    var url = solr.client.url() + "/suggest?suggest=true&suggest.build=false";

    var suggestDict = "&suggest.dictionary=" + data['type'] + "_suggester_" + data['language'];
    var suggestInput = "&suggest.q=" + encodeURIComponent(data['input']) + "&wt=json";

    url += suggestDict + suggestInput;
    return url;
}

// replaces all occurrences of a specific character in a string
function replaceAll(str, find, replace) {
    if(str != undefined){
        return str.replace(new RegExp(find, 'gm'), replace);
    }
    else return str;
}

// checks if an object is already in array
function containsObject(obj, list) {
    for (let i = 0; i < list.length; i++) {
        if (list[i].id === obj.id) {
            return true;
        }
    }

    return false;
}

function isFavourite(obj){
    var currentData;
    // check if aufnahme.json exists
    if(!fs.existsSync('aufnahme.json')){
        fs.appendFile('aufnahme.json', '[]', function (err) {
            if (err) throw err;
        });
    }

    // get currentData
    var rawdata = fs.readFileSync('aufnahme.json');
            
    // if file is empty
    if(rawdata.length == 0){
        currentData = [];
    }
    else{
        currentData = JSON.parse(rawdata);
    }

    if(containsObject(obj, currentData)) return true;
    else return false;
}

// adds <em>-tag
function highlight(old, to){
    // matches everything between <em></em> including the tag
    exp = new RegExp(/<em>(.*?)<\/em>/ugm);

    var toHighlightStr;
    while((toHighlightStr = exp.exec(to)) !== null){
        /*  replace every occurrence of each highlighting string
            (?<![0-9]|<em>) only replace if there are no numbers before or there is already an <em> tag
            (?![0-9]|<\/em>|[^<>]*>) only replace if there are no numbers after or there is already an </em> tag
                                     and this occurence is not in a link
        */
        old = replaceAll(old, "(?<![0-9]|<em>)" + toHighlightStr[1]+ "(?![0-9]|<\/em>|[^<>]*>)", toHighlightStr[0]);
    }

    return old;
}

// adds imdb link
function addStaffLinks(description){
    if(description === undefined){
        return;
    }
    // matches staff excluding artists
    staffExp = new RegExp(/(?<=^(?:(?:.*Regie|Drehbuch|Autor|Komponist|Kamera|Schnitt|Buch\/Autor|Musik|): )|(?:^(?:.*Regie|Drehbuch|Autor|Komponist|Kamera|Schnitt|Buch\/Autor|Musik|): ([A-Za-zÀ-ÖØ-öø-ÿ. ]*, )*))(?:(?:[A-Za-zÀ-ÖØ-öø-ÿ. ]+))/gm);
    
    description = description.replace(staffExp, (match) => {                
        return "<a href=\"https://www.imdb.com/find?q=" + encodeURI(match) + "\" target=\"_blank\">" + match + "</a>";
    })

    // matches artists
    artistExp = new RegExp(/(?<=(Darsteller:)(\n.*)*)((?:(?:^[A-Za-zÀ-ÖØ-öø-ÿ ]*)(?= \()|(?<=^[A-Za-zÀ-ÖØ-öø-ÿ ]+ - )([A-Za-zÀ-ÖØ-öø-ÿ ]*)))/gm);
    description = description.replace(artistExp, (match) => {
        return "<a href=\"https://www.imdb.com/find?q=" + match + "\" target=\"_blank\">" + match + "</a>";
    })

    return description;
}

function addMovieLink(query){
    if(query === undefined){
        return false;
    }
    let link = "https://mediathekviewweb.de/#query=" + replaceAll(query, " ", "%20");

    return link;
}

http.createServer(function (req, res) {
    var filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './static/index.html';
    }
    console.log(filePath)

    if(req.method === 'POST'){
        var body = '';

        req.on('data', function (data) {
            body += data;

            // Too much POST data, kill the connection!
            // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
            if (body.length > 1e6)
            req.connection.destroy();
        });
        
        // request epg data
        if(filePath === './search'){
            req.on('end', function () {
                var post = JSON.parse(body);

                var rawdata = fs.readFileSync('logofiles.json');
                var logofilesJSON = JSON.parse(rawdata);

                var strQuery = buildQuery(post);

                axios.get(strQuery)
                .then((response) => {
                    response.data.response.docs.forEach(element => {
                        let elementKeys = Object.keys(response.data.highlighting[element['id']]);
                        let title = 'title_' + post['language'];
                        let subtitle = 'subtitle_' + post['language'];
                        let description = 'desc_' + post['language'];

                        // add logofilepath and channeltype
                        element['logofile'] = logofilesJSON[element.channel][0];
                        element['channeltype'] = logofilesJSON[element.channel][1];
                        
                        // add links to description
                        element[description] = addStaffLinks(element[description])

                        // add link to title and subtitle
                        element['titleLink'] = addMovieLink(element[title])
                        element['subtitleLink'] = addMovieLink(element[subtitle])

                        // add highlighting
                        for (var key of elementKeys){
                            element[key] = highlight(element[key], response.data.highlighting[element['id']][key][0])
                        }
                        
                        // add favourite bool
                        element['isFavourite'] = isFavourite(element);

                        // replace linebreaks
                        element[description] = replaceAll(element[description], "\n", "</br>");
                        element[subtitle] = replaceAll(element[subtitle], "\n", "</br>");
                    });

                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(response.data));
                }).catch((err) => {
                    console.log(err);
                    fs.readFile('./404.html', function(error, content) {
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end(content, 'utf-8');
                    });
                });
            });
        }
        // request favourites
        else if(filePath === './favourites'){
            req.on('end', function() {
                var rawdata = fs.readFileSync('aufnahme.json');
                var post = JSON.parse(body);
                var responseObject = []
                var index = (post['currentPage'] * post['rows'] - post['rows']);

                if(rawdata.length != 0){
                    var currentData = JSON.parse(rawdata);
                }
                else var currentData = []

                // get result by pagination
                for(; index < post['rows'] * post['currentPage'] && index < currentData.length; index++){
                    responseObject.push(currentData[index]);
                }

                // add favourite bool
                responseObject.forEach(element => {
                    element['isFavourite'] = true;
                });

                // prepare response
                var response = {
                    response: responseObject,
                    numFound: currentData.length,
                    perPage: post['rows']
                }

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(response));
            })
        }
        // adds to aufnahme.json
        else if(filePath === './addFavourite'){
            req.on('end', function() {
                var post = JSON.parse(body);
                var currentData;
                // check if aufnahme.json exists
                if(!fs.existsSync('aufnahme.json')){
                    fs.appendFile('aufnahme.json', '[]', function (err) {
                        if (err) throw err;
                    });
                }

                // get currentData
                var rawdata = fs.readFileSync('aufnahme.json');
                
                // if file is empty
                if(rawdata.length === 0){
                    currentData = [];
                }
                else{
                    currentData = JSON.parse(rawdata);
                }

                // dont store broadcasts twice
                if(!containsObject(post, currentData)){      
                    currentData.push(post);

                    // remove highlighting
                    currentData = JSON.stringify(currentData);
                    currentData = replaceAll(currentData, "<em>", "");
                    currentData = replaceAll(currentData, "</em>", "");

                    fs.writeFile('aufnahme.json', currentData, function (err) {
                        if (err) return console.log(err);
                    });
                }

                res.setHeader('Content-Type', 'application/json');
                res.end("added");
            })
        }
        // remove favourite from aufnahme.json
        else if(filePath === './removeFavourite'){
            req.on('end', function() {
                var post = JSON.parse(body);
                var rawdata = fs.readFileSync('aufnahme.json');
                var currentData = JSON.parse(rawdata);
                var indexToDelete;

                // find index
                currentData.find(function(element, index){             
                    if(element.id === post.id){
                        indexToDelete = index;
                    }
                });
                // remove
                currentData.splice(indexToDelete, 1);
                
                // overwrite file
                fs.writeFile('aufnahme.json', JSON.stringify(currentData), function (err) {
                    if (err) return console.log(err);
                });

                res.setHeader('Content-Type', 'application/json');
                res.end("removed");
            })
        }
        // request autocomplete suggestions
        else if(filePath === './suggest'){
            req.on('end', function () {
                var post = JSON.parse(body);

                // build query
                strQuery = buildSuggestionQuery(post);
                
                // send request
                axios.get(strQuery)
                .then((response) => {
                    var suggestions = [];
                    var suggester = post['type'] + "_suggester_" + post['language'];
                    var input = [post['input']];

                    // prepare response
                    var suggestionResponse = response.data.suggest[suggester][input].suggestions;
                    suggestionResponse.forEach(element => {
                        if(!suggestions.includes(replaceAll(element['term'], /<\/?b>/, ""))){
                            suggestions.push(replaceAll(element['term'], /<\/?b>/, ""));
                        }
                    });

                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(suggestions));
                })
                .catch((err) => {
                    console.log("Error:", err)
                    fs.readFile('./404.html', function(error, content) {
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end(content, 'utf-8');
                    });
                });
            });
        }
    }
    // handles file delivery
    else if(/^\.\/static\//.test(filePath)){
        var extname = String(path.extname(filePath)).toLowerCase();

        var mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
        };

        var contentType = mimeTypes[extname] || 'application/octet-stream';

        fs.readFile(filePath, function(error, content) {
            if(error) {
                if(error.code === 'ENOENT') {
                    fs.readFile('./404.html', function(error, content) {
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end(content, 'utf-8');
                    });
                }
                else {
                    res.writeHead(500);
                    res.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
                }
            }
            else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    }
    else{
        fs.readFile('./404.html', function(error, content) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
        });
    }
}).listen(8080);

console.log('Webserver wird ausgeführt.');