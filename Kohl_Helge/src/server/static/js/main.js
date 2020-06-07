var datetime = Vue.component('vue-datetime', window.VueDatetime.Datetime);
datetime.options.props.minuteStep.default = 5
datetime.options.props.inputClass.default = "form-control mr-sm-2"


var filter = new Vue({
    el: '#app',
    data: {
        searchInput:{
            value: '',
            placeholder: 'Suche'
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
})

