module.exports = function(sheetName, siteId, userId) {
  return {
    "name": sheetName,
    "htmlButton": "<a>"+sheetName+"</a>",
    "onStart": "db",
    "sort": 0,
    "siteId": siteId,
    "author": userId,
    "db": {
      "schema": {
        "name": "string",
        "htmlButton": "string",
        "onStart": "string",
        "sort": "number",
        "siteId": "string",
        "author": "string",
        "db": {
          "schema": {
              "test": "string"
          }
        },
        "ui": {
          "js": "string",
          "css": "string",
          "html": "string",
          "blocks":  [
            [ {  width: "number", rows: "array" } ]  
          ]
        }
      }
    },
    "ui": {
      "js": "console.log(false)",
      "css": "",
      "html": "<div>hello world</div>",
      "blocks":  [
        [ {  width: "12", rows: [] } ]  
      ]
    }
  }; 
};