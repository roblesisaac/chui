module.exports = function(sheetId, siteId, username) {
  return {
    "db": {
      "methods": ["get", "put", "post", "delete"]
    },
    "ui": {
      "apps": ["all"]
    },
    "permit": {
      "methods": ["get", "put", "post", "delete"]
    },
    "username": username,
    "siteId": siteId,
    "sheetId": sheetId
  }; 
};