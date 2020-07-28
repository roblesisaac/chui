Vue.component("ui-login", {
  template: `
    <div class="grid-x">
      <div class="cell medium-4">
        <ui-login-portal method="login"></ui-login-portal>
      </div>
      <div class="cell medium-4">
        <b>Welcome, you are.</b>
      </div>
      <div class="cell medium-4">
        <ui-login-portal method="signup"></ui-login-portal>
      </div>
    </div>
  `
});