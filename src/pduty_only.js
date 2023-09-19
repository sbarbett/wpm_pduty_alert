function MonitoringService() {
    this.message = neustar.alerts.getMessage();
    this.monitorInfo = this.getMonitorInfo();
}

MonitoringService.prototype.getMonitorInfo = function() {
    var info = neustar.store.get(this.message.monitorName);
    if (!info) {
        info = {
            failures: 0,
            incident: {},
            pagerduty: {}
        };
    }
    return info;
};

MonitoringService.prototype.updateMonitorInfoAfterFailure = function() {
    this.monitorInfo.failures++;
    this.monitorInfo.incident = {};
    neustar.store.put(this.message.monitorName, this.monitorInfo);
};

MonitoringService.prototype.handleFailure = function() {
    if ("error" in this.message) {
        this.updateMonitorInfoAfterFailure();
        if (this.monitorInfo.failures >= 3) {
            this.triggerPagerDuty();
        }
    }
};

MonitoringService.prototype.triggerPagerDuty = function() {
    var alertMessage = this.message.monitorName + ': ' + this.message.error.message;
    var serviceKey = 'your_integration_key';
    var incidentKey;

    if (this.monitorInfo.pagerduty.message === alertMessage) {
        incidentKey = this.monitorInfo.pagerDuty.incidentKey;
        neustar.pagerDuty.trigger(serviceKey, alertMessage, incidentKey);
    } else {
        incidentKey = neustar.pagerDuty.trigger(serviceKey, alertMessage);
        this.monitorInfo.pagerduty.message = alertMessage;
        this.monitorInfo.pagerduty.incidentKey = incidentKey;
        neustar.store.put(this.message.monitorName, this.monitorInfo);
    }
};

var monitor = new MonitoringService();
monitor.handleFailure();