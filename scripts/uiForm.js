Vue.component("ui-form", {
  computed: {
    obj: function() {
      var schema = this.schema || {};
      if(this.sheetName) {
        schema = sheets.findOne({ name: this.sheetName }).db.schema;
        schema = emptyObj(schema); 
      }
      return Object.assign({}, schema);
    },
    dbPath: function() {
      return this.url ? this.url : "db/" + this.sheetName;
    }
  },
  methods: {
    save: function() {
      api.post(this.dbPath, this.obj).then(function(res){
        console.log(res.last);
      }).catch(function(err){
        console.log(err);
      });
    }
  },
  props: ["buttonIcon", "buttonText", "formTitle", "schema", "sheetName", "url"],
  template: `
    <form @submit.prevent="save" class="bgLight r10 pad20">
      <h5 class="text-center bold">
      <span class="colorBlue proper">{{ sheetName }} Form</span>
      </h5>
      <ui-obj :obj="obj" :settings="{open: true, locked: true}" />
      <button value="submit" class="button form">{{ buttonText || 'Submit' }} <i :class="buttonIcon || 'fi-save'"></i></button>
    </form>
  `
});