const { initTracer: initJaegerTracer } = require('jaeger-client');

const initTracer = (serviceName) => {
  const config = {
    serviceName,
    sampler: {
      type: 'const',
      param: 1
    },
    reporter: {
      logSpans: true,
      agentHost: process.env.JAEGER_AGENT_HOST || 'jaeger',
      agentPort: 6831
    }
  };

  const options = {
    logger: {
      info: (msg) => console.log('JAEGER INFO:', msg),
      error: (msg) => console.error('JAEGER ERROR:', msg)
    }
  };

  return initJaegerTracer(config, options);
};

module.exports = { initTracer };
