"use strict";

const events = require('events'),
    set = require('./lib/set'),
    logger = require('./lib/logger');

var Collector = function(config) {
    this.config = config;
    this.logger = new logger.Logger(config.log || {});

    this.backendEvents = new events.EventEmitter();
    this.old_timestamp = 0;
    this.startup_time = Math.round(new Date().getTime() / 1000);

    this.keyCounter = {};
    this.gauges = {};
    this.counters = {};
    this.counter_rates = {};
    this.timers = {};
    this.timer_counters = {};
    this.timer_data = {};
    this.sets = {};

    this.pctThreshold = config.percentThreshold || 90;
    if (!Array.isArray(this.pctThreshold)) {
        this.pctThreshold = [ this.pctThreshold ]; // listify percentiles so single values work the same
    }

    if (config.backends) {
        for (var j = 0; j < config.backends.length; j++) {
            this.loadBackend(config, config.backends[j]);
        }
    } else {
      // The default backend is graphite
      this.loadBackend(config, './backends/graphite');
    }

    // setup config for stats prefix
    var prefixStats = config.prefixStats;
    prefixStats = prefixStats !== undefined ? prefixStats : "statsd";
    //setup the names for the stats stored in counters{}
    this.packets_received = prefixStats + ".packets_received";
    this.metrics_received = prefixStats + ".metrics_received";
    this.timestamp_lag_namespace = prefixStats + ".timestamp_lag";

    //now set to zero so we can increment them
    this.counters[this.bad_lines_seen]   = 0;
    this.counters[this.packets_received] = 0;
    this.counters[this.metrics_received] = 0;

    this.flushInterval = Number(config.flushInterval || 10000);
    config.flushInterval = this.flushInterval;

    this.keyFlushInterval = Number((config.keyFlush && config.keyFlush.interval) || 0);
    this.flushInt = setTimeout(this.flushMetrics.bind(this), this.getFlushTimeout(this.flushInterval));

    if (this.keyFlushInterval > 0) {
        var keyFlushPercent = Number((config.keyFlush && config.keyFlush.percent) || 100);
        var keyFlushLog = config.keyFlush && config.keyFlush.log;

        this.keyFlushInt = setInterval(function () {
            var sortedKeys = [];
            for (var key in self.keyCounter) {
                sortedKeys.push([key, self.keyCounter[key]]);
            }
            sortedKeys.sort(function(a, b) { return b[1] - a[1]; });

            var logMessage = "";
            var timeString = (new Date()) + "";

            // only show the top "keyFlushPercent" keys
            for (var i = 0, e = sortedKeys.length * (keyFlushPercent / 100); i < e; i++) {
                logMessage += timeString + " count=" + sortedKeys[i][1] + " key=" + sortedKeys[i][0] + "\n";
            }

            if (keyFlushLog) {
                var logFile = fs.createWriteStream(keyFlushLog, {flags: 'a+'});
                logFile.write(logMessage);
                logFile.end();
            } else {
                process.stdout.write(logMessage);
            }

            // clear the counter
            self.keyCounter = {};
        }, this.keyFlushInterval);
    }

    this.stats = {
        messages: {
            last_msg_seen: Math.round(new Date().getTime() / 1000), // startup_time
        }
    };
};

/*
    {
        "stat": "",
        "value": "",
        "type": "",
        "sampleRate": "",
        "tags": ""
    }
*/
Collector.prototype.handleMessage = function (msg, rinfo /* rinfo??? */) {
    var self = this;
    self.counters[self.packets_received]++;
    self.counters[self.metrics_received]++;

    if (self.config.dumpMessages) {
        console.log(JSON.stringify(msg));
    }

    var key = sanitizeKeyName(msg.stat);

    if (self.keyFlushInterval > 0) {
        if (! self.keyCounter[key]) {
            self.keyCounter[key] = 0;
        }
        self.keyCounter[key] += 1;
    }

    if (msg.type === "ms") {
        if (! self.timers[key]) {
            self.timers[key] = [];
            self.timer_counters[key] = 0;
        }
        timers[key].push(Number(msg.value || 0));
        timer_counters[key] += (1 / msg.sampleRate);

    } else if (msg.type === "g") {
        if (self.gauges[key] && msg.value.match(/^[-+]/)) {
            self.gauges[key] += Number(msg.value || 0);
        } else {
            self.gauges[key] = Number(msg.value || 0);
        }
    } else if (msg.type === "s") {
        if (! self.sets[key]) {
            self.sets[key] = new set.Set();
        }
        self.sets[key].insert(msg.value || '0');
    } else {
        if (! self.counters[key]) {
            self.counters[key] = 0;
        }
        self.counters[key] += Number(msg.value || 1) * (1 / msg.sampleRate);
    }

    stats.messages.last_msg_seen = Math.round(new Date().getTime() / 1000);
};

// Load and init the backend from the backends/ directory.
Collector.prototype.loadBackend = function(config, name) {
    var self = this;
    var backendmod = require(name);

    if (config.debug) {
        console.log("Loading backend: " + name, 'DEBUG');
    }

    var ret = backendmod.init(self.startup_time, config, self.backendEvents, self.logger);
    if (!ret) {
        console.log("Failed to load backend: " + name, "ERROR");
        process.exit(1);
    }
};

Collector.prototype.getFlushTimeout = function(interval) {
    var self = this;
    console.log('interval:' + interval +', flushInterval:' + self.flushInterval + ', startup_time:' + self.startup_time);
    return interval - (new Date().getTime() - self.startup_time * 1000) % self.flushInterval;
};


function sanitizeKeyName(key) {
    if (keyNameSanitize) {
        return key.replace(/\s+/g, '_')
                    .replace(/\//g, '-')
                    .replace(/[^a-zA-Z_\-0-9\.]/g, '');
    } else {
        return key;
    }
}


// Flush metrics to each backend.
Collector.prototype.flushMetrics = function() {
    console.log('----- enter flushMetrics');
    var self = this;
    var time_stamp = Math.round(new Date().getTime() / 1000);
    if (self.old_timestamp > 0) {
        self.gauges[self.timestamp_lag_namespace] = (time_stamp - self.old_timestamp - (Number(self.config.flushInterval)/1000));
    }
    self.old_timestamp = time_stamp;

    var metrics_hash = {
        counters: self.counters,
        gauges: self.gauges,
        timers: self.timers,
        timer_counters: self.timer_counters,
        sets: self.sets,
        counter_rates: self.counter_rates,
        timer_data: self.timer_data,
        pctThreshold: self.pctThreshold,
        histogram: self.config.histogram
    };

    // After all listeners, reset the stats
    self.backendEvents.once('flush', function clear_metrics(ts, metrics) {
        // TODO: a lot of this should be moved up into an init/constructor so we don't have to do it every
        // single flushInterval....
        // allows us to flag all of these on with a single config but still override them individually
        self.config.deleteIdleStats = self.config.deleteIdleStats !== undefined ? self.config.deleteIdleStats : false;
        if (self.config.deleteIdleStats) {
            self.config.deleteCounters = self.config.deleteCounters !== undefined ? self.config.deleteCounters : true;
            self.config.deleteTimers = self.config.deleteTimers !== undefined ? self.config.deleteTimers : true;
            self.config.deleteSets = self.config.deleteSets !== undefined ? self.config.deleteSets : true;
            self.config.deleteGauges = self.config.deleteGauges !== undefined ? self.config.deleteGauges : true;
        }

        // Clear the counters
        self.config.deleteCounters = self.config.deleteCounters || false;
        for (var counter_key in metrics.counters) {
            if (self.config.deleteCounters) {
                if ((counter_key.indexOf("packets_received") != -1) ||
                    (counter_key.indexOf("metrics_received") != -1) ||
                    (counter_key.indexOf("bad_lines_seen") != -1)) {
                    metrics.counters[counter_key] = 0;
                } else {
                    delete(metrics.counters[counter_key]);
                }
            } else {
                metrics.counters[counter_key] = 0;
            }
        }

        // Clear the timers
        self.config.deleteTimers = self.config.deleteTimers || false;
        for (var timer_key in metrics.timers) {
            if (self.config.deleteTimers) {
                delete(metrics.timers[timer_key]);
                delete(metrics.timer_counters[timer_key]);
            } else {
                metrics.timers[timer_key] = [];
                metrics.timer_counters[timer_key] = 0;
            }
        }

        // Clear the sets
        self.config.deleteSets = self.config.deleteSets || false;
        for (var set_key in metrics.sets) {
            if (self.config.deleteSets) {
                delete(metrics.sets[set_key]);
            } else {
                metrics.sets[set_key] = new set.Set();
            }
        }

        // Normally gauges are not reset.  so if we don't delete them, continue to persist previous value
        self.config.deleteGauges = self.config.deleteGauges || false;
        if (self.config.deleteGauges) {
            for (var gauge_key in metrics.gauges) {
                delete(metrics.gauges[gauge_key]);
            }
        }
    });

    self.backendEvents.emit('flush', time_stamp, metrics_hash);

    // Performing this setTimeout at the end of this method rather than the beginning
    // helps ensure we adapt to negative clock skew by letting the method's latency
    // introduce a short delay that should more than compensate.
    setTimeout(self.flushMetrics.bind(self), self.getFlushTimeout(self.flushInterval));
}

module.exports = Collector;
