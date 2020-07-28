window.Vue.component("user-portal", {
  data: function() {
    return {
      user: {
        username: "Eiken",
        password: "pass"
      }
    };
  },
  methods: {
    userAction: function() {
      window.api.method("post", "/"+this.method, this.user).then(function(res){
        window.location.reload();
      });
    }
  },
  props: ["method"],
  template: `
    <div class="grid-x">
      <div class="cell small-12 text-center">
      <h3><(-_-)> {{ method }}, you may.</h3>
      </div>
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
      <a @click="userAction"><b><(-_-)> {{ method }}</b></a>
    </div>
  `
});

new window.Vue({
  el: "#root",
  template: `
    <div class="grid-x">
      <div class="columns medium-4">
        <user-portal method="login"></user-portal>
      </div>
      <div class="columns medium-4">
        <b>Welcome, you are.</b>
      </div>
      <div class="columns medium-4">
        <user-portal method="signup"></user-portal>
      </div>
    </div>
  `
});
