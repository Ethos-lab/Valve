'use strict';

/* ********************************************************************
 *                 Hello Retail Minimization:
 *  - Removed all Twilio code, in charge of authentication, request
 *    validation, and ack responses (error, success messages sent
 *    to photographer).
 *  - Changed returned values to a simple string instead of HTTP
 *    response.
 * ******************************************************************** */

const AJV = require('ajv');
const BbPromise = require('bluebird');
const got = require('got');
const url = require('url');

const { KV_Store } = require('kv-store');
const fs = require('fs');

const receiveRequestSchema = require('./schemas/receive-request-schema.json');
const photoAssignmentSchema = require('./schemas/photo-assignment-schema.json');

// TODO generalize this?  it is used by but not specific to this module
const makeSchemaId = schema => `${schema.self.vendor}/${schema.self.name}/${schema.self.version}`;

const receiveRequestSchemaId = makeSchemaId(receiveRequestSchema);
const photoAssignmentSchemaId = makeSchemaId(photoAssignmentSchema);


const ajv = new AJV();
ajv.addSchema(receiveRequestSchema, receiveRequestSchemaId);
ajv.addSchema(photoAssignmentSchema, photoAssignmentSchemaId);


/**
 * Constants
 */
const constants = {
  // Errors
  ERROR_CLIENT: 'ClientError',
  ERROR_UNAUTHORIZED: 'Unauthorized',
  ERROR_USER: 'UserError',
  ERROR_SERVER: 'ServerError',
  ERROR_DATA_CORRUPTION: 'DATA CORRUPTION',
  ERROR_SECURITY_RISK: '!!!SECURITY RISK!!!',
  HASHES: '##########################################################################################',

  // Locations
  MODULE: 'receive.js',
  METHOD_HANDLER: 'handler',
  METHOD_GET_IMAGE_FROM_EVENT: 'impl.getImageFromEvent',
  METHOD_PLACE_IMAGE_IN_S3: 'impl.storeImage',
  METHOD_SEND_STEP_SUCCESS: 'impl.sendStepSuccess',

  // External
  ENDPOINT: process.env.ENDPOINT,
  TABLE_STORED_PHOTOS_NAME: process.env.TABLE_STORED_PHOTOS_NAME,
  // IMAGE_BUCKET: process.env.IMAGE_BUCKET,
  TABLE_PHOTO_ASSIGNMENTS_NAME: process.env.TABLE_PHOTO_ASSIGNMENTS_NAME,
  HOST: process.env.HOST,
  USER: process.env.USER,
  PASS: process.env.PASS,
  DBNAME: process.env.DBNAME
};

/**
 * Errors
 */
class ClientError extends Error {
  constructor(message) {
    super(message);
    this.name = constants.ERROR_CLIENT
  }
}
class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = constants.ERROR_UNAUTHORIZED
  }
}
class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = constants.ERROR_USER
  }
}
class ServerError extends Error {
  constructor(message) {
    super(message);
    this.name = constants.ERROR_SERVER
  }
}

/**
 * Utility Methods (Internal)
 */
const util = {
  response: (statusCode, body) => ({
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*', // Required for CORS support to work
      'Access-Control-Allow-Credentials': true, // Required for cookies, authorization headers with HTTPS
    },
    body,
  }),
  securityRisk: (schemaId, ajvErrors, items) => {
    console.log(constants.HASHES);
    console.log(constants.ERROR_SECURITY_RISK);
    console.log(`${constants.METHOD_TODO} ${constants.ERROR_DATA_CORRUPTION} could not validate data to '${schemaId}' schema. Errors: ${ajvErrors}`);
    console.log(`${constants.METHOD_TODO} ${constants.ERROR_DATA_CORRUPTION} bad data: ${JSON.stringify(items)}`);
    console.log(constants.HASHES);
    return util.response(500, constants.ERROR_SERVER)
  },
};

/**
 * Implementation (Internal)
 */
const impl = {
  /**
   * Validate that the given event validates against the request schema
   * @param event The event representing the HTTPS requests
   */
  validateApiGatewayRequest: (event) => {
    if (!ajv.validate(receiveRequestSchemaId, event)) { // bad request
      return BbPromise.reject(new ClientError(`could not validate request to '${receiveRequestSchemaId}' schema. Errors: '${ajv.errorsText()}' found in event: '${JSON.stringify(event)}'`))
    } else {
      return BbPromise.resolve(event)
    }
  },
  getResources: results => BbPromise.all([
    impl.getImageFromEvent(results),
    impl.getAssignment(results),

  ]),
  /**
   * The event includes a URI from which a user's image can downloaded.  Download it.
   * @param results The event representing the HTTPS request.
   */
  getImageFromEvent: (results) => {
      console.log('******** getImageFromEvent ********');
    const resultsData = results.body;
    const uri = url.parse(resultsData.MediaUrl0);
    
    return got.get(uri, { encoding: null }).then(
      res => 
        BbPromise.resolve({
          contentType: resultsData.MediaContentType0,
          data: res.body,
        })
      
    ) 
      
},
  /**
   * The request doesn't contain any of the original product creation event that caused the assignment.  Obtain the
   * assignment associated with the number that this message/image is being received from.
   * @param results The event representing the HTTPS request
   */
  getAssignment: (results) => {

    console.log('******** get assignment *********');

    const resultsData = results.body;

    const kv = new KV_Store(constants.HOST, constants.USER, 
        constants.PASS, constants.DBNAME, constants.TABLE_PHOTO_ASSIGNMENTS_NAME);
    // TODO KALEV - Make sure to correctly invoke the callback in case of error (see above).
    return kv.init()
      .then(() => kv.get(resultsData.From)) 
      .then(res => kv.close().then(() => res))
      .then((res) => {
        const parsedRes = JSON.parse(res);
        parsedRes.id = resultsData.From;
        return parsedRes;
      })
      .catch(err => BbPromise.reject(err));
  },
  /**
   * Using the results of the `getImageFromEvent` and `getAssignment` invocations, place the obtained image into the
   * proper location of the bucket for use in the web UI.
   * @param results An array of results obtained from `getResources`.  Details:
   *          results[0] = image       // The user's image that was downloaded
   *          results[1] = assignment  // The assignment associated with the given request's phone number
   */
  storeImage: (results) => {

  
    const image = results[0];
    const photographer = results[1];

    console.log('******* storeImage ********');
   
    const kv = new KV_Store(constants.HOST, constants.USER, 
        constants.PASS, constants.DBNAME, constants.TABLE_STORED_PHOTOS_NAME);

    return kv.init()
      .then(() => kv.put(
        photographer.taskEvent,
        JSON.stringify({
          Body: image.data,
          ContentType: image.contentType,
          Metadata: {
            from: photographer.taskEvent,
          },
        })))
      .then(() => kv.close())
      .then(() => BbPromise.resolve({
        photographer,
        image: `${constants.TABLE_STORED_PHOTOS_NAME}/${photographer.taskEvent}`,
      }))
      .catch(ex => BbPromise.reject(new ServerError(`Error storing image: ${ex}`)));
  },
  /**
   * Indicate the successful completion of the photographer's image assignment to the StepFunction
   * @param results The results of the placeImage, containing the assignment and new image location
   */
  sendStepSuccess: (results,event) => {
    console.log('****** sendStepSuccess ******');

    event.body.photographer = results.photographer;
    event.body.image = results.image;
    event.body.success = 'true';
    
    return BbPromise.resolve(JSON.stringify(event.body));
    
  },
  thankYouForImage: taskEvent => {
    console.log('res')
    console.log(taskEvent);
    util.response(200, `Thanks so much ${taskEvent.id}!`)
  }
};
/**
 * API (External)
 */
module.exports = (event, context, callback) => {
    impl.validateApiGatewayRequest(event)
      .then(impl.getResources)
      .then(impl.storeImage)
      .then(res => impl.sendStepSuccess(res, event))
      // .then(impl.thankYouForImage)
      .then((msg) => {
        
        callback(null, msg)
      })
      .catch(ClientError, (ex) => {
        console.log(`${constants.MODULE} - ${ex.stack}`);
        callback(null, `${ex.name}: ${ex.message}`)
      })
      .catch(AuthError, (ex) => {
        console.log(`${constants.MODULE} - ${ex.stack}`);
        callback(null, constants.ERROR_UNAUTHORIZED)
      })
      .catch(UserError, (ex) => {
        console.log(`${constants.MODULE} - ${ex.stack}`);
        callback(null, ex.message)
      })
      .catch(ServerError, (ex) => {
        console.log(`${constants.MODULE} - ${ex.stack}`);
        callback(null, ex.name)
      })
      .catch((ex) => {
        console.log(`${constants.MODULE} - Uncaught exception: ${ex.stack}`);
        callback(null, constants.ERROR_SERVER)
      })
  }

