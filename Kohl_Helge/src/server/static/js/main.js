var datetime = Vue.component('vue-datetime', window.VueDatetime.Datetime);
datetime.options.props.minuteStep.default = 5
datetime.options.props.inputClass.default = "form-control mr-sm-2"

var filter = new Vue({
    el: '#app',
    data: {
        activeSide: "search",
        keywords:{
            types: [
                'Titel',
                'Untertitel',
                'Beschreibung'
            ],
            concatTypes: [
                'und',
                'oder'
            ],
            data: [
                {   
                    negate: false,
                    concatType: '',
                    type: 'Titel',
                    input: ''
                },
            ],
        },
        channels:{
            concatTypes: [
                'und',
                'oder'
            ],
            data: [
                {   
                    negate: false,
                    concatType: '',
                    input: ''
                },
            ],
        },
        datePicker:{
            visible: false,
            start:{
                value: '',
                placeholder: 'Start'
            },
            end:{
                value: '',
                placeholder: 'Ende'
            },
        },
    },
    methods:{
        addKeywordInput() {
            filter.keywords.data.push({negate: false, concatType: 'und', type: 'Titel', input: ''})
        },
        removeKeywordInput(item) {
            filter.keywords.data.splice(filter.keywords.data.indexOf(item),1)
        },
        addChannelInput() {
            filter.channels.data.push({negate: false, concatType: 'und', input: ''})
        },
        removeChannelInput(item) {
            filter.channels.data.splice(filter.channels.data.indexOf(item),1)
        },
    }
})

