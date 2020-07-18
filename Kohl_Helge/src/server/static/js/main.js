var datetime = Vue.component('vue-datetime', window.VueDatetime.Datetime);
datetime.options.props.minuteStep.default = 5
datetime.options.props.inputClass.default = "form-control mr-sm-2"


var filter = new Vue({
    el: '#app',
    data: {
        today: "2020-07-16T00:00:00.000+02:00",
        language: "ger",
        activeSide: "search",
        keywords:{
            data: [
                {   
                    id: 0,
                    negate: false,
                    concatType: '',
                    type: 'title',
                    input: 'Bayern'
                },
            ],
        },
        channels:{
            data: [
                {
                    id: 0,
                    negate: false,
                    concatType: 'AND',
                    input: ''
                },
            ],
        },
        start:{
            from: '',
            till: '',
        },
        stop:{
            from: '',
            till: '',
        },
        queryResult:{
            currentPage: 1,
            perPage: 10,
            numFound: 0,
            data: []
        }
    },
    methods:{
        addKeywordInput() {
            filter.keywords.data.push({negate: false, concatType: 'AND', type: 'title', input: ''})
        },
        removeKeywordInput(item) {
            filter.keywords.data.splice(filter.keywords.data.indexOf(item),1)
        },
        addChannelInput() {
            filter.channels.data.push({negate: false, concatType: 'AND', input: ''})
        },
        removeChannelInput(item) {
            filter.channels.data.splice(filter.channels.data.indexOf(item),1)
        },
        requestData () {
            requestData();
        },
        parseStrToTime(str) {
            time = str.split("T");
            time = time[1].replace("Z", "");
            time = time.substring(0, time.length - 3);

            return time;
        },
        parseStrToDate(str) {
            date = str.split("T");
            date = date[0].split("-");
            transformedDate = date[2] + "." + date[1] + "." + date[0];
            
            return transformedDate;
        },
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
    },
    watch: {
        'queryResult.currentPage': function(){
            requestData();
        },
        'language': function(){
            requestData();
        }
    }
})

function requestData(){
    var start = {
        from: "*",
        till: "*"
    };
    var stop = {
        from: "*",
        till: "*"
    };

    if(filter.start.from != "") start.from = filter.start.from.slice(0, -10) + "Z";
    if(filter.start.till != "") start.till = filter.start.till.slice(0, -10) + "Z";
    if(filter.stop.from != "") stop.from = filter.stop.from.slice(0, -10) + "Z";
    if(filter.stop.till != "") stop.till = filter.stop.till.slice(0, -10) + "Z";

    axios.post("search", JSON.stringify({
        language: filter.language,
        keywords: filter.keywords.data,
        channel: filter.channels.data,
        start: start, 
        stop: stop,
        rows: (filter.queryResult.perPage * filter.queryResult.currentPage),
    }))
    .then(response => {
        filter.queryResult.numFound = response.data.response.numFound;
        filter.queryResult.data = response.data.response.docs;

        console.log(filter.queryResult.data)
        if(filter.queryResult.currentPage > filter.queryResult.numFound/10 + 1){
            filter.queryResult.currentPage = 1;
        }
    })
}
