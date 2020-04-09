'use strict';

const { KV_Store } = require('kv-store');
const fs = require('fs');


const constants = { 
  TABLE_PRODUCT_PRICE_NAME: process.env.TABLE_PRODUCT_PRICE_NAME,
  HOST: process.env.HOST,
  USER: process.env.USER,
  PASS: process.env.PASS,
  DBNAME: process.env.DBNAME
};


module.exports = (event, context, callback) => {
  const kv = new KV_Store(constants.HOST, constants.USER, 
    constants.PASS, constants.DBNAME, constants.TABLE_PRODUCT_PRICE_NAME);

  const result = event.body;

  kv.init()
    .then(() => kv.keys())
    .then(res => console.log(res))
    .then(() => kv.get(event.body.id))
    .then(res => kv.close().then(() => res))
    .then((res) => {
        console.log('res' + res);
      if (res) {
        // const price = JSON.parse(res).price;
        console.log('res ' + res);
        if (res) {
          result.gotPrice = 'true';
          result.price = res;
        } else {
          result.gotPrice = 'false';
          result.failureReason = 'No price in the catalog';
        }
      } else {
        result.gotPrice = 'false';
        result.failureReason = 'Product not in catalog';
      }
      callback(null, result)
    })
    .catch(err => callback(err))
};
