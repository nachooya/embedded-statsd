embedded-statsd
===============

Here we have [statsd](https://github.com/etsy/statsd) and [node-statsd](https://github.com/sivy/node-statsd) are combined together.

What's the benefit?
-------------------

Why anyone would ever do that?
* You don't need any separate statsd server running somewhere.
* You don't need to send whole a lot of UDP packets to statsd server.
* Stats are aggregated within so the network traffic would be greately reduced even further.


Install
-------

    $ npm install embedded-statsd


How to use?
-----------

Basically everything's the same as existing [node-statsd](https://github.com/sivy/node-statsd), except that you don't need to specify host name and port number of the [statsd](https://github.com/etsy/statsd) server.

    var StatsD = require('embedded-statsd'),
        client = new StatsD();

    // Timing: sends a timing command with the specified milliseconds
    client.timing('response_time', 42);

    // Increment: Increments a stat by a value (default is 1)
    client.increment('my_counter');

    // Decrement: Decrements a stat by a value (default is -1)
    client.decrement('my_counter');

    // Histogram: send data for histogram stat
    client.histogram('my_histogram', 42);

    // Gauge: Gauge a stat by a specified amount
    client.gauge('my_gauge', 123.45);

    // Set: Counts unique occurrences of a stat (alias of unique)
    client.set('my_unique', 'foobar');
    client.unique('my_unique', 'foobarbaz');

    // Incrementing multiple items
    client.increment(['these', 'are', 'different', 'stats']);

    // Sampling, this will sample 25% of the time the StatsD Daemon will compensate for sampling
    client.increment('my_counter', 1, 0.25);

    // Tags, this will add user-defined tags to the data
    client.histogram('my_histogram', 42, ['foo', 'bar']);

    // Using the callback
    client.set(['foo', 'bar'], 42, function(error, bytes){
      //this only gets called once after all messages have been sent
      if(error){
        console.error('Oh noes! There was an error:', error);
      } else {
        console.log('Successfully sent', bytes, 'bytes');
      }
    });

    // Sampling, tags and callback are optional and could be used in any combination
    client.histogram('my_histogram', 42, 0.25); // 25% Sample Rate
    client.histogram('my_histogram', 42, ['tag']); // User-defined tag
    client.histogram('my_histogram', 42, next); // Callback
    client.histogram('my_histogram', 42, 0.25, ['tag']);
    client.histogram('my_histogram', 42, 0.25, next);
    client.histogram('my_histogram', 42, ['tag'], next);
    client.histogram('my_histogram', 42, 0.25, ['tag'], next);


License
-------
embedded-statsd is licensed under the MIT license.


Contact
-------

[@appler](http://twitter.com/appler)
