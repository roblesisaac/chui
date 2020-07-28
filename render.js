const proper = require("./utils/proper");

const render = function(page, props) {
  const siteName = props.sheets.length === 0
                     ? "plysheet"
                     : props._siteName || "plysheet";
  const windowLocation = "https://"+props._event.headers.Host+"/dev/"+siteName;
  return `
  <html>
    <head>
      <title>${proper(props._siteName || page)}</title>
      <meta http-equiv="x-ua-compatible" content="ie=edge">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
      <meta charset="utf-8" />
      <link rel="icon" type="image/png" href="${windowLocation}/favicon">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/foundation/6.6.3/css/foundation-float.min.css" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/foundation/6.6.3/css/foundation.min.css">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/foundicons/3.0.0/foundation-icons.min.css" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">
      <link href="https://fonts.googleapis.com/css?family=Work+Sans:900|Lobster" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css?family=Coda:800|Maven+Pro:900" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css?family=Roboto+Mono" rel="stylesheet">
      <link rel="stylesheet" href="${windowLocation}/scripts/main.css">
      <style id="plyStyle"></style>
    </head>
    
    <body>
      <div id="root"></div>
    </body>
    
    <script type="text/javascript">
      const userSites = ${ JSON.stringify(props.userSites || []) };
      const user = ${ 
      JSON.stringify({
        username: props.user.username
      })
      };
      const sheets = ${ JSON.stringify(props.sheets) };
      const siteName = "${props._siteName}";
      let page = "ui-${page}";
    </script>
  
    <script src="https://code.jquery.com/jquery-3.2.1.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/babel-polyfill/6.23.0/polyfill.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/foundation/6.6.3/js/foundation.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/vue"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/ace/1.4.12/ace.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/ace/1.4.12/ext-language_tools.min.js"></script>
    ${
      props.scripts.map(function(script){
        if(script.includes(".js")) {
          return `
    <script src="${windowLocation}/scripts/${script}"></script>`;
        }
      }).join("")
    }
    <script src="https://js.braintreegateway.com/web/dropin/1.17.2/js/dropin.min.js"></script>
  </html>
  `;
};

module.exports = render;