Vue.component("ui-db", {
  computed: {
    sheetName: function() {
      return this.index.activeSheet.name;
    },
    url: function() {
      return "db/"+this.sheetName;
    }
  },
  created: function() {
    this.getDb();
  },
  data: function() {
    return {
      index: index,
      db: []
    };
  },
  methods: {
    getDb: function() {
      var self = this;
      api.get(this.url).then(function(res){
        self.db = res.last;
      });
    }
  },
  template: `
    <div class="grid-x">
      <div class="cell small-12 borderB">
        <ui-db-tools />
      </div>
      <div class="cell medium-4 pad30">
        <ui-form :sheetName="sheetName" />
      </div>
      <transition name="slide-fade">
      <div v-if="db.length>0" class="cell medium-8 pad30">
        <ui-obj v-for="obj in db" :obj="obj" :objTitle="obj.name" :url="url" />
      </div>
      </transition>
    </div>
  `,
  watch: {
    sheetName: function() {
      this.getDb();
    }
  }
});