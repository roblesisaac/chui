module.exports = function(str) {
    str = str.toLowerCase();
    let spl = str.split("");
    spl[0] = spl[0].toUpperCase();
    return spl.join("");
};