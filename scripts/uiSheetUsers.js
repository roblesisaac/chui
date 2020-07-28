var users = new Chain({
  steps: {
    getUsers: function() {
      var sheetName = index.activeSheet.name,
          self = this;
      api.get("permits/"+sheetName).then(function(res){
        users.db = res.last;
      });
    }
  },
  init: [
    "getUsers"  
  ],
  state: {
    db: []
  }
});

Vue.component("ui-sheet-users", {
  beforeDestroy: function() {
    users.db = [];
  },
  created: function() {
    users.init();
  },
  data: function() {
    return {
      formSchema: {
        username: "",
        db: {
          methods: ["get","put","post","delete"]
        },
        permits: {
          methods: ["get","put","post","delete"]
        },
        ui: {
          apps: ["all"]
        }
      },
      sheetName: index.activeSheet.name,
      users: users
    };
  },
  template: `
  <div class="grid-x">
    <div class="cell small-12 borderB">
      <ui-db-tools />
    </div>
    <div class="cell small-4 borderR">
      <ui-form :schema="formSchema" :url="'permits/'+sheetName" />
    </div>
    <div class="cell small-8">
      <transition name="slide-fade">
      <div v-if="users.db.length > 0" class="grid-x">
        <div v-for="user in users.db" class="cell medium-6 padding borderR borderB">
          <ui-obj :obj="user" :objTitle="user.username" :url="'permits/'+sheetName" />
        </div>
      </div>
      </transition>
    </div>
  </div>
  `
});