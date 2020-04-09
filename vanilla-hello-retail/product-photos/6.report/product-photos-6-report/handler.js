'use strict';

const AJV = require('ajv');


const { KV_Store } = require('kv-store');
const fs = require('fs');

// const conf = JSON.parse(fs.readFileSync('conf.json', 'utf8'));

/**
 * Constants
 */
const constants = {
  // self
  MODULE: 'product-photos/6.report/report.js',
  METHOD_: '',
  METHOD_WRITE_TO_STREAM: 'writeToStream',
  METHOD_SUCCEED_ASSIGNMENT: 'succeedAssignment',
  METHOD_DELETE_ASSIGNMENT: 'deleteAssignment',
  // external
  HOST: process.env.HOST,
  USER: process.env.USER,
  PASS: process.env.PASS,
  DBNAME: process.env.DBNAME,
  RETAIL_STREAM_NAME: process.env.RETAIL_STREAM_NAME,
  RETAIL_STREAM_WRITER_ARN: process.env.RETAIL_STREAM_WRITER_ARN,
  TABLE_PHOTO_REGISTRATIONS_NAME: process.env.TABLE_PHOTO_REGISTRATIONS_NAME,
  TABLE_PHOTO_ASSIGNMENTS_NAME: process.env.TABLE_PHOTO_ASSIGNMENTS_NAME,
};

/**
 * AJV
 */
// TODO Get these from a better place later
const eventSchema = require('./schemas/retail-stream-schema-ingress.json');
const productImageSchema = require('./schemas/product-image-schema.json');

// TODO generalize this?  it is used by but not specific to this module
const makeSchemaId = schema => `${schema.self.vendor}/${schema.self.name}/${schema.self.version}`;

const eventSchemaId = makeSchemaId(eventSchema);
const productImageSchemaId = makeSchemaId(productImageSchema);

const ajv = new AJV();
ajv.addSchema(eventSchema, eventSchemaId);
ajv.addSchema(productImageSchema, productImageSchemaId);

// /**
//  * AWS
//  */
// const kinesis = new aws.Kinesis();

/**
 * Implementation
 */
const impl = {
  writeToStream: (lambdaEvent, callback) => {
    const origin = lambdaEvent.body;
    const productId = lambdaEvent.data.id.toString();
    const imageEvent = {
      schema: eventSchemaId,
      origin,
      timeOrigin: new Date().toISOString(),
      data: {
        schema: productImageSchemaId,
        id: productId,
        image: lambdaEvent.image,
      },
    };
    if (!ajv.validate(eventSchemaId, imageEvent)) {
      callback(`failure to validate to '${eventSchemaId}' with event:\n${imageEvent}`)
    } else if (!ajv.validate(productImageSchemaId, imageEvent.data)) {
      callback(`failure to validate to '${productImageSchemaId}' with event data:\n${imageEvent.data}`)
    } else {
      const params = {
        Data: JSON.stringify(imageEvent),
        PartitionKey: productId,
        StreamName: constants.RETAIL_STREAM_NAME,
      };
      kinesis.putRecord(params, callback)
    }
  },
  succeedAssignment: (event, callback) => {
    const updated = Date.now();
   
    const kv = new KV_Store(constants.HOST, constants.USER, 
        constants.PASS, constants.DBNAME, constants.TABLE_PHOTO_REGISTRATIONS_NAME);
    kv.init()
      .then(() => kv.get(event.body.photographer.id))
      .then((res) => {
        console.log(JSON.parse(res))
        console.log(`%% res.assignment: ${res.assignment}`);
        console.log(`%% event.body.data.id: ${event.body.data.id.toString()}`);
        console.log(`%% res.assignment === event.data.id: ${res.assignment === event.body.data.id.toString()}`);
        res = JSON.parse(res) 
        if (res.assignment === event.body.data.id.toString()) {
          res.assignments++;
          res.updated = updated;
          res.updatedBy = event.origin;
          delete res.assignments;
          return res;
        } else {
          return kv.close().then(() => Promise.reject('Unexpected assignment for photographer.'));
        }
      })
      .then(res => kv.put(
        event.body.photographer.id,
        JSON.stringify(res)))
      .then(() => kv.close())
      .then(() => callback(null))
      .catch(err => callback(err))
  },
  deleteAssignment: (event, callback) => {
    const kv = new KV_Store(constants.HOST, constants.USER, 
        constants.PASS, constants.DBNAME, constants.TABLE_PHOTO_ASSIGNMENTS_NAME);
    kv.init()
      .then(() => kv.del(event.body.photographer.id))
      .then(() => kv.close())
      .then(() => callback())
      .catch(err => callback(err))
  },
};


  /**
   * Handle the report stage of the Acquire Photo Step Function
   *    1. Report the photo to the stream
   *    2. Delete the pending assignment
   * Example Event:
   * {
   *   schema: 'com.nordstrom/retail-stream/1-0-0',
   *   origin: 'hello-retail/product-producer-automation',
   *   timeOrigin: '2017-01-12T18:29:25.171Z',
   *   data: {
   *     schema: 'com.nordstrom/product/create/1-0-0',
   *     id: 4579874,
   *     brand: 'POLO RALPH LAUREN',
   *     name: 'Polo Ralph Lauren 3-Pack Socks',
   *     description: 'PAGE:/s/polo-ralph-lauren-3-pack-socks/4579874',
   *     category: 'Socks for Men',
   *   },
   *   photographers: ['Erik'],
   *   photographer: {
   *     name: 'Erik',
   *     phone: '+<num>',
   *   },
   *   image: 'erik.hello-retail.biz/i/p/4579874'
   * }
   */
  module.exports = (event, context, callback) => {
    console.log(JSON.stringify(event));

        impl.succeedAssignment(event, (sErr) => {
          if (sErr && !(sErr.code && sErr.code === 'ConditionalCheckFailedException')) { // if we fail due to the conditional check, we should proceed regardless to remain idempotent
            callback(`${constants.MODULE} ${constants.METHOD_SUCCEED_ASSIGNMENT} - ${sErr.stack}`)
          } else {
            impl.deleteAssignment(event, (dErr) => {
              if (dErr) {
                callback(`${constants.MODULE} ${constants.METHOD_DELETE_ASSIGNMENT} - ${dErr.stack}`)
              } else {
                const result = event;
                result.body.outcome = 'photo taken';
                callback(null, result.body)
              }
            })
          }
        })
      };
   
