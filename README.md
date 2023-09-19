wpm\_pduty\_alert
======================

This repository contains advance alerting scripts for Vercara's UltraWPM service that use the [PagerDuty interface](http://docs.ultrawpm.com/alertpolicy-api/d0/d6e/interfacebiz_1_1neustar_1_1webmetrics_1_1alerting_1_1script_1_1api_1_1_pager_duty.html) from the [Alerting API](http://docs.ultrawpm.com/alertpolicy-api/annotated.html) to trigger a PagerDuty event.

## Notes

1. UltraWPM's PagerDuty interface doesn't support the V2 version of PagerDuty's Events API, you have to use V1.
2. The implementation of JavaScript used by the scripting interface predates EMCAScript 6, hence the usage of prototypes.
3. In `pduty_with_email.js`, the script will send an email from WPM in addition to triggering the PagerDuty event (this seems a bit redundant since PagerDuty will typically send an email)
4. The `ppduty_only.js` script is stripped down to only trigger PagerDuty

## License

This project is licensed under the terms of the MIT license. See LICENSE.md for more details.
