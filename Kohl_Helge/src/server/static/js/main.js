var datetime = Vue.component('vue-datetime', window.VueDatetime.Datetime);
datetime.options.props.minuteStep.default = 5
datetime.options.props.inputClass.default = "form-control mr-sm-2"

var filter = new Vue({
    el: '#app',
    data: {
        today: "2020-07-16T00:00:00.000+02:00",
        language: "ger",
        activeSide: "search",
        // keyword input
        keywords:[
            {   
                negate: false,
                concatType: '',
                type: 'title',
                input: '',
            },
        ],
        // channelinput
        channels:[
            {
                negate: false,
                input: '',
            },
        ],
        // datetime range start
        start:{
            from: '',
            till: '',
        },
        // datetime range stop
        stop:{
            from: '',
            till: '',
        },
        // requests results
        queryResult:{
            currentPage: 1,
            perPage: 10,
            numFound: 0,
            n: 5,
            dateFilter: [],
            channelFilter: [],
            loading: false,
            sort: "asc",
            sortBy: undefined,
            data: [],
            facets: {
                channel: []
            }
        },
        // suggestions for input fields
        suggestions:[],
    },
    methods:{
        // add keywordinput element
        addKeywordInput() {
            filter.keywords.push({negate: false, concatType: 'AND', type: 'title', input: ''})
        },
        // remove keywordinput element
        removeKeywordInput(item) {
            filter.keywords.splice(filter.keywords.indexOf(item),1)
        },
        // add channelinput element
        addChannelInput() {
            filter.channels.push({negate: false, concatType: 'AND', input: ''})
        },
        // remove channelinput element
        removeChannelInput(item) {
            filter.channels.splice(filter.channels.indexOf(item),1)
        },
        requestData () {
            requestData();
        },
        requestFavourites(){
            requestFavourites();
        },
        // parse datetime string to time string
        parseStrToTime(str) {
            time = str.split("T");
            time = time[1].replace("Z", "");
            time = time.substring(0, time.length - 3);

            return time;
        },
        // parse datetime string to date string
        parseStrToDate(str) {
            date = str.split("T");
            date = date[0].split("-");
            transformedDate = date[2] + "." + date[1] + "." + date[0];
            
            return transformedDate;
        },
        // change datepicker data by preset buttons
        changeTime(which ,from, to) {
            if(from == ""){
                from = filter.today;
            }

            date = from.split("T")[0];
            time = from.split("T")[1].split(":");
            time[1] = "00";

            switch(to){
                case "Vormittag":
                    time[0] = "06";
                    break;
                case "Nachmittag":
                    time[0] = "12";
                    break;
                case "Abend":
                    time[0] = "18";
                    break;
                case "Nacht":
                    time[0] = "00";
                    break;
            }

            if(which === "start"){
                filter.start.from = date + "T" + time.join(":")

                time[0] = (parseInt(time[0]) + 06).toString()
                if(time[0].length == 1){
                    time[0] = "0" + time[0];
                }
    
                filter.start.till = date + "T" + time.join(":")
            }
            else if(which === "stop"){
                filter.stop.from = date + "T" + time.join(":")

                time[0] = (parseInt(time[0]) + 06).toString()
                if(time[0].length == 1){
                    time[0] = "0" + time[0];
                }

                filter.stop.till = date + "T" + time.join(":")
            }
        },
        // request autocompletion suggestion
        getSuggestion(item){
            if(item.type != "desc"){
                if(item.type === undefined){
                    type = "channel";
                }
                else type = item.type;

                axios.post("suggest", JSON.stringify({
                    input: item.input,
                    type: type,
                    language: this.language,
                })).then(response => {
                    filter.suggestions = response.data
                }).catch(err => {
                    console.log(err);
                });
            }
        },
        // add item to favourite list
        addFavourite(item){
            axios.post("addFavourite", JSON.stringify(item))
            .then(response => {
                if(filter.activeSide === 'result'){
                    requestData();
                }
                else if(filter.activeSide === 'favourites'){
                    requestFavourites();
                }
            }).catch(err => {
                console.log(err);
            });
        },
        // remove item from favourite list
        removeFavourite(item){
            axios.post("removeFavourite", JSON.stringify(item))
            .then(response => {
                if(filter.activeSide === 'result'){
                    requestData();
                }
                else if(filter.activeSide === 'favourites'){
                    requestFavourites();
                }
            }).catch(err => {
                console.log(err);
            });
        },
        // removes datefilter
        removeDateFilter(dateFilter){
            var index = filter.queryResult.dateFilter.indexOf(dateFilter);
            filter.queryResult.dateFilter.splice(index, 1);
        },
        // prevents input of +/-/./,
        removeNonNumeric(event){
            event = (event) ? event : window.event;
            var charCode = (event.which) ? event.which : event.keyCode;
            if ((charCode > 31 && (charCode < 48 || charCode > 57))) {
                event.preventDefault();;
            } else {
                return true;
      }
        }
    },
    watch: {
        // on change get new data
        'queryResult.currentPage': function(){
            if(filter.activeSide === 'result'){
                requestData();
            }
            else if(filter.activeSide === 'favourites'){
                requestFavourites();
            }
        },
        'queryResult.perPage': function(){
            if(filter.queryResult.perPage > 100) filter.queryResult.perPage.slice(0,2);

            if(filter.activeSide === 'result'){
                requestData();
            }
            else if(filter.activeSide === 'favourites'){
                requestFavourites();
            }
        },
        'language': function(){
            requestData();
        },
        'queryResult.sort': function(){
            if(filter.queryResult.sortBy !== undefined){
                requestData();
            }
        },
        'queryResult.sortBy': function(){
            requestData();
        },
        'queryResult.dateFilter': function(){
            requestData();
        },
        'queryResult.channelFilter': function(){
            requestData();
        },
    }
})

// request by input
function requestData(){
    filter.queryResult.data = [];
    filter.queryResult.loading = true;

    var start = {
        from: "*",
        till: "*"
    };
    var stop = {
        from: "*",
        till: "*"
    };

    // prepare dateranges
    if(filter.start.from != "") start.from = filter.start.from.slice(0, -10) + "Z";
    if(filter.start.till != "") start.till = filter.start.till.slice(0, -10) + "Z";
    if(filter.stop.from != "") stop.from = filter.stop.from.slice(0, -10) + "Z";
    if(filter.stop.till != "") stop.till = filter.stop.till.slice(0, -10) + "Z";

    axios.post("search", JSON.stringify({
        language: filter.language,
        keywords: filter.keywords,
        channel: filter.channels,
        start: start, 
        stop: stop,
        filter: {
            date: filter.queryResult.dateFilter,
            channel: filter.queryResult.channelFilter
        },
        rows: filter.queryResult.perPage,
        currentPage: filter.queryResult.currentPage,
        sortBy: filter.queryResult.sortBy,
        sort: filter.queryResult.sort,
        n: filter.queryResult.n,
        now: filter.today.slice(0, -10) + "Z",
    }))
    .then(response => {
        filter.queryResult.numFound = response.data.response.numFound;
        filter.queryResult.data = response.data.response.docs;

        // reset current page if page is higher than pagesum
        if(filter.queryResult.currentPage > filter.queryResult.numFound/filter.queryResult.perPage + 1){
            filter.queryResult.currentPage = 1;
        }

        // date facets
        if(filter.queryResult.dateFilter.length === 0){
            filter.queryResult.facets['today'] = response.data.facet_counts.facet_queries[Object.keys(response.data.facet_counts.facet_queries)[0]];
            filter.queryResult.facets['tomorrow'] = response.data.facet_counts.facet_queries[Object.keys(response.data.facet_counts.facet_queries)[1]];
            filter.queryResult.facets['yesterday'] = response.data.facet_counts.facet_queries[Object.keys(response.data.facet_counts.facet_queries)[2]];
            filter.queryResult.facets['nextN'] = response.data.facet_counts.facet_queries[Object.keys(response.data.facet_counts.facet_queries)[3]];
            filter.queryResult.facets['previousN'] = response.data.facet_counts.facet_queries[Object.keys(response.data.facet_counts.facet_queries)[4]];
        }
        
        // channel facets
        if(filter.queryResult.channelFilter.length === 0){
            let channelFacets = [];
            let channelFacetResponse = response.data.facet_counts.facet_fields.channel;
    
            for (let index = 0; index < channelFacetResponse.length; index = index + 2) {
                if(channelFacetResponse[index+1] !== 0){
                    channelFacets.push([channelFacetResponse[index], channelFacetResponse[index+1]])
                }
            }
            filter.queryResult.facets.channel = channelFacets;
        }

        filter.queryResult.loading = false;
    }).catch(err => {
        console.log(err);
    });
}

// requests favourites
function requestFavourites(){
    filter.queryResult.data = [];
    filter.queryResult.loading = true;

    axios.post("favourites", JSON.stringify({
        rows: filter.queryResult.perPage,
        currentPage: filter.queryResult.currentPage,
    }))
    .then(response => {
        filter.queryResult.numFound = response.data.numFound;
        filter.queryResult.data = response.data.response;

        // reset current page if page is higher than pagesum
        if(filter.queryResult.currentPage > filter.queryResult.numFound/filter.queryResult.perPage + 1){
            filter.queryResult.currentPage = 1;
        }

        filter.queryResult.loading = false;
    }).catch(err => {
        console.log(err);
    });
}
