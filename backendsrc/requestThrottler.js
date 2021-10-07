const helperFunctions = require('./helpers');

class RequestThrottler {
    constructor(inRequestsPerTimePeriod, inTimePeriod) {
        this.requestPerTimePeriod = inRequestsPerTimePeriod;
        this.timePeriod = inTimePeriod;

        this.currentRequestsAmount = this.requestPerTimePeriod;
    }

    async requestToPost() {
        while (true) {
            if (this.currentRequestsAmount > 0) {
                this.currentRequestsAmount = this.currentRequestsAmount - 1;
                if (this.currentRequestsAmount == this.requestPerTimePeriod - 1) {
                    // Make a function to reset it back to 10 on a timeout
                    this.resetValueAfterDelay();
                }
                return true;
            } else {
                // Wait 1 minute and try again
                await helperFunctions.PromiseTimeout(this.timePeriod);
            }
        }
    }

    async resetValueAfterDelay() {
        await helperFunctions.PromiseTimeout(this.timePeriod);
        this.currentRequestsAmount = this.requestPerTimePeriod;
        return true;
    }
}

module.exports = RequestThrottler;