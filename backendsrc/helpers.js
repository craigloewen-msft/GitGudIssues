module.exports = {
    PromiseTimeout(delayms) {
        return new Promise(function (resolve, reject) {
            setTimeout(resolve, delayms);
        });
    },
    GetMentions(inputString) {
        let mentionsPattern = /\B@[a-z0-9_-]+/gi;
        if (inputString == null) {
            return null;
        }
        let mentionsArray = inputString.match(mentionsPattern);
        if (mentionsArray != null) {
            mentionsArray = mentionsArray.map(el => el.slice(1));
        }
        return mentionsArray;
    }
}
