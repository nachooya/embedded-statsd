var Collector = require('./collector');

/**
 * The UDP Client for StatsD
 * @param options
 *   @option prefix      {String}  An optional prefix to assign to each stat name sent
 *   @option suffix      {String}  An optional suffix to assign to each stat name sent
 *   @option mock        {boolean} An optional boolean indicating this Client is a mock object, no stats are sent.
 *   @option global_tags {Array=} Optional tags that will be added to every metric
 * @constructor
 */
var Client = function (prefix, suffix, mock, global_tags, statsd_config) {
  var options = {},
         self = this;

  if(arguments.length > 1 || typeof(host) === 'string'){
    options = {
      prefix      : prefix,
      suffix      : suffix,
      mock        : mock === true,
      global_tags : global_tags
    };
  }

  this.prefix      = options.prefix || '';
  this.suffix      = options.suffix || '';
  this.mock        = options.mock;
  this.global_tags = options.global_tags || [];

  this.collector   = new Collector(statsd_config);
};

/**
 * Represents the timing stat
 * @param stat {String|Array} The stat(s) to send
 * @param time {Number} The time in milliseconds to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
Client.prototype.timing = function (stat, time, sampleRate, tags, callback) {
  this.sendAll(stat, time, 'ms', sampleRate, tags, callback);
};

/**
 * Increments a stat by a specified amount
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
Client.prototype.increment = function (stat, value, sampleRate, tags, callback) {
  this.sendAll(stat, value || 1, 'c', sampleRate, tags, callback);
};

/**
 * Decrements a stat by a specified amount
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
Client.prototype.decrement = function (stat, value, sampleRate, tags, callback) {
  this.sendAll(stat, -value || -1, 'c', sampleRate, tags, callback);
};

/**
 * Represents the histogram stat
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
Client.prototype.histogram = function (stat, value, sampleRate, tags, callback) {
  this.sendAll(stat, value, 'h', sampleRate, tags, callback);
};


/**
 * Gauges a stat by a specified amount
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
Client.prototype.gauge = function (stat, value, sampleRate, tags, callback) {
  this.sendAll(stat, value, 'g', sampleRate, tags, callback);
};

/**
 * Counts unique values by a specified amount
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
Client.prototype.unique =
Client.prototype.set = function (stat, value, sampleRate, tags, callback) {
  this.sendAll(stat, value, 's', sampleRate, tags, callback);
};

/**
 * Checks if stats is an array and sends all stats calling back once all have sent
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
Client.prototype.sendAll = function(stat, value, type, sampleRate, tags, callback){
  var completed = 0,
      calledback = false,
      sentBytes = 0,
      self = this;

  if(sampleRate && typeof sampleRate !== 'number'){
    callback = tags;
    tags = sampleRate;
    sampleRate = undefined;
  }

  if(tags && !Array.isArray(tags)){
    callback = tags;
    tags = undefined;
  }

  /**
   * Gets called once for each callback, when all callbacks return we will
   * call back from the function
   * @private
   */
  function onSend(error, bytes){
    completed += 1;
    if(calledback || typeof callback !== 'function'){
      return;
    }

    if(error){
      calledback = true;
      return callback(error);
    }

    sentBytes += bytes;
    if(completed === stat.length){
      callback(null, sentBytes);
    }
  }

  if(Array.isArray(stat)){
    stat.forEach(function(item){
      self.send(item, value, type, sampleRate, tags, onSend);
    });
  } else {
    this.send(stat, value, type, sampleRate, tags, callback);
  }
};

/**
 * Sends a stat across the wire
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param type {String} The type of message to send to statsd
 * @param sampleRate {Number} The Number of times to sample (0 to 1)
 * @param tags {Array} The Array of tags to add to metrics
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
Client.prototype.send = function (stat, value, type, sampleRate, tags, callback) {
  // Only send this stat if we're not a mock Client.
  if(!this.mock) {
    this.collector.handleMessage({
        stat: this.prefix + stat + this.suffix,
        value: value,
        type: type,
        sampleRate: sampleRate,
        tags: tags
    });
  }
  if(typeof callback === 'function'){
    callback(null, 0);
  }
};

exports = module.exports = Client;
exports.StatsD = Client;
