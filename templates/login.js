window.Vue.component("log-in", {
  data: function() {
    return {
      user: {
        username: "Eiken",
        password: "pass"
      }
    };
  },
  methods: {
    newsite: function() {
      window.api.method("post", "/login", this.user).then(function(res){
        location.reload();
      });
    }
  },
  template: `
    <div class="grid-x">
      <div class="cell small-12">
        <div class="grid-x">
          <div class="cell shrink">
            Username:
          </div>
          <div class="cell auto">
            <input type="text" v-model="user.username">
          </div>
        </div>
      </div>
      <div class="cell small-12">
        <div class="grid-x">
          <div class="cell shrink">
            Password:
          </div>
          <div class="cell auto">
            <input type="password" v-model="user.password">
          </div> 
        </div>
      </div>
      <a @click="newsite"><(-_-)> Login, </a>
    </div>
  `
});

new window.Vue({
  el: "#root",
  template: `
    <div class="grid-x">
      <div class="columns medium-4">
        <log-in></log-in>
      </div>
      <div class="columns medium-8">
        <(-_-)> Login, you may.
      </div>
    </div>
  `
})
