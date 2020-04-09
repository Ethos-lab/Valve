'use strict';

const { KV_Store } = require('kv-store');
const fs = require('fs');

const constants = {
  TABLE_AUTHENTICATION_NAME: process.env.TABLE_AUTHENTICATION_NAME,
  HOST: process.env.HOST,
  USER: process.env.USER,
  PASS: process.env.PASS,
  DBNAME: process.env.DBNAME
};


module.exports = (event, context, callback) => {
  console.log(event);
  const kv = new KV_Store(constants.HOST, constants.USER, 
    constants.PASS, constants.DBNAME, constants.TABLE_AUTHENTICATION_NAME);
  const result = event.body;

  kv.init()
    .then(() => kv.get(event.body.user))
    .then(res => kv.close().then(() => res))
    .then((res) => {
      console.log(event.body.pass);
      console.log(res === event.body.pass);
      console.log(res === event.body.pass);
      if (res === event.body.pass) {
        // eslint-disable-next-line no-param-reassign
        result.authenticated = 'true';
      } else {
        result.authenticated = 'false';
        result.failureReason = 'Could not authenticate user';
      }
      callback(null, result)
    })
    .catch(err => callback(err))
};
