var ALERT_THRESHOLD = 3;
var ALERT_CAP = ALERT_THRESHOLD + 10;
var TEST_THRESHOLD = 10;
var EMAIL_ADDRESS = 'your.email@example.com';
var PAGERDUTY_KEY = 'your_integration_key';

function MonitorAlert(message) {
    this.message = message;
    this.monitorInfo = this.getMonitorInfo(message.monitorName);
}

MonitorAlert.prototype.getMonitorInfo = function(monitorName) {
    var monitorInfo = neustar.store.get(monitorName);
    return monitorInfo ? monitorInfo : { failures: 0, incident: {}, pagerduty: {} };
};

MonitorAlert.prototype.updateMonitorInfoOnError = function() {
    var errorExists = 'error' in this.message;
    this.monitorInfo.failures = errorExists ? this.monitorInfo.failures + 1 : 0;

    if (errorExists) {
        this.monitorInfo.incident = { description: this.message.error.message };
    } else {
        this.monitorInfo.incident = {};
    }

    neustar.store.put(this.message.monitorName, this.monitorInfo);
    return errorExists;
};

MonitorAlert.prototype.sendEmailAlert = function(subject, body) {
    neustar.email.sendHtmlMessage({
        'to': [EMAIL_ADDRESS],
        'subject': subject,
        'body': body
    });
};

MonitorAlert.prototype.handleBackFromErrorActions = function(previousFailures, error) {
    if (previousFailures >= ALERT_THRESHOLD && !error) {
        neustar.incidentClient().update({
            id: this.monitorInfo.incident.id,
            policyId: this.message.policyId,
            description: 'Auto resolved',
            state: 'RESOLVED',
            event: { description: 'Auto resolved.' }
        });

        this.sendEmailAlert(
            'Site is back up (' + this.message.monitorName + ')',
            neustar.template('allClearMonitorEmail.mu').render(this.message)
        );

        neustar.store.put(this.message.monitorName, { incident: {}, pagerduty: {} });
    }
};

MonitorAlert.prototype.handleAlertsOnErrors = function(error) {
    if (error && this.monitorInfo.failures < ALERT_THRESHOLD) {
        neustar.scheduler.reschedule();
    }

    if (this.monitorInfo.failures >= ALERT_THRESHOLD && this.monitorInfo.failures <= ALERT_CAP) {
        var subject = 'Message from Vercara Alerting for ' + this.message.monitorName + ' (' + this.message.monitorLocation + ')';
        var template = neustar.template('defaultMonitorEmail.mu');
        template.addSubTemplate('monitorEmailScript.mu');
        var htmlMessage = template.render(this.message);

        this.sendEmailAlert(subject, htmlMessage);

        var incidentClient = neustar.incidentClient();
        var incidentDescription = this.message.monitorName + ':' + this.message.error.message;
        var response;

        if (this.monitorInfo.incident.description === incidentDescription) {
            response = incidentClient.update({
                id: this.monitorInfo.incident.id,
                policyId: this.message.policyId,
                description: incidentDescription,
                event: { description: 'The same monitoring error detected.' }
            });
        } else {
            response = incidentClient.create({
                policyId: this.message.policyId,
                description: incidentDescription
            });

            if (response.result === "OK") {
                this.monitorInfo.incident.description = incidentDescription;
                this.monitorInfo.incident.id = response.data.incident.id;
                neustar.store.put(this.message.monitorName, this.monitorInfo);
            }
        }

        this.handlePagerDutyAlerts();
    }
};

MonitorAlert.prototype.handlePagerDutyAlerts = function() {
    var alertMessage = this.message.monitorName + ':' + this.message.error.message;
    var incidentKey;

    if (this.monitorInfo.pagerduty.message === alertMessage) {
        incidentKey = this.monitorInfo.pagerDuty.incidentKey;
        neustar.pagerDuty.trigger(PAGERDUTY_KEY, alertMessage, incidentKey);
    } else {
        incidentKey = neustar.pagerDuty.trigger(PAGERDUTY_KEY, alertMessage);
        this.monitorInfo.pagerduty.message = alertMessage;
        this.monitorInfo.pagerduty.incidentKey = incidentKey;
        neustar.store.put(this.message.monitorName, this.monitorInfo);
    }
};

MonitorAlert.prototype.handleSLAManagement = function() {
    var slaThreshold = this.message.slaThreshold;
    var slaDuration = this.message.slaDuration;
    if (slaThreshold && slaDuration) {
        var result = neustar.monitor.checkSlaViolation(slaThreshold, slaDuration);
        if (result.slaViolation) {
            var subject = 'Message from Vercara Alerting : Load-time SLA Violation for ' + this.message.monitorName + ' (' + this.message.monitorLocation + ')';
            var template = neustar.template('defaultSlaMgmtEmail.mu');
            this.message.slaAvg = Math.round(result.slaAvg * 10) / 10;
            var htmlMessage = template.render(this.message);

            this.sendEmailAlert(subject, htmlMessage);
        }
    }
};

function main() {
    var message = neustar.alerts.getMessage();
    var alert = new MonitorAlert(message);
    
    var previousFailures = alert.monitorInfo.failures;
    var errorExists = alert.updateMonitorInfoOnError();

    alert.handleBackFromErrorActions(previousFailures, errorExists);
    alert.handleAlertsOnErrors(errorExists);
    alert.handleSLAManagement();
}

main();