// const blocks = {};
// const block = function(props) {
//   var blockName = "ui-"+Date.now()+Object.keys(blocks).length,
//       block = Vue.component(blockName, {
//         data: function() {
//           return props.data || {};
//         },
//         template: `
//           <div class="cell ${props.class} small-${props.width.small || 12}  medium-${props.width}">
//           ${props.html}
//           </div>
//         `
//       });
//   blocks[blockName] = block;
//   return `<${blockName} />`;
// };

Vue.component("ui-new-site", {
  data: function() {
    return {
      newSite: {
        name: "newSiteTest",
        htmlButton: "htmlButtonTest"
      }
    };
  },
  methods: {
    newsite: function() {
      api.method("post", "/db/sites", this.newSite).then(function(res){
        console.log(res.last);
      });
    }
  },
  template: `
    <div class="grid-x">
      <div class="cell small-12">
        <div class="grid-x">
          <div class="cell shrink">
            Site Name:
          </div>
          <div class="cell auto">
            <input type="text" v-model="newSite.name">
          </div>
        </div>
      </div>
      <div class="cell small-12">
        <div class="grid-x">
          <div class="cell shrink">
            Html Button:
          </div>
          <div class="cell auto">
            <input type="text" v-model="newSite.htmlButton">
          </div> 
        </div>
      </div>
      <a @click="newsite">Add New Site</a>
    </div>
  `
}); // ui-new-site

Vue.component("ui-notify", {
  created: function() {
    setTimeout(function(){
      site.notify = null;
    }, 2000);
  },
  data: function() {
    return {
      message: site.notify
    };
  },
  template: `
    <div id="notify" class="grid-x padding bgBlue colorBleach text-center">
      <div class="cell small-12">
        {{ message }}
      </div>
    </div>
  `
}); // ui-notify

Vue.component("ui-panel", {
  template: `
    <div class="grid-x">
      <div class="cell small-12">
        Panel
      </div>
    </div>
  `
}); // ui-panel

Vue.component("ui-site-obj", {
  props: ["site", "i"],
  template: `
  <div class="column column-block text-center">
    <h3>{{ site.name }}</h3>
    <a :href="'https://{{ domain }}/dev/' + site.name"><b><(-_-)> Enter</b></a>
    <ui-obj :obj="site" url="db/sites" />
  </div>
  `
}); // ui-site-obj

Vue.component("ui-login-portal", {
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
      api.method("post", "/"+this.method, this.user).then(function(res){
        if(res.last.user) location.reload();
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